# Crest Bank — Dashboard & Accounts (Milestone 3) — Design Spec

**Date:** 2026-06-12
**Status:** Approved for spec review
**Author:** Engineering (with Kene)
**Builds on:** [M1 foundation](2026-06-12-crest-bank-foundation-design.md), [M2 auth](2026-06-12-crest-bank-auth-design.md)

---

## 1. Goal

Build the authenticated customer experience: a persistent **dashboard shell**, a **Dashboard
Overview** (balances, recent activity, spending, insights, notifications), and **Accounts**
(list + per-account detail with a derived balance-history chart and the account's
transactions). Include a **per-user demo-data seed** so a freshly registered user sees a
populated, realistic dashboard.

### Confirmed decisions
- **Scope:** Dashboard Overview + Accounts (list + detail). (Transfers/Transactions/Cards/Settings remain stubs → M4/M5.)
- **Data:** Server Components query Supabase directly (server client, RLS-scoped). A
  `seedDemoData()` server action populates accounts/transactions/notifications for the
  current user when they have none.
- **Charts:** Recharts, wrapped in thin client components styled with our Tailwind tokens.
  Do NOT use the shadcn chart CLI (it pulls the incompatible base-ui flavor).
- **Nav shell:** persistent left sidebar + topbar; collapses to a drawer on mobile.
- **Balance history:** derived (running balance from transactions), no new history table.
- **Migration 0012:** add `notifications insert own` RLS policy (needed by the seed).

### Out of scope (later milestones)
- Transfers, beneficiaries, the full transactions page (search/filter/pagination/export) → M4.
- Cards, settings/profile editing → M5.
- Real money movement; balances are static demo values mutated only by the seed.

---

## 2. Architecture

```
app/dashboard/
  layout.tsx                 # shell: sidebar + topbar; loads user + profile once
  page.tsx                   # Overview (server component)
  accounts/page.tsx          # Accounts list (server component)
  accounts/[id]/page.tsx     # Account detail (server component, notFound on miss)
  actions.ts                 # "use server": seedDemoData()
components/dashboard/
  sidebar.tsx                # client: active-link state + mobile drawer
  topbar.tsx                 # mobile menu trigger + notifications + user menu
  user-menu.tsx              # client: name/email + sign out
  notifications-popover.tsx  # client: bell + recent notifications
  balance-cards.tsx          # summary stat cards
  recent-transactions.tsx    # latest activity list (shared row renderer)
  transaction-row.tsx        # one transaction line (icon, desc, date, amount)
  spending-chart.tsx         # client: Recharts bar — spend by category
  balance-history-chart.tsx  # client: Recharts area — running balance
  insights.tsx               # computed insight tiles
  account-card.tsx           # one account summary card
  empty-state.tsx            # "no accounts yet" + seed button
  seed-button.tsx            # client: calls seedDemoData(), pending state
lib/
  data/
    accounts.ts              # getAccounts(), getAccountById(id)
    transactions.ts          # getRecentTransactions(limit), getAccountTransactions(accountId)
    notifications.ts         # getNotifications(limit)
  dashboard/
    insights.ts              # PURE: summarizeSpending, computeInsights, deriveBalanceHistory
  format.ts                  # PURE: formatCurrency, maskAccountNumber, formatTxnDate
  demo/seed-data.ts          # PURE: buildDemoAccounts/Transactions/Notifications generators
supabase/migrations/
  0012_notifications_insert_policy.sql
```

### Boundaries
- **Pure layer** (`format.ts`, `dashboard/insights.ts`, `demo/seed-data.ts` generators):
  no I/O, fully unit-tested. All display math and demo-data shaping lives here.
- **Data layer** (`lib/data/*`): thin async functions using the server Supabase client;
  RLS scopes every read to the current user. Each returns typed rows.
- **Server components** (pages/layout): call the data layer, pass plain data to presentational
  components. The shell loads the user once and guards (middleware already gates `/dashboard*`).
- **Client components**: only where interactivity is required (charts, menus, drawer, seed
  button). They receive already-fetched, already-computed data as props.

---

## 3. Data model usage (no schema changes except 0012)

