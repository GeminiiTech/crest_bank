# Crest Bank Transfers, Beneficiaries & Transactions (M4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add beneficiaries CRUD, atomic internal/external transfers (via a SECURITY DEFINER Postgres function), and a searchable/filterable/paginated transactions page with CSV export.

**Architecture:** All balance mutation goes through one atomic `execute_transfer` Postgres RPC (migration 0013, which also drops M1's client `accounts update` policy). Server Components read RLS-scoped data; client forms call server actions (transfers via `supabase.rpc`, beneficiaries via owner-scoped writes). Pure modules (query parsing, CSV, Zod) are unit-tested.

**Tech Stack:** Next.js 14 App Router, TS strict, Tailwind v3 + classic Radix shadcn, Supabase (Postgres RPC), Recharts (existing), Vitest.

**Codebase facts to rely on:**
- `lib/supabase/server.ts` exports SYNC `createClient()` — no `await`.
- Supabase returns `numeric` as **strings** — coerce `amount`/`balance` with `Number(...)`.
- Data layer types: `lib/data/accounts.ts` `Account`, `lib/data/transactions.ts` `Transaction` (+ COLS), `lib/data/notifications.ts`. `lib/format.ts` (`formatCurrency`, `formatTxnDate`, `maskAccountNumber`). `lib/dashboard/constants.ts` (`accountTypeLabel`).
- Dashboard shell at `app/dashboard/layout.tsx`; nav in `lib/dashboard/nav.ts`.
- UI primitives present: `Button` (asChild), `Card*`, `Input`, `Badge`, `Separator`, `Sheet*`, `dropdown-menu`, `popover`. Hand-author NEW `select` + `dialog` (do NOT run `npx shadcn add`).
- `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover` installed. `@radix-ui/react-select` is NOT — install it.

**Verification gates (per phase):** `npm run test`, `npx tsc --noEmit`, `npm run lint`. Run `npm run build` only at the final task (fonts fetch flaky; retry once; `dangerouslyDisableSandbox: true` if sandbox blocks npm).

---

## Phase 1 — Pure logic (TDD)

### Task 1: Beneficiary + transfer Zod schemas

**Files:**
- Create: `lib/validations/beneficiary.ts`, `lib/validations/transfer.ts`
- Test: `lib/validations/__tests__/beneficiary.test.ts`, `lib/validations/__tests__/transfer.test.ts`

- [ ] **Step 1: Write failing tests**

`lib/validations/__tests__/beneficiary.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { beneficiarySchema } from "@/lib/validations/beneficiary";

const base = { name: "Jane Doe", type: "external", account_number: "12345678" };

describe("beneficiarySchema", () => {
  it("accepts a minimal valid beneficiary", () => {
    expect(beneficiarySchema.safeParse(base).success).toBe(true);
  });
  it("accepts optional bank/routing/iban", () => {
    expect(beneficiarySchema.safeParse({ ...base, bank_name: "Acme", routing_number: "021", iban: "GB00" }).success).toBe(true);
  });
  it("rejects a short name", () => {
    expect(beneficiarySchema.safeParse({ ...base, name: "J" }).success).toBe(false);
  });
  it("rejects a short account number", () => {
    expect(beneficiarySchema.safeParse({ ...base, account_number: "12" }).success).toBe(false);
  });
  it("rejects an invalid type", () => {
    expect(beneficiarySchema.safeParse({ ...base, type: "crypto" }).success).toBe(false);
  });
});
```

`lib/validations/__tests__/transfer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { transferSchema } from "@/lib/validations/transfer";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

describe("transferSchema", () => {
  it("accepts a valid internal transfer", () => {
    const r = transferSchema.safeParse({ mode: "internal", fromAccountId: A, toAccountId: B, amount: "100.50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(100.5);
  });
  it("rejects internal transfer to the same account", () => {
    expect(transferSchema.safeParse({ mode: "internal", fromAccountId: A, toAccountId: A, amount: "10" }).success).toBe(false);
  });
  it("accepts a valid external transfer", () => {
    expect(transferSchema.safeParse({ mode: "external", fromAccountId: A, beneficiaryId: B, amount: "25" }).success).toBe(true);
  });
  it("rejects a non-positive amount", () => {
    expect(transferSchema.safeParse({ mode: "internal", fromAccountId: A, toAccountId: B, amount: "0" }).success).toBe(false);
  });
  it("rejects a non-numeric amount", () => {
    expect(transferSchema.safeParse({ mode: "internal", fromAccountId: A, toAccountId: B, amount: "abc" }).success).toBe(false);
  });
  it("rejects external transfer without beneficiary", () => {
    expect(transferSchema.safeParse({ mode: "external", fromAccountId: A, amount: "25" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** `lib/validations/beneficiary.ts`

```ts
import { z } from "zod";

export const beneficiarySchema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  type: z.enum(["internal", "external", "wire"]),
  account_number: z.string().trim().min(4, "Enter the account number"),
  bank_name: z.string().trim().max(120).optional(),
  routing_number: z.string().trim().max(40).optional(),
  iban: z.string().trim().max(64).optional(),
});
export type BeneficiaryInput = z.infer<typeof beneficiarySchema>;
```

- [ ] **Step 4: Implement** `lib/validations/transfer.ts`

```ts
import { z } from "zod";

const amount = z.coerce.number({ message: "Enter an amount" }).positive("Enter an amount greater than zero").finite();
const reference = z.string().trim().max(140).optional();

const internal = z.object({
  mode: z.literal("internal"),
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount,
  reference,
});

const external = z.object({
  mode: z.literal("external"),
  fromAccountId: z.string().uuid(),
  beneficiaryId: z.string().uuid(),
  amount,
  reference,
});

