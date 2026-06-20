# Crest Bank Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a role-gated admin panel to view every user and edit their profile, accounts/balances (as adjustment transactions), transactions, cards, and beneficiaries — using a server-side service-role client behind an admin guard.

**Architecture:** A service-role Supabase client (bypasses RLS) is used only inside server code after `requireAdmin()` verifies the caller's `profiles.role='admin'`. Pure helpers (balance adjustment, schemas) are unit-tested. Admin pages are server components; mutations are guarded server actions.

**Tech Stack:** Next.js 14 App Router, TS strict, Tailwind v3 + classic Radix shadcn, Supabase (`@supabase/supabase-js` service role), Vitest.

**Codebase facts (verified):**
- `lib/env.ts` exports `getSupabaseEnv()` → `{ url, anonKey, configured }`. Add nothing there; admin client reads `process.env.SUPABASE_SERVICE_ROLE_KEY` directly.
- `lib/supabase/server.ts` exports SYNC `createClient()`.
- `lib/dashboard/insights.ts` exports `computeInsights(accounts, txns, opts?)`, type `TxnLike`.
- `lib/validations/beneficiary.ts` exports `beneficiarySchema`.
- `lib/auth/redirects.ts` has `PROTECTED_PREFIXES = ["/dashboard"]` + `resolveAuthRedirect` (tested).
- `middleware.ts` matcher: `["/dashboard/:path*", "/login", "/register"]`.
- `lib/data/profile.ts` `getProfile()` selects `id, full_name, phone, country, avatar_url, notification_prefs` (NO role yet) → type `Profile`.
- `app/dashboard/layout.tsx` loads `profile` and renders `<Topbar ... avatarUrl=.../>`; `components/dashboard/topbar.tsx` renders `<UserMenu name email avatarUrl/>`; `components/dashboard/user-menu.tsx` is the dropdown.
- Supabase numeric → strings; coerce `balance`/`amount` with `Number(...)`.
- enums: `kyc_status` (unverified|pending|verified|rejected), `user_role` (customer|admin), `account_status` (active|frozen|closed), `card_status` (active|frozen|cancelled), `txn_type` (credit|debit).
- UI primitives: `Button`, `Card*`, `Input`, `Badge`, `Dialog*`, `Select*`. `formatCurrency`, `formatTxnDate`, `maskAccountNumber` in `lib/format`; `accountTypeLabel` in `lib/dashboard/constants`.
- Path alias `@/*` = repo root.

**Verification gates (per phase):** `npm run test`, `npx tsc --noEmit`, `npm run lint`. Run `npm run build` only at the final task (`dangerouslyDisableSandbox: true` if sandbox blocks npm; retry once on a fonts socket error).

---

## Phase 1 — Pure logic (TDD)

### Task 1: Balance adjustment helpers

**Files:** Create `lib/admin/adjustment.ts`; Test `lib/admin/__tests__/adjustment.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { computeBalanceAdjustment, signedDelta } from "@/lib/admin/adjustment";

describe("computeBalanceAdjustment", () => {
  it("returns a credit when the balance increases", () => {
    expect(computeBalanceAdjustment(100, 150)).toEqual({ type: "credit", amount: 50 });
  });
  it("returns a debit when the balance decreases", () => {
    expect(computeBalanceAdjustment(150, 100)).toEqual({ type: "debit", amount: 50 });
  });
  it("returns null when unchanged", () => {
    expect(computeBalanceAdjustment(100, 100)).toBeNull();
  });
  it("handles fractional differences cleanly", () => {
    expect(computeBalanceAdjustment(100, 100.25)).toEqual({ type: "credit", amount: 0.25 });
  });
});

describe("signedDelta", () => {
  it("credit is positive, debit is negative", () => {
    expect(signedDelta("credit", 10)).toBe(10);
    expect(signedDelta("debit", 10)).toBe(-10);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — `lib/admin/adjustment.ts`

```ts
export function signedDelta(type: "credit" | "debit", amount: number): number {
  return type === "credit" ? amount : -amount;
}