Reads use existing M1 tables via RLS:
- `accounts` (user-owned): id, account_number, type, currency, balance, status.
- `transactions` (account-owned): id, account_id, type (credit/debit), category, amount,
  currency, status, description, counterparty, created_at.
- `notifications` (user-owned): id, title, body, type, is_read, created_at.
- `profiles`: full_name for the greeting/user menu.

### Migration 0012
```sql
create policy "notifications insert own" on public.notifications
  for insert with check (auth.uid() = user_id);
```
Appended as a new migration (M1 migrations are immutable contracts; this is additive).

---

## 4. Pure functions (the testable core)

### `lib/format.ts`
- `formatCurrency(amount: number, currency = "USD"): string` — `Intl.NumberFormat`,
  2 fraction digits. e.g. `formatCurrency(48250)` → `"$48,250.00"`.
- `maskAccountNumber(acc: string): string` — show last 4, mask the rest:
  `"•••• 4921"` (groups masked; never reveals more than last 4).
- `formatTxnDate(iso: string): string` — short, locale-stable (`"Jun 12, 2026"`).

### `lib/dashboard/insights.ts`
Types: `TxnLike = { type: "credit" | "debit"; category: string; amount: number; created_at: string }`.
- `summarizeSpending(txns: TxnLike[], opts?: { now?: Date }): { category: string; total: number }[]`
  — sum of **debit** amounts grouped by category for the current calendar month, sorted desc.
- `computeInsights(accounts: { balance: number }[], txns: TxnLike[], opts?): { totalBalance, monthIncome, monthSpending, netCashFlow, savingsRate, topCategory }`
  — income = sum of this-month credits; spending = sum of this-month debits; netCashFlow =
  income − spending; savingsRate = income > 0 ? netCashFlow/income : 0; topCategory from
  `summarizeSpending`.
- `deriveBalanceHistory(currentBalance: number, txns: TxnLike[], opts?: { points?: number }): { date: string; balance: number }[]`
  — walk transactions newest→oldest subtracting credits / adding debits to reconstruct prior
  balances, producing an ascending-date series (one point per transaction day, deduped),
  ending at `currentBalance`.

### `lib/demo/seed-data.ts`
- `buildDemoAccounts(userId)` → 2 account insert objects (checking + savings, realistic
  numbers, status active). `account_number` generated unique (timestamp/random based).
- `buildDemoTransactions(accountId, opts?)` → ~25 transaction insert objects spread over the
  last ~60 days across categories (Groceries, Dining, Transport, Salary, Utilities, Shopping,
  Transfers), mix of credit/debit, amounts summing to a plausible net.
- `buildDemoNotifications(userId)` → 3 notification objects (e.g. "Welcome to Crest Bank",
  "Your card is ready", "Security tip").
These are pure generators (deterministic given inputs except where randomness is explicitly
seeded/!needed); the action below performs the inserts.

---

## 5. Seed action (`app/dashboard/actions.ts`)

```
"use server"
seedDemoData():
  - get user (server client). If none → redirect /login.
  - if user already has ≥1 account → return (idempotent; no duplicate seeding).
  - insert buildDemoAccounts(user.id) → returns account ids.
  - for each account insert its buildDemoTransactions(accountId).
  - insert buildDemoNotifications(user.id).
  - revalidatePath("/dashboard") and revalidatePath("/dashboard/accounts").
```
All inserts run under the user's session (anon key + RLS) — permitted by the existing
account/transaction owner policies plus the new 0012 notifications policy. Errors return a
friendly `{ error }` surfaced by the seed button.

---

## 6. UI / UX

- **Shell:** left sidebar (Logo, nav items, sign-out at bottom on mobile), topbar (mobile menu
  button, notifications bell, user menu). Nav items: **Dashboard**, **Accounts** (active links);
  **Transfers, Transactions, Cards, Settings** rendered disabled with a small "Soon" badge.
  Active item highlighted. Background uses the light app surface with navy sidebar.
- **Overview:** responsive grid — top row: 3 balance cards (Total balance, Income this month,
  Spending this month). Then a two-column area: left = spending-by-category chart + insights
  tiles; right = recent transactions (6) + notifications preview. Empty state replaces all of
  this when the user has no accounts.
