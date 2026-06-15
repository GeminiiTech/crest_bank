# Crest Bank Dashboard & Accounts (M3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated dashboard shell, a populated Overview, and Accounts (list + detail with derived balance-history), plus a per-user demo-data seed.

**Architecture:** Server Components fetch RLS-scoped data via the synchronous server Supabase client and pass plain data to presentational components; charts and menus are thin client components (Recharts). All display math + demo-data shaping lives in pure, unit-tested modules. A `seedDemoData()` server action populates demo rows for users with no accounts.

**Tech Stack:** Next.js 14 App Router, TS strict, Tailwind v3 + classic Radix shadcn, Recharts, Vitest.

**Codebase facts to rely on (do NOT change):**
- `lib/supabase/server.ts` exports SYNC `createClient()` — call WITHOUT `await`.
- Supabase returns Postgres `numeric` columns (`balance`, `amount`) as **strings** — the data layer MUST coerce with `Number(...)`.
- Middleware already gates `/dashboard*`; pages still defensively redirect if no user.
- RLS: users can select/insert their own `accounts`; select/insert `transactions` for owned accounts; select/update own `notifications` (insert added in Task 5). `accounts`/`transactions` have no client update/delete.
- UI primitives: `Button` (asChild), `Card*`, `Badge` (variants default/secondary/success/outline), `Separator`, `Sheet*`, `Logo`, `cn`. Tokens: `bg-navy-950/900/800/700`, `bg-primary`, `text-primary`, `text-success`, `text-muted-foreground`, `font-display`, `shadow-card`, `max-w-7xl`. `lib/format`/`lib/dashboard` created here.
- Path alias `@/*` = repo root.

**Verification gates (per phase):** `npm run test`, `npx tsc --noEmit`, `npm run lint`. Run `npm run build` only at the final task (fonts fetch is flaky in-sandbox; retry once; use `dangerouslyDisableSandbox: true` if the sandbox blocks npm).

---

## Phase 1 — Pure logic + Recharts (TDD)

### Task 1: Install Recharts

**Files:** Modify `package.json` (via npm).

- [ ] **Step 1: Install**

```bash
npm install recharts
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → 0 errors (no usage yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(dashboard): add recharts"
```

---

### Task 2: Formatting helpers

**Files:**
- Create: `lib/format.ts`
- Test: `lib/__tests__/format.test.ts`

- [ ] **Step 1: Write failing test** — `lib/__tests__/format.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { formatCurrency, maskAccountNumber, formatTxnDate } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats USD with two decimals and grouping", () => {
    expect(formatCurrency(48250)).toBe("$48,250.00");
    expect(formatCurrency(12450.75)).toBe("$12,450.75");
  });
  it("formats negatives", () => {
    expect(formatCurrency(-129)).toBe("-$129.00");
  });
});

describe("maskAccountNumber", () => {
  it("shows only the last 4 digits", () => {
    expect(maskAccountNumber("100000004921")).toBe("•••• 4921");
  });
});

describe("formatTxnDate", () => {
  it("formats an ISO date as a short, UTC-stable string", () => {
    expect(formatTxnDate("2026-06-12T10:00:00.000Z")).toBe("Jun 12, 2026");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — `lib/format.ts`

```ts
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function maskAccountNumber(acc: string): string {
  return `•••• ${acc.slice(-4)}`;
}

export function formatTxnDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts lib/__tests__/format.test.ts
git commit -m "feat(dashboard): formatting helpers (currency, mask, date)"
```

---

### Task 3: Insights (spending, insights, balance history)

**Files:**
- Create: `lib/dashboard/insights.ts`
- Test: `lib/dashboard/__tests__/insights.test.ts`

- [ ] **Step 1: Write failing test** — `lib/dashboard/__tests__/insights.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { summarizeSpending, computeInsights, deriveBalanceHistory, type TxnLike } from "@/lib/dashboard/insights";

const now = new Date("2026-06-15T00:00:00.000Z");
const txns: TxnLike[] = [
  { type: "credit", category: "Salary", amount: 5000, created_at: "2026-06-01T00:00:00.000Z" },
  { type: "debit", category: "Groceries", amount: 200, created_at: "2026-06-05T00:00:00.000Z" },
  { type: "debit", category: "Groceries", amount: 100, created_at: "2026-06-10T00:00:00.000Z" },
  { type: "debit", category: "Dining", amount: 150, created_at: "2026-06-12T00:00:00.000Z" },
  { type: "debit", category: "Old", amount: 999, created_at: "2026-04-01T00:00:00.000Z" }, // prior month, excluded
];