export function computeBalanceAdjustment(
  current: number,
  next: number
): { type: "credit" | "debit"; amount: number } | null {
  const diff = Number((next - current).toFixed(2));
  if (diff === 0) return null;
  return diff > 0
    ? { type: "credit", amount: diff }
    : { type: "debit", amount: Math.abs(diff) };
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/admin/adjustment.ts lib/admin/__tests__/adjustment.test.ts
git commit -m "feat(admin): pure balance-adjustment helpers"
```

---

### Task 2: Admin Zod schemas

**Files:** Create `lib/validations/admin.ts`; Test `lib/validations/__tests__/admin.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { adminProfileSchema, adminBalanceSchema, adminTransactionSchema } from "@/lib/validations/admin";

describe("adminProfileSchema", () => {
  it("accepts a valid profile", () => {
    expect(adminProfileSchema.safeParse({ full_name: "Ada", kyc_status: "verified" }).success).toBe(true);
  });
  it("rejects a bad kyc status", () => {
    expect(adminProfileSchema.safeParse({ full_name: "Ada", kyc_status: "nope" }).success).toBe(false);
  });
});

describe("adminBalanceSchema", () => {
  it("coerces a numeric string and rejects negatives", () => {
    const r = adminBalanceSchema.safeParse({ balance: "250.50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.balance).toBe(250.5);
    expect(adminBalanceSchema.safeParse({ balance: "-1" }).success).toBe(false);
  });
});

describe("adminTransactionSchema", () => {
  it("accepts a valid transaction", () => {
    expect(adminTransactionSchema.safeParse({ type: "credit", category: "Adjustment", amount: "10" }).success).toBe(true);
  });
  it("rejects amount <= 0 and bad type", () => {
    expect(adminTransactionSchema.safeParse({ type: "credit", category: "x", amount: "0" }).success).toBe(false);
    expect(adminTransactionSchema.safeParse({ type: "weird", category: "x", amount: "5" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — `lib/validations/admin.ts`

```ts
import { z } from "zod";

export const adminProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter a name"),
  country: z.string().trim().max(64).optional(),
  phone: z.string().trim().max(32).optional(),
  kyc_status: z.enum(["unverified", "pending", "verified", "rejected"]),
});
export type AdminProfileInput = z.infer<typeof adminProfileSchema>;

export const adminBalanceSchema = z.object({
  balance: z.coerce.number({ message: "Enter a balance" }).min(0, "Balance can't be negative").finite(),
});
export type AdminBalanceInput = z.infer<typeof adminBalanceSchema>;

export const adminTransactionSchema = z.object({
  type: z.enum(["credit", "debit"]),
  category: z.string().trim().min(1, "Category is required").max(40),
  amount: z.coerce.number({ message: "Enter an amount" }).positive("Amount must be greater than zero").finite(),
  description: z.string().trim().max(140).optional(),
});
export type AdminTransactionInput = z.infer<typeof adminTransactionSchema>;
```
(If `z.coerce.number({ message })` differs in the installed Zod v4, use the version's equivalent so the tests pass.)

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/validations/admin.ts lib/validations/__tests__/admin.test.ts
git commit -m "feat(admin): admin Zod schemas (profile, balance, transaction)"
```

---

### Task 3: Protect `/admin` in the redirect resolver

**Files:** Modify `lib/auth/redirects.ts`; Modify `lib/auth/__tests__/redirects.test.ts`

- [ ] **Step 1: Add tests** to `lib/auth/__tests__/redirects.test.ts` (inside the existing `resolveAuthRedirect` describe):

```ts
  it("protects /admin routes when logged out", () => {
    expect(resolveAuthRedirect("/admin", false)).toBe("/login?next=%2Fadmin");
    expect(resolveAuthRedirect("/admin/users/abc", false)).toBe("/login?next=%2Fadmin%2Fusers%2Fabc");
  });
  it("does not redirect a logged-in user away from /admin", () => {
    expect(resolveAuthRedirect("/admin", true)).toBeNull();
  });
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — in `lib/auth/redirects.ts` change the protected prefixes line to include `/admin`:

```ts
const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Add `/admin` to the middleware matcher** — in `middleware.ts`:

```ts
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register"],
```

- [ ] **Step 6: Verify** `npx tsc --noEmit` → 0.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/redirects.ts lib/auth/__tests__/redirects.test.ts middleware.ts
git commit -m "feat(admin): protect /admin routes in middleware"
```

---

## Phase 2 — Service-role client, guard, data layer

### Task 4: Service-role client + admin guard

**Files:**
- Modify: `package.json` (add `server-only`)
- Create: `lib/supabase/admin.ts`, `lib/admin/guard.ts`

- [ ] **Step 1: Install `server-only`** (compile-time guard that the module can't be imported client-side)

```bash
npm install server-only
```

- [ ] **Step 2: `lib/supabase/admin.ts`**

```ts
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Service-role client — BYPASSES RLS. Server-only; only ever call after an admin check.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Admin client not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 3: `lib/admin/guard.ts`**

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminCtx = { userId: string };

async function currentAdmin(): Promise<AdminCtx | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return data?.role === "admin" ? { userId: user.id } : null;
}

/** For pages/layouts: redirect non-admins. */
export async function requireAdmin(): Promise<AdminCtx> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (data?.role !== "admin") redirect("/dashboard");
  return { userId: user.id };
}

/** For server actions: return null instead of redirecting. */
export async function getAdminOrNull(): Promise<AdminCtx | null> {
  return currentAdmin();
}
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/supabase/admin.ts lib/admin/guard.ts
git commit -m "feat(admin): service-role client + requireAdmin guard"
```

---

### Task 5: Admin data layer

**Files:** Create `lib/admin/data.ts`

- [ ] **Step 1: Implement** — `lib/admin/data.ts`

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { computeInsights, type Insights, type TxnLike } from "@/lib/dashboard/insights";

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "customer" | "admin";
  kyc_status: string;
  accountCount: number;
  totalBalance: number;
  created_at: string;
};

export type AdminAccount = {
  id: string;
  account_number: string;
  type: string;
  currency: string;
  balance: number;
  status: string;
};
export type AdminTransaction = {
  id: string;
  account_id: string;
  type: "credit" | "debit";
  category: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  counterparty: string | null;
  created_at: string;
};
export type AdminCard = {
  id: string;
  account_id: string;
  brand: string;
  type: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  status: string;
  is_virtual: boolean;
};
export type AdminBeneficiary = {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string;
  routing_number: string | null;
  iban: string | null;
  type: string;
};

export type AdminUserDetail = {
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    country: string | null;
    phone: string | null;
    role: "customer" | "admin";
    kyc_status: string;
    created_at: string;
  };
  insights: Insights;
  accounts: AdminAccount[];
  transactions: AdminTransaction[];
  cards: AdminCard[];
  beneficiaries: AdminBeneficiary[];
};

export async function listUsers(): Promise<AdminUserRow[]> {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: accounts }, authList] = await Promise.all([
    admin.from("profiles").select("id, full_name, role, kyc_status, created_at"),
    admin.from("accounts").select("user_id, balance"),
    admin.auth.admin.listUsers(),
  ]);

  const emailById = new Map<string, string>();
  for (const u of authList.data?.users ?? []) emailById.set(u.id, u.email ?? "");

  const agg = new Map<string, { count: number; total: number }>();
  for (const a of (accounts ?? []) as { user_id: string; balance: string | number }[]) {
    const cur = agg.get(a.user_id) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(a.balance);
    agg.set(a.user_id, cur);
  }

  return ((profiles ?? []) as Record<string, unknown>[])
    .map((p) => {
      const id = p.id as string;
      const a = agg.get(id) ?? { count: 0, total: 0 };
      return {
        id,
        email: emailById.get(id) ?? "",
        full_name: (p.full_name as string | null) ?? null,
        role: (p.role as "customer" | "admin") ?? "customer",
        kyc_status: (p.kyc_status as string) ?? "unverified",
        accountCount: a.count,
        totalBalance: a.total,
        created_at: p.created_at as string,
      };
    })
    .sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, country, phone, role, kyc_status, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(userId);

  const { data: accountsRaw } = await admin
    .from("accounts")
    .select("id, account_number, type, currency, balance, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const accounts = ((accountsRaw ?? []) as Record<string, unknown>[]).map((a) => ({
    ...a,
    balance: Number(a.balance),
  })) as AdminAccount[];
  const accountIds = accounts.map((a) => a.id);

  const txnCols = "id, account_id, type, category, amount, currency, status, description, counterparty, created_at";
  const { data: txnRaw } = accountIds.length
    ? await admin.from("transactions").select(txnCols).in("account_id", accountIds).order("created_at", { ascending: false }).limit(100)
    : { data: [] as Record<string, unknown>[] };
  const transactions = ((txnRaw ?? []) as Record<string, unknown>[]).map((t) => ({
    ...t,
    amount: Number(t.amount),
  })) as AdminTransaction[];

  const { data: cardsRaw } = accountIds.length
    ? await admin.from("cards").select("id, account_id, brand, type, last4, exp_month, exp_year, status, is_virtual").in("account_id", accountIds)
    : { data: [] as Record<string, unknown>[] };
  const cards = (cardsRaw ?? []) as AdminCard[];

  const { data: benRaw } = await admin
    .from("beneficiaries")
    .select("id, name, bank_name, account_number, routing_number, iban, type")
    .eq("user_id", userId);
  const beneficiaries = (benRaw ?? []) as AdminBeneficiary[];

  const txnLike: TxnLike[] = transactions.map((t) => ({
    type: t.type,
    category: t.category,
    amount: t.amount,
    created_at: t.created_at,
  }));
  const insights = computeInsights(accounts.map((a) => ({ balance: a.balance })), txnLike);

  return {
    profile: {
      id: profile.id as string,
      email: authUser?.user?.email ?? "",
      full_name: (profile.full_name as string | null) ?? null,
      country: (profile.country as string | null) ?? null,
      phone: (profile.phone as string | null) ?? null,
      role: (profile.role as "customer" | "admin") ?? "customer",
      kyc_status: (profile.kyc_status as string) ?? "unverified",
      created_at: profile.created_at as string,
    },
    insights,
    accounts,
    transactions,
    cards,
    beneficiaries,
  };
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0. (If Supabase result typings make a field `never`, add a `Record<string, unknown>[]` cast as done above; keep behavior identical.)

- [ ] **Step 3: Commit**

```bash
git add lib/admin/data.ts
git commit -m "feat(admin): service-role data layer (listUsers, getUserDetail)"
```

---

## Phase 3 — Admin actions

### Task 6: Admin server actions

**Files:** Create `app/admin/actions.ts`

- [ ] **Step 1: Implement** — `app/admin/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getAdminOrNull } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminProfileSchema, adminBalanceSchema, adminTransactionSchema } from "@/lib/validations/admin";
import { beneficiarySchema } from "@/lib/validations/beneficiary";
import { computeBalanceAdjustment, signedDelta } from "@/lib/admin/adjustment";

export type AdminResult = { error: string } | { ok: true };

function revalidateUser(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin");
}

export async function updateUserProfile(userId: string, formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const parsed = adminProfileSchema.safeParse({
    full_name: formData.get("full_name"),
    country: formData.get("country") || undefined,
    phone: formData.get("phone") || undefined,
    kyc_status: formData.get("kyc_status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      country: parsed.data.country || null,
      phone: parsed.data.phone || null,
      kyc_status: parsed.data.kyc_status,
    })
    .eq("id", userId);
  if (error) return { error: "Could not update the profile." };
  revalidateUser(userId);
  return { ok: true };
}

export async function setUserRole(userId: string, role: "customer" | "admin"): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  if (role !== "customer" && role !== "admin") return { error: "Invalid role." };
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: "Could not change the role." };
  revalidateUser(userId);
  return { ok: true };
}

export async function adjustAccountBalance(
  userId: string,
  accountId: string,
  formData: FormData
): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const parsed = adminBalanceSchema.safeParse({ balance: formData.get("balance") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid balance." };
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("accounts")
    .select("balance, currency")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return { error: "Account not found." };

  const adj = computeBalanceAdjustment(Number(account.balance), parsed.data.balance);
  if (!adj) return { ok: true }; // no change
  const { error: balErr } = await admin.from("accounts").update({ balance: parsed.data.balance }).eq("id", accountId);
  if (balErr) return { error: "Could not update the balance." };
  await admin.from("transactions").insert({
    account_id: accountId,
    type: adj.type,
    category: "Adjustment",
    amount: adj.amount,
    currency: (account.currency as string) ?? "USD",
    status: "completed",
    description: "Admin balance adjustment",
    counterparty: "Admin",
  });
  revalidateUser(userId);
  return { ok: true };
}

export async function setAccountStatus(
  userId: string,
  accountId: string,
  status: "active" | "frozen" | "closed"
): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  if (!["active", "frozen", "closed"].includes(status)) return { error: "Invalid status." };
  const admin = createAdminClient();
  const { error } = await admin.from("accounts").update({ status }).eq("id", accountId);
  if (error) return { error: "Could not update the account." };
  revalidateUser(userId);
  return { ok: true };
}

export async function addTransaction(
  userId: string,
  accountId: string,
  formData: FormData
): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const parsed = adminTransactionSchema.safeParse({
    type: formData.get("type"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const admin = createAdminClient();
  const { data: account } = await admin.from("accounts").select("balance, currency").eq("id", accountId).maybeSingle();
  if (!account) return { error: "Account not found." };

  const { error: insErr } = await admin.from("transactions").insert({
    account_id: accountId,
    type: parsed.data.type,
    category: parsed.data.category,
    amount: parsed.data.amount,
    currency: (account.currency as string) ?? "USD",
    status: "completed",
    description: parsed.data.description || null,
    counterparty: "Admin",
  });
  if (insErr) return { error: "Could not add the transaction." };
  const newBalance = Number(account.balance) + signedDelta(parsed.data.type, parsed.data.amount);
  await admin.from("accounts").update({ balance: newBalance }).eq("id", accountId);
  revalidateUser(userId);
  return { ok: true };
}

export async function deleteTransaction(userId: string, transactionId: string): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const admin = createAdminClient();
  const { data: txn } = await admin
    .from("transactions")
    .select("account_id, type, amount")
    .eq("id", transactionId)
    .maybeSingle();
  if (!txn) return { error: "Transaction not found." };
  const { error: delErr } = await admin.from("transactions").delete().eq("id", transactionId);
  if (delErr) return { error: "Could not delete the transaction." };
  const { data: account } = await admin.from("accounts").select("balance").eq("id", txn.account_id as string).maybeSingle();
  if (account) {
    const reversed = Number(account.balance) - signedDelta(txn.type as "credit" | "debit", Number(txn.amount));
    await admin.from("accounts").update({ balance: reversed }).eq("id", txn.account_id as string);
  }
  revalidateUser(userId);
  return { ok: true };
}

export async function setCardStatus(
  userId: string,
  cardId: string,
  status: "active" | "frozen"
): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  if (status !== "active" && status !== "frozen") return { error: "Invalid status." };
  const admin = createAdminClient();
  const { error } = await admin.from("cards").update({ status }).eq("id", cardId);
  if (error) return { error: "Could not update the card." };
  revalidateUser(userId);
  return { ok: true };
}

function beneficiaryRow(d: ReturnType<typeof beneficiarySchema.parse>) {
  return {
    name: d.name,
    type: d.type,
    account_number: d.account_number,
    bank_name: d.bank_name || null,
    routing_number: d.routing_number || null,
    iban: d.iban || null,
  };
}

export async function createBeneficiaryFor(userId: string, formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const parsed = beneficiarySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    account_number: formData.get("account_number"),
    bank_name: formData.get("bank_name") || undefined,
    routing_number: formData.get("routing_number") || undefined,
    iban: formData.get("iban") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const admin = createAdminClient();
  const { error } = await admin.from("beneficiaries").insert({ ...beneficiaryRow(parsed.data), user_id: userId });
  if (error) return { error: "Could not add the beneficiary." };
  revalidateUser(userId);
  return { ok: true };
}

export async function updateBeneficiaryFor(userId: string, beneficiaryId: string, formData: FormData): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const parsed = beneficiarySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    account_number: formData.get("account_number"),
    bank_name: formData.get("bank_name") || undefined,
    routing_number: formData.get("routing_number") || undefined,
    iban: formData.get("iban") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const admin = createAdminClient();
  const { error } = await admin.from("beneficiaries").update(beneficiaryRow(parsed.data)).eq("id", beneficiaryId);
  if (error) return { error: "Could not update the beneficiary." };
  revalidateUser(userId);
  return { ok: true };
}

export async function deleteBeneficiaryFor(userId: string, beneficiaryId: string): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const admin = createAdminClient();
  const { error } = await admin.from("beneficiaries").delete().eq("id", beneficiaryId);
  if (error) return { error: "Could not delete the beneficiary." };
  revalidateUser(userId);
  return { ok: true };
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0; `npm run lint` → 0. (If `parsed.error.issues` typing differs, use the version's accessor that compiles.)

- [ ] **Step 3: Commit**

```bash
git add "app/admin/actions.ts"
git commit -m "feat(admin): guarded admin server actions"
```

---

## Phase 4 — Admin UI

### Task 7: Admin shell + users list

**Files:** Create `app/admin/layout.tsx`, `app/admin/page.tsx`, `components/admin/users-table.tsx`

- [ ] **Step 1: `app/admin/layout.tsx`**

```tsx
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/admin/guard";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-navy-900 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 font-display font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Crest Admin
          </span>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
              <Link href="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to app</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline" className="border-navy-700 bg-transparent text-white hover:bg-white/10">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: `components/admin/users-table.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminUserRow } from "@/lib/admin/data";
import { formatCurrency } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [q, setQ] = useState("");
  const filtered = users.filter((u) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (u.email + " " + (u.full_name ?? "")).toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">KYC</th>
              <th className="px-4 py-3 font-medium">Accounts</th>
              <th className="px-4 py-3 text-right font-medium">Total balance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-accent/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-primary hover:underline">
                    {u.email || "(no email)"}
                  </Link>
                </td>
                <td className="px-4 py-3">{u.full_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.kyc_status}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.accountCount}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(u.totalBalance)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `app/admin/page.tsx`**

```tsx
import type { Metadata } from "next";
import { listUsers } from "@/lib/admin/data";
import { UsersTable } from "@/components/admin/users-table";

export const metadata: Metadata = { title: "Admin · Users", robots: { index: false, follow: false } };

export default async function AdminUsersPage() {
  const users = await listUsers();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">{users.length} total</p>
      </div>
      <UsersTable users={users} />
    </div>
  );
}
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0; `npm run lint` → 0.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/layout.tsx" "app/admin/page.tsx" components/admin/users-table.tsx
git commit -m "feat(admin): admin shell + users list"
```

---

### Task 8: User-detail editor components

**Files:** Create `components/admin/profile-editor.tsx`, `components/admin/account-editor.tsx`, `components/admin/transaction-manager.tsx`, `components/admin/card-toggle.tsx`, `components/admin/beneficiary-manager.tsx`

- [ ] **Step 1: `components/admin/profile-editor.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import type { AdminUserDetail } from "@/lib/admin/data";
import { updateUserProfile, setUserRole } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KYC = ["unverified", "pending", "verified", "rejected"] as const;
const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-4 text-sm";

export function ProfileEditor({ profile }: { profile: AdminUserDetail["profile"] }) {
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    setMsg(null);
    startTransition(async () => {
      const result = await updateUserProfile(profile.id, formData);
      setMsg("error" in result ? { text: result.error } : { ok: true, text: "Saved." });
    });
  }

  function changeRole(role: "customer" | "admin") {
    setMsg(null);
    startTransition(async () => {
      const result = await setUserRole(profile.id, role);
      setMsg("error" in result ? { text: result.error } : { ok: true, text: `Role set to ${role}.` });
    });
  }

  return (
    <form action={save} className="space-y-4">
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-rose-500/10 text-rose-500"}`}>
          {msg.text}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{profile.email}</p>
      <div>
        <label htmlFor="ap-name" className="mb-1 block text-sm font-medium">Full name</label>
        <Input id="ap-name" name="full_name" defaultValue={profile.full_name ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ap-country" className="mb-1 block text-sm font-medium">Country</label>
          <Input id="ap-country" name="country" defaultValue={profile.country ?? ""} />
        </div>
        <div>
          <label htmlFor="ap-phone" className="mb-1 block text-sm font-medium">Phone</label>
          <Input id="ap-phone" name="phone" defaultValue={profile.phone ?? ""} />
        </div>
      </div>
      <div>
        <label htmlFor="ap-kyc" className="mb-1 block text-sm font-medium">KYC status</label>
        <select id="ap-kyc" name="kyc_status" defaultValue={profile.kyc_status} className={selectClass}>
          {KYC.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
        <span className="text-sm text-muted-foreground">Role: <strong>{profile.role}</strong></span>
        {profile.role === "admin" ? (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => changeRole("customer")}>
            Demote to customer
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => changeRole("admin")}>
            Promote to admin
          </Button>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: `components/admin/account-editor.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import type { AdminAccount } from "@/lib/admin/data";
import { adjustAccountBalance, setAccountStatus } from "@/app/admin/actions";
import { accountTypeLabel } from "@/lib/dashboard/constants";
import { maskAccountNumber } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUSES = ["active", "frozen", "closed"] as const;
const selectClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm";

export function AccountEditor({ userId, account }: { userId: string; account: AdminAccount }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveBalance(formData: FormData) {
    setMsg(null);
    startTransition(async () => {
      const result = await adjustAccountBalance(userId, account.id, formData);
      setMsg("error" in result ? result.error : "Balance updated.");
    });
  }

  function changeStatus(status: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await setAccountStatus(userId, account.id, status as "active" | "frozen" | "closed");
      setMsg("error" in result ? result.error : "Status updated.");
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="font-medium">{accountTypeLabel(account.type)} · {maskAccountNumber(account.account_number)}</p>
          <select className={selectClass} defaultValue={account.status} onChange={(e) => changeStatus(e.target.value)} disabled={pending} aria-label="Account status">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <form action={saveBalance} className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor={`bal-${account.id}`} className="mb-1 block text-xs font-medium text-muted-foreground">Balance ({account.currency})</label>
            <Input id={`bal-${account.id}`} name="balance" inputMode="decimal" defaultValue={account.balance.toFixed(2)} />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>Set balance</Button>
        </form>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: `components/admin/transaction-manager.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import type { AdminAccount, AdminTransaction } from "@/lib/admin/data";
import { addTransaction, deleteTransaction } from "@/app/admin/actions";
import { formatCurrency, formatTxnDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const selectClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm";

export function TransactionManager({
  userId,
  accounts,
  transactions,
}: {
  userId: string;
  accounts: AdminAccount[];
  transactions: AdminTransaction[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(formData: FormData) {
    if (!accountId) return;
    setMsg(null);
    startTransition(async () => {
      const result = await addTransaction(userId, accountId, formData);
      setMsg("error" in result ? result.error : "Transaction added.");
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this transaction? The account balance will be reversed.")) return;
    setMsg(null);
    startTransition(async () => {
      const result = await deleteTransaction(userId, id);
      setMsg("error" in result ? result.error : "Transaction deleted.");
    });
  }

  return (
    <div className="space-y-4">
      {accounts.length > 0 && (
        <form action={add} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Account</label>
            <select className={selectClass} value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Account">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_number.slice(-4)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
            <select name="type" className={selectClass} aria-label="Type">
              <option value="credit">credit</option>
              <option value="debit">debit</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
            <Input name="category" defaultValue="Adjustment" className="h-10 w-36" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Amount</label>
            <Input name="amount" inputMode="decimal" placeholder="0.00" className="h-10 w-28" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <Input name="description" className="h-10" />
          </div>
          <Button type="submit" disabled={pending}>Add</Button>
        </form>
      )}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="px-3 py-2 text-muted-foreground">{formatTxnDate(t.created_at)}</td>
                <td className="px-3 py-2">{t.description ?? t.counterparty ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{t.category}</td>
                <td className={cn("px-3 py-2 text-right font-semibold", t.type === "credit" ? "text-success" : "text-foreground")}>
                  {t.type === "credit" ? "+" : "-"}{formatCurrency(t.amount, t.currency)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="icon" disabled={pending} onClick={() => remove(t.id)} aria-label="Delete transaction">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No transactions.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `components/admin/card-toggle.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import type { AdminCard } from "@/lib/admin/data";
import { setCardStatus } from "@/app/admin/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CardToggle({ userId, card }: { userId: string; card: AdminCard }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const frozen = card.status !== "active";

  function toggle() {
    setMsg(null);
    startTransition(async () => {
      const result = await setCardStatus(userId, card.id, frozen ? "active" : "frozen");
      if ("error" in result) setMsg(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium">{card.brand} {card.type} •••• {card.last4}</p>
          <p className="text-xs text-muted-foreground">exp {String(card.exp_month).padStart(2, "0")}/{String(card.exp_year).slice(-2)}</p>
          {msg && <p className="mt-1 text-xs text-rose-500">{msg}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={card.status === "active" ? "success" : "secondary"}>{card.status}</Badge>
          <Button variant="outline" size="sm" disabled={pending || card.status === "cancelled"} onClick={toggle}>
            {frozen ? "Unfreeze" : "Freeze"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: `components/admin/beneficiary-manager.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { AdminBeneficiary } from "@/lib/admin/data";
import { createBeneficiaryFor, updateBeneficiaryFor, deleteBeneficiaryFor } from "@/app/admin/actions";
import { maskAccountNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-4 text-sm";

function Editor({ userId, beneficiary, onDone }: { userId: string; beneficiary?: AdminBeneficiary; onDone: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function save(formData: FormData) {
    setMsg(null);
    startTransition(async () => {
      const result = beneficiary
        ? await updateBeneficiaryFor(userId, beneficiary.id, formData)
        : await createBeneficiaryFor(userId, formData);
      if ("error" in result) setMsg(result.error);
      else onDone();
    });
  }
  return (
    <form action={save} className="space-y-3 rounded-xl border bg-card p-4">
      {msg && <p className="text-xs text-rose-500">{msg}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" placeholder="Name" defaultValue={beneficiary?.name ?? ""} />
        <select name="type" defaultValue={beneficiary?.type ?? "external"} className={selectClass} aria-label="Type">
          <option value="external">external</option>
          <option value="wire">wire</option>
          <option value="internal">internal</option>
        </select>
        <Input name="account_number" placeholder="Account number" defaultValue={beneficiary?.account_number ?? ""} />
        <Input name="bank_name" placeholder="Bank (optional)" defaultValue={beneficiary?.bank_name ?? ""} />
        <Input name="routing_number" placeholder="Routing (optional)" defaultValue={beneficiary?.routing_number ?? ""} />
        <Input name="iban" placeholder="IBAN (optional)" defaultValue={beneficiary?.iban ?? ""} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{beneficiary ? "Save" : "Add"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function BeneficiaryManager({ userId, beneficiaries }: { userId: string; beneficiaries: AdminBeneficiary[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm("Delete this beneficiary?")) return;
    startTransition(() => { void deleteBeneficiaryFor(userId, id); });
  }

  return (
    <div className="space-y-3">
      {adding ? (
        <Editor userId={userId} onDone={() => setAdding(false)} />
      ) : (
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" /> Add beneficiary</Button>
      )}
      <div className="space-y-2">
        {beneficiaries.map((b) =>
          editingId === b.id ? (
            <Editor key={b.id} userId={userId} beneficiary={b} onDone={() => setEditingId(null)} />
          ) : (
            <div key={b.id} className="flex items-center justify-between rounded-xl border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{b.name} <Badge variant="secondary">{b.type}</Badge></p>
                <p className="text-xs text-muted-foreground">{b.bank_name ?? "—"} · {maskAccountNumber(b.account_number)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingId(b.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )
        )}
        {beneficiaries.length === 0 && <p className="text-sm text-muted-foreground">No beneficiaries.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify** `npx tsc --noEmit` → 0; `npm run lint` → 0.

- [ ] **Step 7: Commit**

```bash
git add components/admin/profile-editor.tsx components/admin/account-editor.tsx components/admin/transaction-manager.tsx components/admin/card-toggle.tsx components/admin/beneficiary-manager.tsx
git commit -m "feat(admin): user-detail editor components"
```

---

### Task 9: User-detail page

**Files:** Create `app/admin/users/[id]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserDetail } from "@/lib/admin/data";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileEditor } from "@/components/admin/profile-editor";
import { AccountEditor } from "@/components/admin/account-editor";
import { TransactionManager } from "@/components/admin/transaction-manager";
import { CardToggle } from "@/components/admin/card-toggle";
import { BeneficiaryManager } from "@/components/admin/beneficiary-manager";

export const metadata: Metadata = { title: "Admin · User", robots: { index: false, follow: false } };

export default async function AdminUserPage({ params }: { params: { id: string } }) {
  const detail = await getUserDetail(params.id);
  if (!detail) notFound();
  const { profile, insights, accounts, transactions, cards, beneficiaries } = detail;

  const stat = [
    { label: "Total balance", value: insights.totalBalance },
    { label: "Income this month", value: insights.monthIncome },
    { label: "Spending this month", value: insights.monthSpending },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        {profile.full_name ?? profile.email || "User"}
      </h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {stat.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-bold">{formatCurrency(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent><ProfileEditor profile={profile} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts.</p>
          ) : (
            accounts.map((a) => <AccountEditor key={a.id} userId={profile.id} account={a} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent>
          <TransactionManager userId={profile.id} accounts={accounts} transactions={transactions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cards</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cards.</p>
          ) : (
            cards.map((c) => <CardToggle key={c.id} userId={profile.id} card={c} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Beneficiaries</CardTitle></CardHeader>
        <CardContent>
          <BeneficiaryManager userId={profile.id} beneficiaries={beneficiaries} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0; `npm run lint` → 0.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/users/[id]/page.tsx"
git commit -m "feat(admin): user-detail page"
```

---

## Phase 5 — Admin link in the dashboard

### Task 10: Show "Admin panel" for admins

**Files:** Modify `lib/data/profile.ts`, `app/dashboard/layout.tsx`, `components/dashboard/topbar.tsx`, `components/dashboard/user-menu.tsx`

- [ ] **Step 1: Add `role` to the profile** — in `lib/data/profile.ts`: add `role: "customer" | "admin";` to the `Profile` type; add `role` to the `.select(...)` column list; in the returned object include `role: (data.role as "customer" | "admin") ?? "customer"`.

- [ ] **Step 2: Pass `isAdmin` through the dashboard layout** — in `app/dashboard/layout.tsx`, update the `<Topbar .../>` to add `isAdmin={profile?.role === "admin"}`:

```tsx
          <Topbar
            name={name}
            email={user.email ?? ""}
            notifications={notifications}
            avatarUrl={profile?.avatar_url ?? null}
            isAdmin={profile?.role === "admin"}
          />
```

- [ ] **Step 3: Forward it in `components/dashboard/topbar.tsx`** — add `isAdmin: boolean;` to the props type and destructure, then pass `isAdmin={isAdmin}` to `<UserMenu .../>`.

- [ ] **Step 4: Render the link in `components/dashboard/user-menu.tsx`** — add `import Link from "next/link";` and `import { ShieldCheck } from "lucide-react";`. Change the signature to accept `isAdmin: boolean`. Add this item between the Profile item and the sign-out item:

```tsx
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="flex w-full items-center">
              <ShieldCheck className="mr-2 h-4 w-4" /> Admin panel
            </Link>
          </DropdownMenuItem>
        )}
```

- [ ] **Step 5: Verify** `npx tsc --noEmit` → 0; `npm run lint` → 0.

- [ ] **Step 6: Commit**

```bash
git add lib/data/profile.ts app/dashboard/layout.tsx components/dashboard/topbar.tsx components/dashboard/user-menu.tsx
git commit -m "feat(admin): admin-only Admin panel link in dashboard menu"
```

---

## Phase 6 — Docs & final verification

### Task 11: README admin section

**Files:** Modify `README.md`

- [ ] **Step 1: Add an "Admin panel" section** documenting: requires `SUPABASE_SERVICE_ROLE_KEY` set (server-only); the bootstrap SQL to make yourself an admin:
  ```sql
  update public.profiles set role = 'admin'
  where id = (select id from auth.users where email = 'you@example.com');
  ```
  then sign in → "Admin panel" appears in the user menu → `/admin`. List/search users; open one to edit profile/role/KYC, adjust balances (records an Adjustment transaction), change account/card status, add/delete transactions, and manage beneficiaries. Note the service-role key bypasses RLS and is used only server-side behind the admin guard; never commit it.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: admin panel setup + bootstrap"
```

---

### Task 12: Final verification gate

- [ ] **Step 1: Tests** — `npm run test` → all pass (adjustment + admin schemas + redirects + prior).
- [ ] **Step 2: Types** — `npx tsc --noEmit` → 0.
- [ ] **Step 3: Lint** — `npm run lint` → 0.
- [ ] **Step 4: Build** — `npm run build` → succeeds; routes include `/admin` and `/admin/users/[id]`; Middleware emitted. (Retry once on a fonts socket error; `dangerouslyDisableSandbox: true` if sandbox blocks npm.)
- [ ] **Step 5: Grep guard** — confirm `lib/supabase/admin.ts` is imported only by `lib/admin/*` and `app/admin/*` (server), never by a `"use client"` file. Run: `grep -rn "@/lib/supabase/admin" app components lib` and eyeball that every importer is server-side.
- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "chore(admin): verification fixes"
```

---

## Self-Review Notes (coverage vs spec)

- §2 authorization (service-role client, requireAdmin/getAdminOrNull, middleware) → Tasks 3,4. ✓
- §3 architecture (client, guard, data, actions, components, pages) → Tasks 4–9. ✓
- §4 data layer (listUsers, getUserDetail w/ insights + numeric coercion) → Task 5. ✓
- §5 pure logic → Task 1. ✓
- §6 all admin actions (profile, role, balance+adjustment, status, add/delete txn, card, beneficiary CRUD) → Task 6. ✓
- §7 UI (shell, list, detail, editors) → Tasks 7,8,9. ✓
- §8 error handling (not-admin → {error}; notFound; no-op balance) → Tasks 6,9. ✓
- §9 testing (adjustment + schemas unit; manual) → Tasks 1,2,11,12. ✓
- §10 acceptance criteria → Task 12 + manual. ✓
- §11 bootstrap SQL → Task 11. ✓

**Type consistency:** `AdminUserRow`/`AdminUserDetail` (+ `AdminAccount/Transaction/Card/Beneficiary`) defined in `lib/admin/data.ts` (Task 5) are consumed by the list (Task 7) and detail components/page (Tasks 8,9). Action signatures in Task 6 (`updateUserProfile(userId, fd)`, `setUserRole(userId, role)`, `adjustAccountBalance(userId, accountId, fd)`, `setAccountStatus(userId, accountId, status)`, `addTransaction(userId, accountId, fd)`, `deleteTransaction(userId, id)`, `setCardStatus(userId, cardId, status)`, `createBeneficiaryFor/updateBeneficiaryFor/deleteBeneficiaryFor`) match every call site in Task 8. `requireAdmin`/`getAdminOrNull` (Task 4) used by layout (Task 7) and actions (Task 6). `computeBalanceAdjustment`/`signedDelta` (Task 1) used in actions (Task 6). `Profile.role` (Task 10) gates the menu link. `createAdminClient` only imported server-side (Task 12 grep).