- **Accounts list:** grid of `account-card`s (type label, masked number, balance prominent,
  status pill). Each links to `/dashboard/accounts/{id}`.
- **Account detail:** header (type, masked number, big balance, status), balance-history area
  chart, then the account's transactions list (most recent first, reasonable cap e.g. 50).
- **Charts:** Recharts, themed to tokens (azure primary, mint success, navy grid), responsive
  containers, accessible (title + description, `role="img"` wrapper with an aria-label
  summarizing the data; tabular fallback not required for M3).
- **Accessibility:** semantic landmarks, keyboard-operable menus/drawer (Radix), focus rings,
  `aria-current="page"` on active nav, sufficient contrast on the navy sidebar.
- **Loading:** `loading.tsx` skeletons for the overview and account detail (Suspense-friendly).

---

## 7. Error handling

- Data-layer query errors are caught and surfaced as empty/error states (never crash the page);
  a failed read renders a small "Couldn't load this section" message where that section sits.
- `getAccountById` returning null (not found or not owned) → `notFound()` (404).
- Seed action failures return `{ error }`; the seed button shows it inline and re-enables.
- Unauthenticated access is already prevented by middleware; pages still defensively
  `redirect("/login")` if `getUser()` is null.

---

## 8. Security

- Every read is RLS-scoped (server client, anon key) — a user can only ever see their own
  accounts/transactions/notifications; account detail can't be accessed cross-user (RLS →
  null → 404).
- The seed action only writes rows owned by the current user; it cannot affect other users.
- 0012 grants insert **only** for `auth.uid() = user_id`; financial-immutability policies
  (no client update/delete on transactions) are unchanged.
- No service-role key used; nothing privileged on the client.

---

## 9. Dependencies

- Add **`recharts`** (charts). Client-only usage. No other new deps.

---

## 10. Testing

**Unit (Vitest, no DB):**
- `format.ts`: currency formatting, account masking (only last 4 shown), date formatting.
- `dashboard/insights.ts`: `summarizeSpending` (groups debits by category, current month only,
  sorted), `computeInsights` (income/spending/net/savingsRate/topCategory incl. zero-income
  edge), `deriveBalanceHistory` (reconstructs prior balances, ascending dates, ends at current).
- `demo/seed-data.ts`: generators produce the expected counts/shapes (2 accounts; ~25 txns with
  valid types/categories/dates within 60 days; 3 notifications) and valid required fields.

**Manual (against the user's Supabase project)** — updated README plan: log in → empty
dashboard → click "Set up demo data" → overview populates (balances, chart, recent txns,
notifications); seeding again does nothing (idempotent); Accounts list shows 2 accounts;
open an account → balance-history chart + its transactions; verify another user sees none of
this.

---

## 11. Acceptance criteria

1. `/dashboard` shows the shell (sidebar + topbar) for an authenticated user; nav marks the
   active page; mobile drawer works.
2. A user with no accounts sees the empty state; clicking "Set up demo data" creates 2
   accounts + transactions + notifications and the overview populates. Re-running is a no-op.
3. Overview shows: 3 balance cards with correct totals, spending-by-category chart, computed
   insights, 6 recent transactions, and a notifications preview.
4. `/dashboard/accounts` lists the user's accounts with masked numbers and balances; each
   links to detail.
5. `/dashboard/accounts/{id}` shows the account header, a balance-history chart, and that
   account's transactions; an unknown/foreign id returns 404.
6. `npm run build`, `npm run lint`, `npx tsc --noEmit` pass; unit tests for format + insights +
   seed generators pass.
7. Migration `0012` applies cleanly and is documented; README manual test plan updated;
   roadmap marks M3 done.

---

## 12. Risks / open items

- **Recharts in RSC:** charts must be client components (`"use client"`) receiving data as
  props; server components do the fetching. Keep the boundary clean to avoid SSR issues.
- **Live data** can't be exercised in CI here; pure logic is unit-tested and the seed +
  manual plan cover the integration path (needs the user's Supabase project with M1+M2+0012
  applied).
- **Balance history is reconstructed**, so it's an approximation of past balances based on
  recorded transactions — acceptable and clearly a derived view, not an audited ledger.