export const transferSchema = z
  .discriminatedUnion("mode", [internal, external])
  .superRefine((d, ctx) => {
    if (d.mode === "internal" && d.fromAccountId === d.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toAccountId"],
        message: "Choose a different destination account",
      });
    }
  });

export type TransferInput = z.infer<typeof transferSchema>;
```

- [ ] **Step 5: Run — expect PASS.** `npm run test`
  If `z.coerce.number({ message })` or `z.ZodIssueCode` differs in the installed Zod v4, use the version's equivalent (e.g. `z.coerce.number()` with a `.refine`, and `"custom"` string for the issue code) so the tests pass with identical behavior.

- [ ] **Step 6: Commit**

```bash
git add lib/validations/beneficiary.ts lib/validations/transfer.ts lib/validations/__tests__/beneficiary.test.ts lib/validations/__tests__/transfer.test.ts
git commit -m "feat(m4): beneficiary + transfer Zod schemas"
```

---

### Task 2: Transactions query parser

**Files:**
- Create: `lib/transactions/filters.ts`
- Test: `lib/transactions/__tests__/filters.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseTransactionQuery } from "@/lib/transactions/filters";

describe("parseTransactionQuery", () => {
  it("applies defaults", () => {
    expect(parseTransactionQuery({})).toMatchObject({ page: 1, pageSize: 20 });
  });
  it("clamps pageSize to 100 and page to >= 1", () => {
    expect(parseTransactionQuery({ page: "0", pageSize: "999" })).toMatchObject({ page: 1, pageSize: 100 });
  });
  it("parses valid type, ignores invalid", () => {
    expect(parseTransactionQuery({ type: "debit" }).type).toBe("debit");
    expect(parseTransactionQuery({ type: "weird" }).type).toBeUndefined();
  });
  it("trims search and validates dates", () => {
    const q = parseTransactionQuery({ search: "  coffee  ", from: "2026-06-01", to: "bad" });
    expect(q.search).toBe("coffee");
    expect(q.from).toBe("2026-06-01");
    expect(q.to).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** `lib/transactions/filters.ts`

```ts
export type TransactionQuery = {
  accountId?: string;
  type?: "credit" | "debit";
  category?: string;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: ParamSource, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function toPositiveInt(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function parseTransactionQuery(params: ParamSource): TransactionQuery {
  const type = read(params, "type");
  const isoDate = (v: string | undefined) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  const page = Math.max(1, toPositiveInt(read(params, "page"), 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, toPositiveInt(read(params, "pageSize"), DEFAULT_PAGE_SIZE)));

  return {
    accountId: read(params, "accountId") || undefined,
    type: type === "credit" || type === "debit" ? type : undefined,
    category: read(params, "category") || undefined,
    search: read(params, "search")?.trim() || undefined,
    from: isoDate(read(params, "from")),
    to: isoDate(read(params, "to")),
    page,
    pageSize,
  };
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/transactions/filters.ts lib/transactions/__tests__/filters.test.ts
git commit -m "feat(m4): transaction query parser (defaults + clamping)"
```

---

### Task 3: CSV serializer

**Files:**
- Create: `lib/transactions/csv.ts`
- Test: `lib/transactions/__tests__/csv.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { toCsv, type CsvRow } from "@/lib/transactions/csv";

const row: CsvRow = {
  created_at: "2026-06-12T10:00:00.000Z",
  description: "Coffee, large",
  category: "Dining",
  type: "debit",
  amount: 4.5,
  currency: "USD",
  status: "completed",
  counterparty: "Blue Bottle",
};

describe("toCsv", () => {
  it("returns only headers for an empty list", () => {
    expect(toCsv([])).toBe("Date,Description,Category,Type,Amount,Currency,Status");
  });
  it("escapes commas and quotes and signs debits negative", () => {
    const out = toCsv([row]).split("\n");
    expect(out[0]).toBe("Date,Description,Category,Type,Amount,Currency,Status");
    expect(out[1]).toContain('"Coffee, large"');
    expect(out[1]).toContain("-4.50");
  });
  it("escapes embedded quotes by doubling", () => {
    const out = toCsv([{ ...row, description: 'He said "hi"' }]).split("\n")[1];
    expect(out).toContain('"He said ""hi"""');
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** `lib/transactions/csv.ts`

```ts
export type CsvRow = {
  created_at: string;
  description: string | null;
  category: string;
  type: "credit" | "debit";
  amount: number;
  currency: string;
  status: string;
  counterparty: string | null;
};

const HEADERS = ["Date", "Description", "Category", "Type", "Amount", "Currency", "Status"];

function esc(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: CsvRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    const signed = (r.type === "debit" ? -r.amount : r.amount).toFixed(2);
    lines.push(
      [
        esc(r.created_at),
        esc(r.description ?? r.counterparty ?? ""),
        esc(r.category),
        esc(r.type),
        esc(signed),
        esc(r.currency),
        esc(r.status),
      ].join(",")
    );
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/transactions/csv.ts lib/transactions/__tests__/csv.test.ts
git commit -m "feat(m4): transactions CSV serializer"
```

---

## Phase 2 — Atomic transfer migration

### Task 4: Migration 0013 — execute_transfer + drop client accounts-update policy

**Files:** Create `supabase/migrations/0013_execute_transfer.sql`

- [ ] **Step 1: Create the file**

```sql
-- Harden: clients must not write account balances directly. All balance
-- mutation goes through execute_transfer (SECURITY DEFINER, bypasses RLS).
drop policy if exists "accounts update own" on public.accounts;

-- Atomic transfer: debit/credit + transaction rows + transfer row, all-or-nothing.
create or replace function public.execute_transfer(
  p_from_account uuid,
  p_to_account uuid,
  p_beneficiary uuid,
  p_amount numeric,
  p_kind text,
  p_reference text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_from public.accounts;
  v_to public.accounts;
  v_ben public.beneficiaries;
  v_transfer_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_from from public.accounts where id = p_from_account for update;
  if not found or v_from.user_id <> v_uid then
    raise exception 'Source account not found';
  end if;
  if v_from.status <> 'active' then
    raise exception 'Source account is not active';
  end if;
  if v_from.balance < p_amount then
    raise exception 'Insufficient funds';
  end if;

  if p_kind = 'internal' then
    if p_to_account is null then
      raise exception 'Destination account required';
    end if;
    if p_to_account = p_from_account then
      raise exception 'Cannot transfer to the same account';
    end if;
    select * into v_to from public.accounts where id = p_to_account for update;
    if not found or v_to.user_id <> v_uid then
      raise exception 'Destination account not found';
    end if;

    update public.accounts set balance = balance - p_amount where id = p_from_account;
    update public.accounts set balance = balance + p_amount where id = p_to_account;

    insert into public.transfers (from_account_id, to_account_id, amount, currency, kind, status, reference)
    values (p_from_account, p_to_account, p_amount, v_from.currency, 'internal', 'completed', p_reference)
    returning id into v_transfer_id;

    insert into public.transactions (account_id, type, category, amount, currency, status, description, counterparty, reference)
    values (p_from_account, 'debit', 'Transfer', p_amount, v_from.currency, 'completed',
            'Transfer to ' || coalesce(v_to.account_number, 'account'), 'Internal transfer', v_transfer_id::text);
    insert into public.transactions (account_id, type, category, amount, currency, status, description, counterparty, reference)
    values (p_to_account, 'credit', 'Transfer', p_amount, v_from.currency, 'completed',
            'Transfer from ' || coalesce(v_from.account_number, 'account'), 'Internal transfer', v_transfer_id::text);

  elsif p_kind in ('external', 'wire') then
    if p_beneficiary is null then
      raise exception 'Beneficiary required';
    end if;
    select * into v_ben from public.beneficiaries where id = p_beneficiary;
    if not found or v_ben.user_id <> v_uid then
      raise exception 'Beneficiary not found';
    end if;

    update public.accounts set balance = balance - p_amount where id = p_from_account;

    insert into public.transfers (from_account_id, beneficiary_id, amount, currency, kind, status, reference)
    values (p_from_account, p_beneficiary, p_amount, v_from.currency, p_kind::public.transfer_kind, 'completed', p_reference)
    returning id into v_transfer_id;

    insert into public.transactions (account_id, type, category, amount, currency, status, description, counterparty, reference)
    values (p_from_account, 'debit', 'Transfer', p_amount, v_from.currency, 'completed',
            'Transfer to ' || v_ben.name, coalesce(v_ben.bank_name, 'External'), v_transfer_id::text);
  else
    raise exception 'Invalid transfer kind';
  end if;

  return v_transfer_id;
end;
$$;

grant execute on function public.execute_transfer(uuid, uuid, uuid, numeric, text, text) to authenticated;
```

- [ ] **Step 2: Proofread** for: ordering (references existing tables/enums from 0001–0012), `for update` on source before funds check, ownership checks against `auth.uid()`, both internal updates present, enum cast `p_kind::public.transfer_kind` valid for `external`/`wire`. (No local DB to run — validate by inspection.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0013_execute_transfer.sql
git commit -m "feat(db): atomic execute_transfer RPC + drop client accounts-update policy (0013)"
```

---

## Phase 3 — Data layer, actions, nav, shared constants

### Task 5: Categories constant + nav update

**Files:**
- Modify: `lib/dashboard/constants.ts`, `lib/dashboard/nav.ts`

- [ ] **Step 1: Append to `lib/dashboard/constants.ts`**

```ts
export const TRANSACTION_CATEGORIES = [
  "Salary",
  "Transfer",
  "Groceries",
  "Dining",
  "Transport",
  "Shopping",
  "Utilities",
  "Entertainment",
  "Health",
  "Interest",
  "Refund",
  "general",
] as const;
```

- [ ] **Step 2: Update `lib/dashboard/nav.ts`** — enable Transfers + Transactions and add Beneficiaries (between Accounts and Transfers). Replace the `dashboardNav` array with:

```ts
export const dashboardNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, enabled: true },
  { label: "Accounts", href: "/dashboard/accounts", icon: Wallet, enabled: true },
  { label: "Beneficiaries", href: "/dashboard/beneficiaries", icon: Users, enabled: true },
  { label: "Transfers", href: "/dashboard/transfers", icon: ArrowLeftRight, enabled: true },
  { label: "Transactions", href: "/dashboard/transactions", icon: Receipt, enabled: true },
  { label: "Cards", href: "/dashboard/cards", icon: CreditCard, enabled: false },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, enabled: false },
];
```
Add `Users` to the lucide import line at the top of the file.

- [ ] **Step 3: Verify** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard/constants.ts lib/dashboard/nav.ts
git commit -m "feat(m4): enable transfers/transactions nav + beneficiaries item + categories"
```

---

### Task 6: Data layer (beneficiaries, transfers, transactions page)

**Files:**
- Create: `lib/data/beneficiaries.ts`, `lib/data/transfers.ts`
- Modify: `lib/data/transactions.ts` (append `getTransactionsPage`)

- [ ] **Step 1: `lib/data/beneficiaries.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export type Beneficiary = {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string;
  routing_number: string | null;
  iban: string | null;
  type: "internal" | "external" | "wire";
  is_favorite: boolean;
};

const COLS = "id, name, bank_name, account_number, routing_number, iban, type, is_favorite";

export async function getBeneficiaries(): Promise<Beneficiary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("beneficiaries")
    .select(COLS)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Beneficiary[];
}

export async function getBeneficiaryById(id: string): Promise<Beneficiary | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("beneficiaries").select(COLS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as Beneficiary;
}
```

- [ ] **Step 2: `lib/data/transfers.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export type Transfer = {
  id: string;
  amount: number;
  currency: string;
  kind: "internal" | "external" | "wire";
  status: string;
  reference: string | null;
  created_at: string;
};

export async function getRecentTransfers(limit = 8): Promise<Transfer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transfers")
    .select("id, amount, currency, kind, status, reference, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((t) => ({ ...t, amount: Number(t.amount) })) as Transfer[];
}
```

- [ ] **Step 3: Append `getTransactionsPage` to `lib/data/transactions.ts`** (keep existing exports; add this + import the query type)

```ts
import type { TransactionQuery } from "@/lib/transactions/filters";

export async function getTransactionsPage(
  q: TransactionQuery
): Promise<{ rows: Transaction[]; total: number }> {
  const supabase = createClient();
  let query = supabase.from("transactions").select(COLS, { count: "exact" });

  if (q.accountId) query = query.eq("account_id", q.accountId);
  if (q.type) query = query.eq("type", q.type);
  if (q.category) query = query.eq("category", q.category);
  if (q.from) query = query.gte("created_at", q.from);
  if (q.to) query = query.lte("created_at", `${q.to}T23:59:59.999Z`);
  if (q.search) {
    // Strip PostgREST filter metacharacters to prevent or-filter injection.
    const safe = q.search.replace(/[%,()]/g, " ").trim();
    if (safe) query = query.or(`description.ilike.%${safe}%,counterparty.ilike.%${safe}%`);
  }

  const offset = (q.page - 1) * q.pageSize;
  query = query.order("created_at", { ascending: false }).range(offset, offset + q.pageSize - 1);

  const { data, error, count } = await query;
  if (error || !data) return { rows: [], total: 0 };
  return {
    rows: (data as Record<string, unknown>[]).map((r) => ({ ...r, amount: Number(r.amount) })) as Transaction[],
    total: count ?? 0,
  };
}
```
NOTE: `COLS` and `Transaction` already exist in this file from M3; reuse them. Ensure the new `import type` sits with the other imports at the top.

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/data/beneficiaries.ts lib/data/transfers.ts lib/data/transactions.ts
git commit -m "feat(m4): data layer (beneficiaries, transfers, paginated transactions)"
```

---

### Task 7: Server actions (transfers + beneficiaries)

**Files:**
- Create: `app/dashboard/transfers/actions.ts`, `app/dashboard/beneficiaries/actions.ts`

- [ ] **Step 1: `app/dashboard/transfers/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transferSchema } from "@/lib/validations/transfer";

export type TransferResult = { error: string } | { ok: true };

function mapTransferError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("insufficient")) return "You don't have enough funds for this transfer.";
  if (m.includes("same account")) return "Choose a different destination account.";
  if (m.includes("not active")) return "That account is not active.";
  if (m.includes("source account")) return "Source account not found.";
  if (m.includes("destination account")) return "Destination account not found.";
  if (m.includes("beneficiary")) return "Beneficiary not found.";
  return "We couldn't complete this transfer. Please try again.";
}

export async function executeTransfer(formData: FormData): Promise<TransferResult> {
  const raw = {
    mode: formData.get("mode"),
    fromAccountId: formData.get("fromAccountId"),
    toAccountId: formData.get("toAccountId") || undefined,
    beneficiaryId: formData.get("beneficiaryId") || undefined,
    amount: formData.get("amount"),
    reference: formData.get("reference") || undefined,
  };
  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const d = parsed.data;

  const supabase = createClient();
  const { error } = await supabase.rpc("execute_transfer", {
    p_from_account: d.fromAccountId,
    p_to_account: d.mode === "internal" ? d.toAccountId : null,
    p_beneficiary: d.mode === "external" ? d.beneficiaryId : null,
    p_amount: d.amount,
    p_kind: d.mode === "internal" ? "internal" : "external",
    p_reference: d.reference ?? null,
  });
  if (error) return { error: mapTransferError(error.message) };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transfers");
  revalidatePath("/dashboard/accounts");
  return { ok: true };
}
```

- [ ] **Step 2: `app/dashboard/beneficiaries/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { beneficiarySchema } from "@/lib/validations/beneficiary";

export type BeneficiaryResult = { error: string } | { ok: true };

function parse(formData: FormData) {
  return beneficiarySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    account_number: formData.get("account_number"),
    bank_name: formData.get("bank_name") || undefined,
    routing_number: formData.get("routing_number") || undefined,
    iban: formData.get("iban") || undefined,
  });
}

function toRow(d: ReturnType<typeof beneficiarySchema.parse>) {
  return {
    name: d.name,
    type: d.type,
    account_number: d.account_number,
    bank_name: d.bank_name || null,
    routing_number: d.routing_number || null,
    iban: d.iban || null,
  };
}

export async function createBeneficiary(formData: FormData): Promise<BeneficiaryResult> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { error } = await supabase.from("beneficiaries").insert({ ...toRow(parsed.data), user_id: user.id });
  if (error) return { error: "Could not save the beneficiary. Please try again." };
  revalidatePath("/dashboard/beneficiaries");
  return { ok: true };
}

export async function updateBeneficiary(id: string, formData: FormData): Promise<BeneficiaryResult> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const supabase = createClient();
  const { error } = await supabase.from("beneficiaries").update(toRow(parsed.data)).eq("id", id);
  if (error) return { error: "Could not update the beneficiary. Please try again." };
  revalidatePath("/dashboard/beneficiaries");
  return { ok: true };
}

export async function deleteBeneficiary(id: string): Promise<BeneficiaryResult> {
  const supabase = createClient();
  const { error } = await supabase.from("beneficiaries").delete().eq("id", id);
  if (error) return { error: "Could not delete the beneficiary. Please try again." };
  revalidatePath("/dashboard/beneficiaries");
  return { ok: true };
}
```
RLS scopes update/delete to the owner (M1 policies), so `.eq("id", id)` only affects the caller's rows.

- [ ] **Step 3: Verify** `npx tsc --noEmit` → 0 errors. If `error.message` typing on the rpc result complains, read it as `(error as { message: string }).message`.

- [ ] **Step 4: Commit**

```bash
git add "app/dashboard/transfers/actions.ts" "app/dashboard/beneficiaries/actions.ts"
git commit -m "feat(m4): transfer (RPC) + beneficiary server actions"
```

---

## Phase 4 — New UI primitives

### Task 8: Hand-authored Radix Select + Dialog

**Files:**
- Create: `components/ui/select.tsx`, `components/ui/dialog.tsx`
- Modify: `package.json` (install `@radix-ui/react-select`)

- [ ] **Step 1: Install**

```bash
npm install @radix-ui/react-select
```

- [ ] **Step 2: `components/ui/select.tsx`**

```tsx
"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-11 w-full items-center justify-between rounded-xl border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-card data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        position === "popper" && "data-[side=bottom]:translate-y-1",
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn("p-1", position === "popper" && "w-[var(--radix-select-trigger-width)]")}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem };
```

- [ ] **Step 3: `components/ui/dialog.tsx`**

```tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5", className)} {...props} />;
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-lg font-semibold", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
};
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/ui/select.tsx components/ui/dialog.tsx package.json package-lock.json
git commit -m "feat(m4): hand-authored Radix select + dialog primitives"
```

---

## Phase 5 — Beneficiaries

### Task 9: Beneficiary form + list + page

**Files:**
- Create: `components/dashboard/beneficiary-form.tsx`, `components/dashboard/beneficiary-list.tsx`, `app/dashboard/beneficiaries/page.tsx`

- [ ] **Step 1: `components/dashboard/beneficiary-form.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { beneficiarySchema, type BeneficiaryInput } from "@/lib/validations/beneficiary";
import { createBeneficiary, updateBeneficiary, type BeneficiaryResult } from "@/app/dashboard/beneficiaries/actions";
import type { Beneficiary } from "@/lib/data/beneficiaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

const fieldClass = "w-full";

export function BeneficiaryForm({
  trigger,
  beneficiary,
}: {
  trigger: React.ReactNode;
  beneficiary?: Beneficiary;
}) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BeneficiaryInput>({
    resolver: zodResolver(beneficiarySchema),
    defaultValues: beneficiary
      ? {
          name: beneficiary.name,
          type: beneficiary.type,
          account_number: beneficiary.account_number,
          bank_name: beneficiary.bank_name ?? undefined,
          routing_number: beneficiary.routing_number ?? undefined,
          iban: beneficiary.iban ?? undefined,
        }
      : { type: "external" },
  });

  function onSubmit(values: BeneficiaryInput) {
    setFormError(null);
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => fd.set(k, v ?? ""));
    startTransition(async () => {
      const result: BeneficiaryResult = beneficiary
        ? await updateBeneficiary(beneficiary.id, fd)
        : await createBeneficiary(fd);
      if ("error" in result) setFormError(result.error);
      else setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{beneficiary ? "Edit beneficiary" : "Add beneficiary"}</DialogTitle>
          <DialogDescription>Saved beneficiaries can receive external transfers.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          {formError && (
            <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
              {formError}
            </p>
          )}
          <div>
            <label htmlFor="bf-name" className="mb-1 block text-sm font-medium">Name</label>
            <Input id="bf-name" className={fieldClass} aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="bf-type" className="mb-1 block text-sm font-medium">Type</label>
            <select
              id="bf-type"
              className="flex h-11 w-full rounded-xl border border-input bg-background px-4 text-sm"
              {...register("type")}
            >
              <option value="external">External (other bank)</option>
              <option value="wire">Wire</option>
              <option value="internal">Internal</option>
            </select>
          </div>
          <div>
            <label htmlFor="bf-acct" className="mb-1 block text-sm font-medium">Account number</label>
            <Input id="bf-acct" className={fieldClass} aria-invalid={!!errors.account_number} {...register("account_number")} />
            {errors.account_number && <p className="mt-1 text-xs text-rose-500">{errors.account_number.message}</p>}
          </div>
          <div>
            <label htmlFor="bf-bank" className="mb-1 block text-sm font-medium">Bank name (optional)</label>
            <Input id="bf-bank" className={fieldClass} {...register("bank_name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bf-routing" className="mb-1 block text-sm font-medium">Routing (optional)</label>
              <Input id="bf-routing" className={fieldClass} {...register("routing_number")} />
            </div>
            <div>
              <label htmlFor="bf-iban" className="mb-1 block text-sm font-medium">IBAN (optional)</label>
              <Input id="bf-iban" className={fieldClass} {...register("iban")} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : beneficiary ? "Save changes" : "Add beneficiary"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```
NOTE: the `type` field uses a native `<select>` (registered with RHF) for simplicity and reliable form integration; the styled Radix `Select` from Task 8 is used elsewhere (transfer/transactions filters) where it isn't bound through `register`.

- [ ] **Step 2: `components/dashboard/beneficiary-list.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Beneficiary } from "@/lib/data/beneficiaries";
import { deleteBeneficiary } from "@/app/dashboard/beneficiaries/actions";
import { maskAccountNumber } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BeneficiaryForm } from "@/components/dashboard/beneficiary-form";

export function BeneficiaryList({ beneficiaries }: { beneficiaries: Beneficiary[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {beneficiaries.map((b) => (
        <Card key={b.id}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{b.name}</p>
                <p className="text-sm text-muted-foreground">{b.bank_name ?? "—"}</p>
              </div>
              <Badge variant="secondary">{b.type}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{maskAccountNumber(b.account_number)}</p>
            <div className="mt-4 flex gap-2">
              <BeneficiaryForm
                beneficiary={b}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Delete ${b.name}?`)) {
                    startTransition(() => {
                      void deleteBeneficiary(b.id);
                    });
                  }
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `app/dashboard/beneficiaries/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getBeneficiaries } from "@/lib/data/beneficiaries";
import { BeneficiaryForm } from "@/components/dashboard/beneficiary-form";
import { BeneficiaryList } from "@/components/dashboard/beneficiary-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Beneficiaries" };

export default async function BeneficiariesPage() {
  const beneficiaries = await getBeneficiaries();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Beneficiaries</h1>
        <BeneficiaryForm
          trigger={
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Add beneficiary
            </Button>
          }
        />
      </div>
      {beneficiaries.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-16 text-center text-sm text-muted-foreground">
            No beneficiaries yet. Add one to start sending external transfers.
          </CardContent>
        </Card>
      ) : (
        <BeneficiaryList beneficiaries={beneficiaries} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/beneficiary-form.tsx components/dashboard/beneficiary-list.tsx "app/dashboard/beneficiaries/page.tsx"
git commit -m "feat(m4): beneficiaries page (CRUD)"
```

---

## Phase 6 — Transfers

### Task 10: Transfer form + recent transfers + page

**Files:**
- Create: `components/dashboard/transfer-form.tsx`, `components/dashboard/recent-transfers.tsx`, `app/dashboard/transfers/page.tsx`

- [ ] **Step 1: `components/dashboard/transfer-form.tsx`**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { executeTransfer } from "@/app/dashboard/transfers/actions";
import type { Account } from "@/lib/data/accounts";
import type { Beneficiary } from "@/lib/data/beneficiaries";
import { formatCurrency, maskAccountNumber } from "@/lib/format";
import { accountTypeLabel } from "@/lib/dashboard/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "internal" | "external";

export function TransferForm({
  accounts,
  beneficiaries,
}: {
  accounts: Account[];
  beneficiaries: Beneficiary[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("internal");
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? "");
  const [beneficiaryId, setBeneficiaryId] = useState(beneficiaries[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fromAccount = useMemo(() => accounts.find((a) => a.id === fromId), [accounts, fromId]);
  const selectClass = "flex h-11 w-full rounded-xl border border-input bg-background px-4 text-sm";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (fromAccount && amt > fromAccount.balance) {
      setError("That amount exceeds your available balance.");
      return;
    }
    const fd = new FormData();
    fd.set("mode", mode);
    fd.set("fromAccountId", fromId);
    fd.set("amount", amount);
    fd.set("reference", reference);
    if (mode === "internal") fd.set("toAccountId", toId);
    else fd.set("beneficiaryId", beneficiaryId);

    startTransition(async () => {
      const result = await executeTransfer(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess("Transfer completed.");
        setAmount("");
        setReference("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="inline-flex rounded-xl border bg-muted p-1">
        {(["internal", "external"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium ${mode === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {m === "internal" ? "Between my accounts" : "To a beneficiary"}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{success}</p>}

      <div>
        <label htmlFor="tf-from" className="mb-1 block text-sm font-medium">From account</label>
        <select id="tf-from" className={selectClass} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {accountTypeLabel(a.type)} {maskAccountNumber(a.account_number)} — {formatCurrency(a.balance, a.currency)}
            </option>
          ))}
        </select>
      </div>

      {mode === "internal" ? (
        <div>
          <label htmlFor="tf-to" className="mb-1 block text-sm font-medium">To account</label>
          <select id="tf-to" className={selectClass} value={toId} onChange={(e) => setToId(e.target.value)}>
            {accounts.filter((a) => a.id !== fromId).map((a) => (
              <option key={a.id} value={a.id}>
                {accountTypeLabel(a.type)} {maskAccountNumber(a.account_number)} — {formatCurrency(a.balance, a.currency)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label htmlFor="tf-ben" className="mb-1 block text-sm font-medium">Beneficiary</label>
          {beneficiaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No beneficiaries yet. Add one on the Beneficiaries page first.
            </p>
          ) : (
            <select id="tf-ben" className={selectClass} value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)}>
              {beneficiaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.bank_name ? `· ${b.bank_name}` : ""} {maskAccountNumber(b.account_number)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label htmlFor="tf-amount" className="mb-1 block text-sm font-medium">Amount</label>
        <Input
          id="tf-amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {fromAccount && (
          <p className="mt-1 text-xs text-muted-foreground">Available: {formatCurrency(fromAccount.balance, fromAccount.currency)}</p>
        )}
      </div>

      <div>
        <label htmlFor="tf-ref" className="mb-1 block text-sm font-medium">Reference (optional)</label>
        <Input id="tf-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={140} />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={pending || accounts.length === 0 || (mode === "internal" ? accounts.length < 2 : beneficiaries.length === 0)}
      >
        {pending ? "Sending…" : "Send transfer"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: `components/dashboard/recent-transfers.tsx`**

```tsx
import type { Transfer } from "@/lib/data/transfers";
import { formatCurrency, formatTxnDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const KIND_LABEL: Record<string, string> = {
  internal: "Between accounts",
  external: "To beneficiary",
  wire: "Wire",
};

export function RecentTransfers({ transfers }: { transfers: Transfer[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent transfers</CardTitle>
      </CardHeader>
      <CardContent>
        {transfers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No transfers yet.</p>
        ) : (
          <ul className="divide-y">
            {transfers.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{KIND_LABEL[t.kind] ?? t.kind}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTxnDate(t.created_at)}
                    {t.reference ? ` · ${t.reference}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{formatCurrency(t.amount, t.currency)}</span>
                  <Badge variant={t.status === "completed" ? "success" : "secondary"}>{t.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: `app/dashboard/transfers/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getAccounts } from "@/lib/data/accounts";
import { getBeneficiaries } from "@/lib/data/beneficiaries";
import { getRecentTransfers } from "@/lib/data/transfers";
import { TransferForm } from "@/components/dashboard/transfer-form";
import { RecentTransfers } from "@/components/dashboard/recent-transfers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Transfers" };

export default async function TransfersPage() {
  const [accounts, beneficiaries, transfers] = await Promise.all([
    getAccounts(),
    getBeneficiaries(),
    getRecentTransfers(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Transfers</h1>
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-16 text-center text-sm text-muted-foreground">
            You need an account first.{" "}
            <Button asChild variant="link" className="px-1">
              <Link href="/dashboard">Set up demo data</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>New transfer</CardTitle>
            </CardHeader>
            <CardContent>
              <TransferForm accounts={accounts} beneficiaries={beneficiaries} />
            </CardContent>
          </Card>
          <RecentTransfers transfers={transfers} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/transfer-form.tsx components/dashboard/recent-transfers.tsx "app/dashboard/transfers/page.tsx"
git commit -m "feat(m4): transfers page (internal + external via atomic RPC)"
```

---

## Phase 7 — Transactions page

### Task 11: Filters + table + pagination components

**Files:**
- Create: `components/dashboard/transactions-filters.tsx`, `components/dashboard/transactions-table.tsx`, `components/dashboard/pagination.tsx`

- [ ] **Step 1: `components/dashboard/transactions-filters.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { Account } from "@/lib/data/accounts";
import { TRANSACTION_CATEGORIES, accountTypeLabel } from "@/lib/dashboard/constants";
import { Input } from "@/components/ui/input";

export function TransactionsFilters({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const selectClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm";

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page"); // reset to first page on filter change
      router.push(`/dashboard/transactions?${next.toString()}`);
    },
    [params, router]
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[12rem] flex-1">
        <label htmlFor="f-search" className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
        <Input
          id="f-search"
          defaultValue={params.get("search") ?? ""}
          placeholder="Description or counterparty"
          onKeyDown={(e) => {
            if (e.key === "Enter") update("search", (e.target as HTMLInputElement).value);
          }}
        />
      </div>
      <div>
        <label htmlFor="f-account" className="mb-1 block text-xs font-medium text-muted-foreground">Account</label>
        <select id="f-account" className={selectClass} defaultValue={params.get("accountId") ?? ""} onChange={(e) => update("accountId", e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{accountTypeLabel(a.type)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="f-type" className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
        <select id="f-type" className={selectClass} defaultValue={params.get("type") ?? ""} onChange={(e) => update("type", e.target.value)}>
          <option value="">All</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-cat" className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
        <select id="f-cat" className={selectClass} defaultValue={params.get("category") ?? ""} onChange={(e) => update("category", e.target.value)}>
          <option value="">All</option>
          {TRANSACTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="f-from" className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
        <input id="f-from" type="date" className={selectClass} defaultValue={params.get("from") ?? ""} onChange={(e) => update("from", e.target.value)} />
      </div>
      <div>
        <label htmlFor="f-to" className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
        <input id="f-to" type="date" className={selectClass} defaultValue={params.get("to") ?? ""} onChange={(e) => update("to", e.target.value)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `components/dashboard/transactions-table.tsx`**

```tsx
import type { Transaction } from "@/lib/data/transactions";
import { formatCurrency, formatTxnDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TransactionsTable({ rows }: { rows: Transaction[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No transactions match these filters.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-3 pr-4 font-medium">Date</th>
            <th className="py-3 pr-4 font-medium">Description</th>
            <th className="py-3 pr-4 font-medium">Category</th>
            <th className="py-3 pr-4 font-medium">Status</th>
            <th className="py-3 pl-4 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const credit = t.type === "credit";
            return (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-3 pr-4 text-muted-foreground">{formatTxnDate(t.created_at)}</td>
                <td className="py-3 pr-4">{t.description ?? t.counterparty ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{t.category}</td>
                <td className="py-3 pr-4 text-muted-foreground">{t.status}</td>
                <td className={cn("py-3 pl-4 text-right font-semibold", credit ? "text-success" : "text-foreground")}>
                  {credit ? "+" : "-"}
                  {formatCurrency(t.amount, t.currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: `components/dashboard/pagination.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function go(nextPage: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(nextPage));
    router.push(`/dashboard/transactions?${next.toString()}`);
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} · {total} transaction{total === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => go(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/transactions-filters.tsx components/dashboard/transactions-table.tsx components/dashboard/pagination.tsx
git commit -m "feat(m4): transactions filters, table, pagination components"
```

---

### Task 12: Transactions page + CSV export route

**Files:**
- Create: `app/dashboard/transactions/page.tsx`, `app/dashboard/transactions/export/route.ts`

- [ ] **Step 1: `app/dashboard/transactions/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { getAccounts } from "@/lib/data/accounts";
import { getTransactionsPage } from "@/lib/data/transactions";
import { parseTransactionQuery } from "@/lib/transactions/filters";
import { TransactionsFilters } from "@/components/dashboard/transactions-filters";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { Pagination } from "@/components/dashboard/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = parseTransactionQuery(searchParams);
  const [accounts, { rows, total }] = await Promise.all([
    getAccounts(),
    getTransactionsPage(query),
  ]);

  const exportParams = new URLSearchParams();
  Object.entries(searchParams).forEach(([k, v]) => {
    if (typeof v === "string" && v) exportParams.set(k, v);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">Transactions</h1>
        <Button asChild variant="outline">
          <a href={`/dashboard/transactions/export?${exportParams.toString()}`}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </a>
        </Button>
      </div>
      <Card>
        <CardContent className="space-y-5 p-5">
          <TransactionsFilters accounts={accounts} />
          <TransactionsTable rows={rows} />
          <Pagination page={query.page} pageSize={query.pageSize} total={total} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: `app/dashboard/transactions/export/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTransactionQuery } from "@/lib/transactions/filters";
import { getTransactionsPage } from "@/lib/data/transactions";
import { toCsv, type CsvRow } from "@/lib/transactions/csv";

const EXPORT_CAP = 1000;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/dashboard/transactions", request.url));
  }

  const query = parseTransactionQuery(request.nextUrl.searchParams);
  // Override pagination: export up to EXPORT_CAP rows of the filtered set.
  const { rows } = await getTransactionsPage({ ...query, page: 1, pageSize: EXPORT_CAP });

  const csvRows: CsvRow[] = rows.map((r) => ({
    created_at: r.created_at,
    description: r.description,
    category: r.category,
    type: r.type,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    counterparty: r.counterparty,
  }));

  return new NextResponse(toCsv(csvRows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="crest-transactions.csv"',
    },
  });
}
```

- [ ] **Step 3: Verify** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "app/dashboard/transactions/page.tsx" "app/dashboard/transactions/export/route.ts"
git commit -m "feat(m4): transactions page + CSV export route"
```

---

## Phase 8 — Docs & final verification

### Task 13: README M4 docs

**Files:** Modify `README.md`

- [ ] **Step 1: Add a "Transfers, Beneficiaries & Transactions (M4)" section** documenting:
  - Apply migration `0013_execute_transfer.sql` **after** 0001–0012. Note it also drops the
    client `accounts update` policy (balances now change only via the `execute_transfer` RPC).
  - Manual test plan: add a beneficiary; internal transfer between two accounts (both balances
    change; two transactions appear; recent transfers updates); external transfer to the
    beneficiary (source debited, one transaction); attempt a transfer over balance → "not
    enough funds", no change; attempt same-account internal → blocked; transactions page filter
    by account/type/category/date + search + paginate; Export CSV downloads the filtered set.
  - Note: all balance moves are atomic (single Postgres function); external transfers are
    recorded as completed (simulated — no real settlement).
  - Update **Roadmap**: mark M4 done.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: transfers/beneficiaries/transactions setup + test plan (M4)"
```

---

### Task 14: Final verification gate

- [ ] **Step 1: Tests** — `npm run test` → all pass (filters, csv, beneficiary, transfer + prior).
- [ ] **Step 2: Types** — `npx tsc --noEmit` → 0 errors.
- [ ] **Step 3: Lint** — `npm run lint` → 0 errors.
- [ ] **Step 4: Build** — `npm run build` → succeeds; routes include `/dashboard/beneficiaries`, `/dashboard/transfers`, `/dashboard/transactions`, and the `/dashboard/transactions/export` route; Middleware emitted. (Retry once on a fonts socket error; `dangerouslyDisableSandbox: true` if sandbox blocks npm.)
- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(m4): verification fixes"
```

---

## Self-Review Notes (coverage vs spec)

- §2 execute_transfer + drop accounts-update policy → Task 4. ✓
- §3 architecture (data layer, actions, pages, primitives) → Tasks 6,7,8,9,10,11,12. ✓
- §4 data flow (transfer/beneficiary/transactions+export) → Tasks 7,9,10,12. ✓
- §5 validation schemas → Task 1. ✓
- §6 UI (beneficiaries, transfers, transactions) → Tasks 9,10,11,12. ✓
- §7 new primitives (select, dialog) → Task 8. ✓
- §8 error handling (mapped RPC errors, export auth, delete FK-safe) → Tasks 7,9,12. ✓
- §9 security (RPC-only balance moves, policy drop, RLS, export gating, search sanitization) → Tasks 4,6,7,12. ✓
- §10 testing (filters, csv, schemas) → Tasks 1,2,3; manual plan → Task 13. ✓
- §11 acceptance criteria → Task 14 + manual plan. ✓

**Type consistency:** `TransactionQuery` (Task 2) consumed by `getTransactionsPage` (Task 6) and the page/export (Task 12). `Transaction`/`COLS` reused from M3 in Task 6. `CsvRow` (Task 3) built from `Transaction` in the export route (Task 12). `Account`/`Beneficiary` types flow into the transfer form (Task 10) and filters (Task 11). `executeTransfer`/`createBeneficiary`/`updateBeneficiary`/`deleteBeneficiary` signatures consistent between actions (Task 7) and forms (Tasks 9,10). RPC param names (`p_from_account`, …) match between the SQL (Task 4) and the action (Task 7). `createClient()` called synchronously throughout.