describe("summarizeSpending", () => {
  it("groups current-month debits by category, sorted desc", () => {
    expect(summarizeSpending(txns, { now })).toEqual([
      { category: "Groceries", total: 300 },
      { category: "Dining", total: 150 },
    ]);
  });
});

describe("computeInsights", () => {
  it("computes balances, income, spending, net, savings rate, top category", () => {
    const r = computeInsights([{ balance: 1000 }, { balance: 500 }], txns, { now });
    expect(r.totalBalance).toBe(1500);
    expect(r.monthIncome).toBe(5000);
    expect(r.monthSpending).toBe(450);
    expect(r.netCashFlow).toBe(4550);
    expect(r.savingsRate).toBeCloseTo(0.91, 2);
    expect(r.topCategory).toBe("Groceries");
  });
  it("handles zero income without dividing by zero", () => {
    const r = computeInsights([], [], { now });
    expect(r.savingsRate).toBe(0);
    expect(r.topCategory).toBeNull();
  });
});

describe("deriveBalanceHistory", () => {
  it("reconstructs ascending per-day balances ending at the current balance", () => {
    const series = deriveBalanceHistory(1000, [
      { type: "credit", category: "x", amount: 200, created_at: "2026-06-10T00:00:00.000Z" },
      { type: "debit", category: "y", amount: 50, created_at: "2026-06-12T00:00:00.000Z" },
    ]);
    expect(series).toEqual([
      { date: "2026-06-10", balance: 1050 },
      { date: "2026-06-12", balance: 1000 },
    ]);
  });
  it("returns a single current point when there are no transactions", () => {
    const series = deriveBalanceHistory(500, [], { now });
    expect(series).toEqual([{ date: "2026-06-15", balance: 500 }]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — `lib/dashboard/insights.ts`

```ts
export type TxnLike = {
  type: "credit" | "debit";
  category: string;
  amount: number;
  created_at: string;
};

function isSameMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth()
  );
}

export function summarizeSpending(
  txns: TxnLike[],
  opts: { now?: Date } = {}
): { category: string; total: number }[] {
  const now = opts.now ?? new Date();
  const totals = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== "debit") continue;
    if (!isSameMonth(t.created_at, now)) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export type Insights = {
  totalBalance: number;
  monthIncome: number;
  monthSpending: number;
  netCashFlow: number;
  savingsRate: number;
  topCategory: string | null;
};

export function computeInsights(
  accounts: { balance: number }[],
  txns: TxnLike[],
  opts: { now?: Date } = {}
): Insights {
  const now = opts.now ?? new Date();
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  let monthIncome = 0;
  let monthSpending = 0;
  for (const t of txns) {
    if (!isSameMonth(t.created_at, now)) continue;
    if (t.type === "credit") monthIncome += t.amount;
    else monthSpending += t.amount;
  }
  const netCashFlow = monthIncome - monthSpending;
  const savingsRate = monthIncome > 0 ? netCashFlow / monthIncome : 0;
  const spending = summarizeSpending(txns, { now });
  return {
    totalBalance,
    monthIncome,
    monthSpending,
    netCashFlow,
    savingsRate,
    topCategory: spending.length > 0 ? spending[0].category : null,
  };
}

export function deriveBalanceHistory(
  currentBalance: number,
  txns: TxnLike[],
  opts: { points?: number; now?: Date } = {}
): { date: string; balance: number }[] {
  if (txns.length === 0) {
    const today = (opts.now ?? new Date()).toISOString().slice(0, 10);
    return [{ date: today, balance: currentBalance }];
  }
  const sorted = [...txns].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const net = sorted.reduce(
    (s, t) => s + (t.type === "credit" ? t.amount : -t.amount),
    0
  );
  let running = currentBalance - net; // balance before the earliest txn
  const byDate = new Map<string, number>();
  for (const t of sorted) {
    running += t.type === "credit" ? t.amount : -t.amount;
    byDate.set(t.created_at.slice(0, 10), running);
  }
  let series = [...byDate.entries()].map(([date, balance]) => ({ date, balance }));
  if (opts.points && series.length > opts.points) {
    series = series.slice(series.length - opts.points);
  }
  return series;
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/insights.ts lib/dashboard/__tests__/insights.test.ts
git commit -m "feat(dashboard): pure spending/insights/balance-history logic"
```

---

### Task 4: Demo-data generators

**Files:**
- Create: `lib/demo/seed-data.ts`
- Test: `lib/demo/__tests__/seed-data.test.ts`

- [ ] **Step 1: Write failing test** — `lib/demo/__tests__/seed-data.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  buildDemoAccounts,
  buildDemoTransactions,
  buildDemoNotifications,
} from "@/lib/demo/seed-data";

const now = new Date("2026-06-15T00:00:00.000Z");

describe("buildDemoAccounts", () => {
  it("returns a checking + savings account with positive balances and distinct numbers", () => {
    const accts = buildDemoAccounts(123);
    expect(accts).toHaveLength(2);
    expect(accts.map((a) => a.type).sort()).toEqual(["checking", "savings"]);
    expect(accts[0].account_number).not.toBe(accts[1].account_number);
    expect(accts.every((a) => a.balance > 0 && a.status === "active")).toBe(true);
  });
});

describe("buildDemoTransactions", () => {
  it("checking profile yields many dated debit+credit txns within 60 days", () => {
    const txns = buildDemoTransactions({ now, profile: "checking" });
    expect(txns.length).toBeGreaterThanOrEqual(20);
    expect(txns.some((t) => t.type === "credit")).toBe(true);
    expect(txns.some((t) => t.type === "debit")).toBe(true);
    const sixtyDaysAgo = now.getTime() - 60 * 24 * 60 * 60 * 1000;
    expect(txns.every((t) => new Date(t.created_at).getTime() >= sixtyDaysAgo)).toBe(true);
    expect(txns.every((t) => new Date(t.created_at).getTime() <= now.getTime())).toBe(true);
  });
  it("savings profile yields a smaller set", () => {
    const txns = buildDemoTransactions({ now, profile: "savings" });
    expect(txns.length).toBeGreaterThanOrEqual(3);
    expect(txns.length).toBeLessThan(12);
  });
});

describe("buildDemoNotifications", () => {
  it("returns notifications owned by the user", () => {
    const ns = buildDemoNotifications("user-1");
    expect(ns.length).toBeGreaterThanOrEqual(3);
    expect(ns.every((n) => n.user_id === "user-1" && n.title.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — `lib/demo/seed-data.ts`

```ts
export type AccountSeed = {
  account_number: string;
  type: "checking" | "savings";
  currency: string;
  balance: number;
  status: "active";
};

export type TxnSeed = {
  type: "credit" | "debit";
  category: string;
  amount: number;
  description: string;
  counterparty: string | null;
  created_at: string;
};

export type NotificationSeed = {
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
};

export function buildDemoAccounts(seed: number): AccountSeed[] {
  const base = 100000000000 + (Math.abs(seed) % 800000000000);
  return [
    { account_number: String(base), type: "checking", currency: "USD", balance: 12450.75, status: "active" },
    { account_number: String(base + 1), type: "savings", currency: "USD", balance: 36800.0, status: "active" },
  ];
}

const CHECKING: Omit<TxnSeed, "created_at">[] = [
  { type: "credit", category: "Salary", amount: 5400, description: "Monthly salary", counterparty: "Acme Corp" },
  { type: "debit", category: "Groceries", amount: 86.4, description: "Whole Foods", counterparty: "Whole Foods" },
  { type: "debit", category: "Dining", amount: 42.1, description: "Dinner", counterparty: "Olive & Vine" },
  { type: "debit", category: "Transport", amount: 18.75, description: "Ride", counterparty: "Uber" },
  { type: "debit", category: "Shopping", amount: 129.0, description: "Apparel", counterparty: "Uniqlo" },
  { type: "debit", category: "Utilities", amount: 64.3, description: "Electricity", counterparty: "City Power" },
  { type: "debit", category: "Groceries", amount: 53.2, description: "Trader Joe's", counterparty: "Trader Joe's" },
  { type: "debit", category: "Dining", amount: 27.5, description: "Coffee & lunch", counterparty: "Blue Bottle" },
  { type: "debit", category: "Entertainment", amount: 15.99, description: "Streaming", counterparty: "Netflix" },
  { type: "debit", category: "Transport", amount: 45.0, description: "Fuel", counterparty: "Shell" },
  { type: "debit", category: "Groceries", amount: 92.1, description: "Costco", counterparty: "Costco" },
  { type: "debit", category: "Shopping", amount: 220.0, description: "Electronics", counterparty: "Best Buy" },
  { type: "debit", category: "Dining", amount: 61.4, description: "Restaurant", counterparty: "Sushi Ko" },
  { type: "credit", category: "Refund", amount: 39.99, description: "Return refund", counterparty: "Amazon" },
  { type: "debit", category: "Utilities", amount: 39.5, description: "Internet", counterparty: "Comcast" },
  { type: "debit", category: "Health", amount: 25.0, description: "Pharmacy", counterparty: "CVS" },
  { type: "debit", category: "Groceries", amount: 47.8, description: "Groceries", counterparty: "Safeway" },
  { type: "debit", category: "Transport", amount: 12.25, description: "Transit", counterparty: "Metro" },
  { type: "debit", category: "Dining", amount: 33.6, description: "Brunch", counterparty: "The Mill" },
  { type: "credit", category: "Salary", amount: 5400, description: "Monthly salary", counterparty: "Acme Corp" },
  { type: "debit", category: "Shopping", amount: 74.2, description: "Home goods", counterparty: "IKEA" },
  { type: "debit", category: "Entertainment", amount: 49.0, description: "Concert", counterparty: "Tickets" },
];

const SAVINGS: Omit<TxnSeed, "created_at">[] = [
  { type: "credit", category: "Transfer", amount: 1000, description: "Transfer to savings", counterparty: "Self" },
  { type: "credit", category: "Interest", amount: 42.18, description: "Monthly interest", counterparty: "Crest Bank" },
  { type: "credit", category: "Transfer", amount: 750, description: "Transfer to savings", counterparty: "Self" },
  { type: "debit", category: "Transfer", amount: 300, description: "Transfer to checking", counterparty: "Self" },
  { type: "credit", category: "Interest", amount: 39.9, description: "Monthly interest", counterparty: "Crest Bank" },
];

export function buildDemoTransactions(opts: {
  now: Date;
  profile?: "checking" | "savings";
}): TxnSeed[] {
  const templates = opts.profile === "savings" ? SAVINGS : CHECKING;
  const dayMs = 24 * 60 * 60 * 1000;
  return templates.map((t, i) => ({
    ...t,
    created_at: new Date(opts.now.getTime() - i * 2 * dayMs).toISOString(),
  }));
}

export function buildDemoNotifications(userId: string): NotificationSeed[] {
  return [
    { user_id: userId, title: "Welcome to Crest Bank", body: "Your account is ready. Explore your dashboard.", type: "info", is_read: false },
    { user_id: userId, title: "Your card is on the way", body: "Your Crest debit card has shipped.", type: "info", is_read: false },
    { user_id: userId, title: "Security tip", body: "Enable two-factor authentication for extra protection.", type: "security", is_read: true },
  ];
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/demo/seed-data.ts lib/demo/__tests__/seed-data.test.ts
git commit -m "feat(dashboard): pure demo-data generators"
```

---

## Phase 2 — Migration, data layer, seed action

### Task 5: Migration 0012 — notifications insert policy

**Files:** Create `supabase/migrations/0012_notifications_insert_policy.sql`

- [ ] **Step 1: Create the file**

```sql
-- Allow users to insert their own notifications (needed by the per-user demo seed;
-- in production the service role / system creates notifications).
create policy "notifications insert own" on public.notifications
  for insert with check (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0012_notifications_insert_policy.sql
git commit -m "feat(db): notifications owner-insert policy (0012)"
```

---

### Task 6: Data layer

**Files:**
- Create: `lib/data/accounts.ts`, `lib/data/transactions.ts`, `lib/data/notifications.ts`

- [ ] **Step 1: `lib/data/accounts.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export type Account = {
  id: string;
  account_number: string;
  type: string;
  currency: string;
  balance: number;
  status: string;
};

const COLS = "id, account_number, type, currency, balance, status";

export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(COLS)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((a) => ({ ...a, balance: Number(a.balance) })) as Account[];
}

export async function getAccountById(id: string): Promise<Account | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return { ...data, balance: Number(data.balance) } as Account;
}
```

- [ ] **Step 2: `lib/data/transactions.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export type Transaction = {
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

const COLS =
  "id, account_id, type, category, amount, currency, status, description, counterparty, created_at";

function coerce(rows: Record<string, unknown>[]): Transaction[] {
  return rows.map((r) => ({ ...r, amount: Number(r.amount) })) as Transaction[];
}

export async function getRecentTransactions(limit = 6): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(COLS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return coerce(data);
}

export async function getAccountTransactions(
  accountId: string,
  limit = 50
): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(COLS)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return coerce(data);
}
```

- [ ] **Step 3: `lib/data/notifications.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
};

export async function getNotifications(limit = 5): Promise<Notification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, type, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as Notification[];
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/data
git commit -m "feat(dashboard): RLS-scoped data layer (accounts, transactions, notifications)"
```

---

### Task 7: Seed action

**Files:** Create `app/dashboard/actions.ts`

- [ ] **Step 1: Implement**

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  buildDemoAccounts,
  buildDemoTransactions,
  buildDemoNotifications,
} from "@/lib/demo/seed-data";

export type SeedResult = { error: string } | void;

export async function seedDemoData(): Promise<SeedResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase.from("accounts").select("id").limit(1);
  if (existing && existing.length > 0) return; // idempotent

  const now = new Date();
  const seed = Math.floor(now.getTime() % 800000000000);
  const accountRows = buildDemoAccounts(seed).map((a) => ({ ...a, user_id: user.id }));
  const { data: inserted, error: accErr } = await supabase
    .from("accounts")
    .insert(accountRows)
    .select("id, type");
  if (accErr || !inserted) {
    return { error: "Could not create demo accounts. Please try again." };
  }

  const txnRows = inserted.flatMap((acc) =>
    buildDemoTransactions({
      now,
      profile: acc.type === "savings" ? "savings" : "checking",
    }).map((t) => ({
      account_id: acc.id,
      type: t.type,
      category: t.category,
      amount: t.amount,
      currency: "USD",
      status: "completed",
      description: t.description,
      counterparty: t.counterparty,
      created_at: t.created_at,
    }))
  );
  const { error: txnErr } = await supabase.from("transactions").insert(txnRows);
  if (txnErr) {
    return { error: "Could not create demo transactions. Please try again." };
  }

  await supabase.from("notifications").insert(buildDemoNotifications(user.id));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/actions.ts
git commit -m "feat(dashboard): idempotent per-user demo seed action"
```

---

## Phase 3 — Dashboard shell

### Task 8: Sidebar nav config + Sidebar component

**Files:**
- Create: `lib/dashboard/nav.ts`, `components/dashboard/sidebar.tsx`

- [ ] **Step 1: `lib/dashboard/nav.ts`**

```ts
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Receipt,
  CreditCard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
};

export const dashboardNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, enabled: true },
  { label: "Accounts", href: "/dashboard/accounts", icon: Wallet, enabled: true },
  { label: "Transfers", href: "/dashboard/transfers", icon: ArrowLeftRight, enabled: false },
  { label: "Transactions", href: "/dashboard/transactions", icon: Receipt, enabled: false },
  { label: "Cards", href: "/dashboard/cards", icon: CreditCard, enabled: false },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, enabled: false },
];
```

- [ ] **Step 2: `components/dashboard/sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/shared/logo";
import { dashboardNav } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Dashboard">
      <div className="mb-6 px-2">
        <Logo inverted />
      </div>
      {dashboardNav.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        if (!item.enabled) {
          return (
            <span
              key={item.label}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-500"
              aria-disabled="true"
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.label}
              </span>
              <span className="rounded-full bg-navy-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                Soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard/nav.ts components/dashboard/sidebar.tsx
git commit -m "feat(dashboard): sidebar nav config + component"
```

---

### Task 9: User menu + Notifications popover + Topbar

**Files:**
- Create: `components/dashboard/user-menu.tsx`, `components/dashboard/notifications-popover.tsx`, `components/dashboard/topbar.tsx`
- Add shadcn primitives: `dropdown-menu`, `popover` — but DO NOT use the shadcn CLI (it pulls base-ui). Hand-author classic Radix versions (Step 1).

- [ ] **Step 1: Install Radix packages**

```bash
npm install @radix-ui/react-dropdown-menu @radix-ui/react-popover
```

- [ ] **Step 2: Create `components/ui/dropdown-menu.tsx`** (classic Radix shadcn — minimal subset used here)

```tsx
"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[12rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-card data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-3 py-2 text-sm font-semibold", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
```

- [ ] **Step 3: Create `components/ui/popover.tsx`** (classic Radix)

```tsx
"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "end", sideOffset = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-80 rounded-xl border bg-popover p-3 text-popover-foreground shadow-card outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };
```

- [ ] **Step 4: Create `components/dashboard/user-menu.tsx`**

```tsx
"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const initial = (name || email).charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Open user menu"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="flex flex-col">
          <span>{name}</span>
          <span className="text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-muted-foreground" disabled>
          <UserIcon className="mr-2 h-4 w-4" /> Profile (soon)
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: Create `components/dashboard/notifications-popover.tsx`**

```tsx
"use client";

import { Bell } from "lucide-react";
import type { Notification } from "@/lib/data/notifications";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export function NotificationsPopover({ notifications }: { notifications: Notification[] }) {
  const unread = notifications.filter((n) => !n.is_read).length;
  return (
    <Popover>
      <PopoverTrigger
        className="relative grid h-9 w-9 place-items-center rounded-full text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        )}
      </PopoverTrigger>
      <PopoverContent>
        <p className="px-1 pb-2 text-sm font-semibold">Notifications</p>
        {notifications.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ul className="space-y-1">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-lg px-2 py-2 hover:bg-accent">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 6: Create `components/dashboard/topbar.tsx`**

```tsx
"use client";

import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/dashboard/sidebar";
import { UserMenu } from "@/components/dashboard/user-menu";
import { NotificationsPopover } from "@/components/dashboard/notifications-popover";
import type { Notification } from "@/lib/data/notifications";

export function Topbar({
  name,
  email,
  notifications,
}: {
  name: string;
  email: string;
  notifications: Notification[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-navy-900 px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-navy-700 bg-navy-900 p-0">
            <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
            <SidebarNav />
          </SheetContent>
        </Sheet>
        <span className="font-display text-sm font-semibold text-white lg:hidden">Crest Bank</span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsPopover notifications={notifications} />
        <UserMenu name={name} email={email} />
      </div>
    </header>
  );
}
```

- [ ] **Step 7: Verify** — `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 8: Commit**

```bash
git add components/ui/dropdown-menu.tsx components/ui/popover.tsx components/dashboard package.json package-lock.json
git commit -m "feat(dashboard): topbar with user menu + notifications popover"
```

---

### Task 10: Dashboard layout shell

**Files:** Create `app/dashboard/layout.tsx` (replaces the M2 stub's own header — the stub `page.tsx` will be rewritten in Task 12).

- [ ] **Step 1: Implement**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/data/notifications";
import { SidebarNav } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";
  const notifications = await getNotifications();

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden bg-navy-900 lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <Topbar name={name} email={user.email ?? ""} notifications={notifications} />
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/layout.tsx
git commit -m "feat(dashboard): app shell layout (sidebar + topbar)"
```

---

## Phase 4 — Overview page

### Task 11: Overview presentational components

**Files:**
- Create: `components/dashboard/transaction-row.tsx`, `recent-transactions.tsx`, `balance-cards.tsx`, `insights.tsx`, `spending-chart.tsx`, `empty-state.tsx`, `seed-button.tsx`

- [ ] **Step 1: `components/dashboard/transaction-row.tsx`**

```tsx
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Transaction } from "@/lib/data/transactions";
import { formatCurrency, formatTxnDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TransactionRow({ txn }: { txn: Transaction }) {
  const credit = txn.type === "credit";
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full",
            credit ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          )}
        >
          {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{txn.description ?? txn.category}</p>
          <p className="text-xs text-muted-foreground">
            {txn.category} · {formatTxnDate(txn.created_at)}
          </p>
        </div>
      </div>
      <span className={cn("shrink-0 text-sm font-semibold", credit ? "text-success" : "text-foreground")}>
        {credit ? "+" : "-"}
        {formatCurrency(txn.amount, txn.currency)}
      </span>
    </li>
  );
}
```

- [ ] **Step 2: `components/dashboard/recent-transactions.tsx`**

```tsx
import Link from "next/link";
import type { Transaction } from "@/lib/data/transactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionRow } from "@/components/dashboard/transaction-row";

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent activity</CardTitle>
        <Link href="/dashboard/accounts" className="text-sm font-medium text-primary hover:underline">
          View accounts
        </Link>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="divide-y">
            {transactions.map((t) => (
              <TransactionRow key={t.id} txn={t} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: `components/dashboard/balance-cards.tsx`**

```tsx
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { Insights } from "@/lib/dashboard/insights";

export function BalanceCards({ insights }: { insights: Insights }) {
  const cards = [
    { label: "Total balance", value: insights.totalBalance, icon: Wallet, tone: "text-primary" },
    { label: "Income this month", value: insights.monthIncome, icon: TrendingUp, tone: "text-success" },
    { label: "Spending this month", value: insights.monthSpending, icon: TrendingDown, tone: "text-foreground" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className={`h-5 w-5 ${c.tone}`} />
            </div>
            <p className="mt-2 font-display text-2xl font-bold">{formatCurrency(c.value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `components/dashboard/insights.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { Insights } from "@/lib/dashboard/insights";

export function InsightsPanel({ insights }: { insights: Insights }) {
  const rows = [
    { label: "Net cash flow", value: formatCurrency(insights.netCashFlow) },
    { label: "Savings rate", value: `${Math.round(insights.savingsRate * 100)}%` },
    { label: "Top category", value: insights.topCategory ?? "—" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-semibold">{r.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: `components/dashboard/spending-chart.tsx`**

```tsx
"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export function SpendingChart({ data }: { data: { category: string; total: number }[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No spending this month yet.</p>;
  }
  return (
    <div role="img" aria-label="Spending by category this month" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis
            dataKey="category"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, "Spent"]}
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }}
          />
          <Bar dataKey="total" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="hsl(var(--primary))" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 6: `components/dashboard/seed-button.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { seedDemoData } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export function SeedButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await seedDemoData();
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Setting up…" : "Set up demo data"}
      </Button>
      {error && <p className="text-sm text-rose-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 7: `components/dashboard/empty-state.tsx`**

```tsx
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SeedButton } from "@/components/dashboard/seed-button";

export function DashboardEmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-7 w-7" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold">Set up your demo dashboard</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            You don&apos;t have any accounts yet. Create realistic sample accounts and
            transactions to explore the Crest Bank dashboard.
          </p>
        </div>
        <SeedButton />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 8: Verify** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 9: Commit**

```bash
git add components/dashboard
git commit -m "feat(dashboard): overview components (cards, chart, insights, activity, empty state)"
```

---

### Task 12: Overview page + loading skeleton

**Files:**
- Replace: `app/dashboard/page.tsx` (currently the M2 stub)
- Create: `app/dashboard/loading.tsx`

- [ ] **Step 1: Replace `app/dashboard/page.tsx`**

```tsx
import type { Metadata } from "next";
import { getAccounts } from "@/lib/data/accounts";
import { getRecentTransactions } from "@/lib/data/transactions";
import { getNotifications } from "@/lib/data/notifications";
import { computeInsights, summarizeSpending, type TxnLike } from "@/lib/dashboard/insights";
import { BalanceCards } from "@/components/dashboard/balance-cards";
import { SpendingChart } from "@/components/dashboard/spending-chart";
import { InsightsPanel } from "@/components/dashboard/insights";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const accounts = await getAccounts();

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-display text-2xl font-bold tracking-tight">Dashboard</h1>
        <DashboardEmptyState />
      </div>
    );
  }

  // Pull enough transactions to compute month aggregates + recent list.
  const recent = await getRecentTransactions(100);
  const txnLike: TxnLike[] = recent.map((t) => ({
    type: t.type,
    category: t.category,
    amount: t.amount,
    created_at: t.created_at,
  }));
  const insights = computeInsights(accounts, txnLike);
  const spending = summarizeSpending(txnLike);
  const notifications = await getNotifications();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
      <BalanceCards insights={insights} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingChart data={spending} />
          </CardContent>
        </Card>
        <InsightsPanel insights={insights} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions transactions={recent.slice(0, 6)} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/dashboard/loading.tsx`**

```tsx
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl bg-muted lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx app/dashboard/loading.tsx
git commit -m "feat(dashboard): overview page + loading skeleton"
```

---

## Phase 5 — Accounts

### Task 13: Account card + accounts list page

**Files:**
- Create: `components/dashboard/account-card.tsx`, `app/dashboard/accounts/page.tsx`

- [ ] **Step 1: `components/dashboard/account-card.tsx`**

```tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, maskAccountNumber } from "@/lib/format";
import type { Account } from "@/lib/data/accounts";

const TYPE_LABEL: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  current: "Current",
  business: "Business",
};

export function AccountCard({ account }: { account: Account }) {
  return (
    <Link href={`/dashboard/accounts/${account.id}`} className="block">
      <Card className="transition-shadow hover:shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {TYPE_LABEL[account.type] ?? account.type}
            </p>
            <Badge variant={account.status === "active" ? "success" : "secondary"}>
              {account.status}
            </Badge>
          </div>
          <p className="mt-4 font-display text-2xl font-bold">
            {formatCurrency(account.balance, account.currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {maskAccountNumber(account.account_number)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: `app/dashboard/accounts/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getAccounts } from "@/lib/data/accounts";
import { AccountCard } from "@/components/dashboard/account-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const accounts = await getAccounts();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Accounts</h1>
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">You don&apos;t have any accounts yet.</p>
            <Button asChild>
              <Link href="/dashboard">Go to dashboard to set up demo data</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/account-card.tsx app/dashboard/accounts/page.tsx
git commit -m "feat(dashboard): accounts list page"
```

---

### Task 14: Balance-history chart + account detail page

**Files:**
- Create: `components/dashboard/balance-history-chart.tsx`, `app/dashboard/accounts/[id]/page.tsx`

- [ ] **Step 1: `components/dashboard/balance-history-chart.tsx`**

```tsx
"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BalanceHistoryChart({ data }: { data: { date: string; balance: number }[] }) {
  return (
    <div role="img" aria-label="Balance history" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            formatter={(v: number) => [`$${v.toFixed(2)}`, "Balance"]}
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#balanceFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: `app/dashboard/accounts/[id]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAccountById } from "@/lib/data/accounts";
import { getAccountTransactions } from "@/lib/data/transactions";
import { deriveBalanceHistory, type TxnLike } from "@/lib/dashboard/insights";
import { formatCurrency, maskAccountNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BalanceHistoryChart } from "@/components/dashboard/balance-history-chart";
import { TransactionRow } from "@/components/dashboard/transaction-row";

export const metadata: Metadata = { title: "Account" };

const TYPE_LABEL: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  current: "Current",
  business: "Business",
};

export default async function AccountDetailPage({ params }: { params: { id: string } }) {
  const account = await getAccountById(params.id);
  if (!account) notFound();

  const transactions = await getAccountTransactions(account.id, 50);
  const txnLike: TxnLike[] = transactions.map((t) => ({
    type: t.type,
    category: t.category,
    amount: t.amount,
    created_at: t.created_at,
  }));
  const history = deriveBalanceHistory(account.balance, txnLike);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {TYPE_LABEL[account.type] ?? account.type}
            </p>
            <Badge variant={account.status === "active" ? "success" : "secondary"}>
              {account.status}
            </Badge>
          </div>
          <p className="mt-3 font-display text-3xl font-bold">
            {formatCurrency(account.balance, account.currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {maskAccountNumber(account.account_number)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Balance history</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceHistoryChart data={history} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y">
              {transactions.map((t) => (
                <TransactionRow key={t.id} txn={t} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/balance-history-chart.tsx "app/dashboard/accounts/[id]/page.tsx"
git commit -m "feat(dashboard): account detail with balance-history chart"
```

---

## Phase 6 — Docs & final verification

### Task 15: README dashboard docs

**Files:** Modify `README.md`

- [ ] **Step 1: Add a "Dashboard (M3)" section** documenting:
  - Apply migration `0012_notifications_insert_policy.sql` (after 0001–0011).
  - Manual test plan: log in → empty dashboard → "Set up demo data" → overview populates
    (balance cards, spending chart, insights, recent activity, notifications); clicking again
    does nothing (idempotent); Accounts list shows 2 accounts; open one → balance-history chart
    + transactions; a foreign/unknown account id → 404.
  - Note charts are Recharts; balance history is derived from transactions.
  - Update **Roadmap**: mark M3 done.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: dashboard setup + manual test plan (M3)"
```

---

### Task 16: Final verification gate

- [ ] **Step 1: Tests** — `npm run test` → all pass (format + insights + seed-data + prior).
- [ ] **Step 2: Types** — `npx tsc --noEmit` → 0 errors.
- [ ] **Step 3: Lint** — `npm run lint` → 0 errors.
- [ ] **Step 4: Build** — `npm run build` → succeeds; `/dashboard`, `/dashboard/accounts`, `/dashboard/accounts/[id]` compile (dynamic), Middleware emitted. (Retry once on a fonts socket error; `dangerouslyDisableSandbox: true` if sandbox blocks npm.)
- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(dashboard): M3 verification fixes"
```

---

## Self-Review Notes (coverage vs spec)

- §2 Architecture (shell, pages, data layer, pure layer, charts) → Tasks 6–14. ✓
- §3 Migration 0012 → Task 5. ✓
- §4 Pure functions (format, insights, balance history) → Tasks 2,3. ✓
- §4 Demo generators → Task 4. ✓
- §5 Seed action (idempotent, revalidate) → Task 7. ✓
- §6 UI (shell, overview, accounts list/detail, charts, empty state, loading) → Tasks 8–14. ✓
- §7 Error handling (empty/error states, notFound, seed error) → Tasks 6,7,11,12,14. ✓
- §8 Security (RLS-scoped reads, owner-only seed, notFound on foreign id) → Tasks 6,7,14. ✓
- §9 Recharts dependency → Task 1. ✓
- §10 Testing (format, insights, seed generators) → Tasks 2,3,4; manual plan → Task 15. ✓
- §11 Acceptance criteria → Task 16 + manual plan. ✓

**Type-consistency check:** `Account`/`Transaction`/`Notification` types defined in `lib/data/*` and imported by components. `TxnLike` from `lib/dashboard/insights` is the shape mapped from `Transaction` in pages (Tasks 12,14). `Insights` type produced by `computeInsights` and consumed by `BalanceCards`/`InsightsPanel`. `createClient()` called synchronously everywhere. Numeric coercion (`Number(...)`) applied in the data layer so `balance`/`amount` are numbers before reaching pure functions and `formatCurrency`. Seed action inserts use the generators' field names (incl. `counterparty`, `created_at`).
