# Crest Bank — Admin Panel — Design Spec

**Date:** 2026-06-20
**Status:** Approved for spec review
**Author:** Engineering (with Kene)
**Builds on:** the full customer app (M1–M5) + tours.

---

## 1. Goal

A staff **admin panel** to view and manage every user's data: list all users, open a user to see
their full picture (profile, total balance, income/spending this month, accounts, transactions,
cards, beneficiaries), and **edit** it — profile (incl. role & KYC), account balances (recorded as
adjustment transactions) and status, add/delete transactions, freeze/unfreeze cards, and manage
beneficiaries. Access is restricted to users whose `profiles.role = 'admin'`.

### Confirmed decisions
- **Authorization:** server-side **service-role** Supabase client (bypasses RLS) behind a
  `requireAdmin()` guard checked in the admin layout **and** every admin action.
- **Becoming admin:** SQL bootstrap once; thereafter admins can promote/demote others in-panel.
- **Balance edits:** writing a new balance also inserts an **"Adjustment"** credit/debit
  transaction for the difference.
- **Edit surface (v1):** profile (full_name, country, phone, role, kyc_status), account balance +
  status, **add/delete transactions**, card freeze/unfreeze, **beneficiary add/edit/delete**.
- **Entry:** an "Admin panel" link in the dashboard user menu, shown only to admins.

### Out of scope
- Creating/deleting **accounts** or **users** (users come from auth signups).
- Editing an existing transaction's fields (we support add + delete only — simpler & auditable).
- Audit log of admin actions, bulk operations, CSV export of admin views.
- No schema migration (role/KYC columns already exist).

---

## 2. Authorization & security (the core)

- **`lib/supabase/admin.ts`** — `createAdminClient()` builds a `@supabase/supabase-js` client with
  `process.env.SUPABASE_SERVICE_ROLE_KEY` and `{ auth: { persistSession: false, autoRefreshToken: false } }`.
  Server-only; **must never be imported by a client component**. It bypasses RLS, so it is only ever
  used *after* an admin check.
- **`lib/admin/guard.ts` → `requireAdmin()`** — uses the normal server client to `getUser()`; if no
  user → `redirect("/login?next=/admin")`. Reads that user's `profiles.role` (own row, allowed by
  RLS); if `role !== 'admin'` → `redirect("/dashboard")`. Returns `{ user }`. A non-redirecting
  `getAdminOrNull()` variant is used by server actions to return `{ error }` instead of redirecting.
- Called in **`app/admin/layout.tsx`** (gates all admin pages) and at the **top of every admin
  server action** (defense in depth — never trust the client).
- **Middleware:** add `/admin` to the protected prefixes in `resolveAuthRedirect` (unauth → login)
  and to the matcher; the role check itself stays in the layout/actions (avoids a per-request DB
  read in middleware).
- The service-role key is already in `.env` as `SUPABASE_SERVICE_ROLE_KEY` (server-only). This is
  the first feature to use it; it stays out of all client bundles.

---

## 3. Architecture

```
lib/supabase/admin.ts          # service-role client (server-only)
lib/admin/
  guard.ts                     # requireAdmin(), getAdminOrNull()
  data.ts                      # listUsers(), getUserDetail(userId) — via admin client
  adjustment.ts                # PURE: computeBalanceAdjustment(current,next), signedDelta(type,amount)
app/admin/
  layout.tsx                   # requireAdmin() + admin shell (header, "Back to app", sign out)
  page.tsx                     # users list + search
  users/[id]/page.tsx          # user detail (profile, insights, accounts, txns, cards, beneficiaries)
  actions.ts                   # all admin mutations (each requireAdmin/getAdminOrNull first)
components/admin/
  users-table.tsx              # client: searchable list, row links
  profile-editor.tsx           # client: edit profile + role + KYC
  account-editor.tsx           # client: edit balance (-> adjustment) + status
  transaction-manager.tsx      # client: add / delete transactions
  card-toggle.tsx              # client: freeze/unfreeze
  beneficiary-manager.tsx      # client: add/edit/delete beneficiaries (reuses beneficiary form fields)
lib/validations/admin.ts       # adminProfileSchema, adminBalanceSchema, adminTransactionSchema
                               #   (reuse beneficiarySchema from lib/validations/beneficiary)
middleware bits                # /admin protected prefix
components/dashboard/user-menu.tsx + app/dashboard/layout.tsx  # admin-only "Admin panel" link
```

### Boundaries
- **Pure** (`adjustment.ts`, validation schemas): unit-tested, no I/O.
- **Admin data layer** (`data.ts`): service-role reads; returns typed shapes; reuses
  `computeInsights` (from `lib/dashboard/insights`) for the per-user totals.
- **Actions** (`app/admin/actions.ts`): each guards with admin check, validates with Zod, mutates
  via the admin client, then `revalidatePath` the relevant admin route.
- **UI**: thin client components calling actions and rendering `{ error }`/success.

---

## 4. Data layer (`lib/admin/data.ts`, service-role)

- `listUsers(): Promise<AdminUserRow[]>` — fetch all `profiles` (id, full_name, country, role,
  kyc_status, created_at); fetch emails via `supabase.auth.admin.listUsers()` and map by id; fetch
  all `accounts` and aggregate **account count** + **total balance** per user. Returns rows:
  `{ id, email, full_name, role, kyc_status, accountCount, totalBalance, created_at }`.
- `getUserDetail(userId): Promise<AdminUserDetail | null>` — profile (+ email via
  `auth.admin.getUserById`), the user's `accounts`, recent `transactions` (e.g. latest 100, coerced),
  `cards`, `beneficiaries`, and computed `insights` (via `computeInsights(accounts, txns)`). Numeric
  columns coerced with `Number(...)` (Supabase returns numeric as strings).

> Pagination of the user list uses the auth admin API's default page (sufficient for this app's
> scale); the UI notes if more users exist than shown.

---

## 5. Pure logic (`lib/admin/adjustment.ts`)

```ts
export function signedDelta(type: "credit" | "debit", amount: number): number; // credit:+amount, debit:-amount
export function computeBalanceAdjustment(current: number, next: number):
  { type: "credit" | "debit"; amount: number } | null; // null when equal
```
- `computeBalanceAdjustment(100, 150)` → `{ type: "credit", amount: 50 }`;
  `(150, 100)` → `{ type: "debit", amount: 50 }`; equal → `null`.
- `signedDelta("credit", 10)` → `10`; `signedDelta("debit", 10)` → `-10`.
Used by the balance edit (to write the adjustment txn) and by add/delete-transaction (to move the
account balance by the transaction's signed amount).

---

## 6. Admin actions (`app/admin/actions.ts`) — all guard first

- `updateUserProfile(userId, formData)` — validate `adminProfileSchema` (full_name, country?, phone?,
  kyc_status); update `profiles`.
- `setUserRole(userId, role)` — role ∈ {customer, admin}; update `profiles.role`.
- `adjustAccountBalance(accountId, formData)` — parse `adminBalanceSchema` (newBalance ≥ 0); read the
  account (admin client), compute `computeBalanceAdjustment(current, next)`; if non-null, update
  `balance` and insert an `Adjustment` transaction (`type` from the result, category "Adjustment",
  description "Admin balance adjustment").
- `setAccountStatus(accountId, status)` — status ∈ {active, frozen, closed}.
- `addTransaction(accountId, formData)` — parse `adminTransactionSchema` (type, category, amount>0,
  description?); insert the transaction and move the account balance by `signedDelta(type, amount)`.
- `deleteTransaction(transactionId)` — read the txn; delete it; reverse the balance by
  `-signedDelta(type, amount)` on its account.
- `setCardStatus(cardId, status)` — status ∈ {active, frozen}.
- `createBeneficiary(userId, formData)` / `updateBeneficiary(beneficiaryId, formData)` /
  `deleteBeneficiary(beneficiaryId)` — validate with the existing `beneficiarySchema`; write with the
  admin client (so admins act on any user's beneficiaries), setting `user_id = userId` on create.

Each returns `{ error }` or `{ ok: true }` and `revalidatePath("/admin/users/<id>")` (+ `/admin` for
list-affecting changes). Mutations are owner-agnostic by design (admin), so they target by row id via
the service-role client.

---

## 7. UI / UX

- **Admin shell** (`/admin`): a simple top header ("Crest Admin", a "Back to app" link, sign out),
  distinct from the customer dashboard chrome so it's clearly the admin area.
- **Users list:** searchable table (search by name/email, client-side filter over the fetched set):
  columns email, name, role (badge), KYC (badge), # accounts, total balance, joined; each row links
  to the detail page.
- **User detail:** sections — **Profile** (editable form incl. role & KYC), **Insights** (total
  balance / income / spending cards), **Accounts** (per account: balance input + Save → adjustment,
  status select), **Transactions** (table + "Add transaction" form + per-row delete), **Cards**
  (freeze/unfreeze), **Beneficiaries** (add/edit/delete). Destructive actions (delete) confirm.
- Reuses existing primitives (Card, Button, Input, Badge, Dialog/Select). Accessible labels, inline
  errors, pending states. Clear "admin" visual treatment (e.g., a subtle banner) to avoid confusing
  it with a customer view.

---

## 8. Error handling

- Actions return `{ error }` for: not-admin (from `getAdminOrNull`), validation failures, and DB
  errors → friendly copy; success returns `{ ok: true }`/revalidates.
- `getUserDetail` returns `null` for an unknown id → the page calls `notFound()`.
- Balance edit with no change → no-op success. Delete-transaction reverses balance atomically enough
  for a demo (two sequential service-role writes; acceptable — note as a minor risk).
- Service-role failures (e.g., missing key in env) surface a clear "admin not configured" message.

---

## 9. Testing

- **Unit (Vitest):** `adjustment.ts` — `computeBalanceAdjustment` (credit/debit/equal) and
  `signedDelta` (credit/debit). `adminProfileSchema`/`adminBalanceSchema`/`adminTransactionSchema`
  validation. `computeInsights` already covered.
- **Manual (needs Supabase + an admin):** bootstrap admin via SQL; `/admin` lists users; non-admin
  visiting `/admin` is redirected; open a user → edit profile/role/KYC; adjust a balance → an
  Adjustment transaction appears and the dashboard total matches; add/delete a transaction → balance
  moves/reverts; freeze a card; add/edit/delete a beneficiary; the "Admin panel" link shows only for
  admins.

---

## 10. Acceptance criteria

1. A user with `role='admin'` can open `/admin`; a non-admin (or logged-out) is redirected away.
2. The users list shows every user with email, role, KYC, account count, and total balance; search works.
3. The user detail page shows profile, insights (total/income/spending), accounts, transactions,
   cards, and beneficiaries for that user.
4. Admin can edit profile fields incl. role and KYC; promote/demote between customer/admin.
5. Editing an account balance updates it and records an "Adjustment" transaction for the difference;
   account status can be changed.
6. Admin can add and delete transactions (account balance moves and reverts accordingly), freeze/
   unfreeze cards, and add/edit/delete beneficiaries.
7. The dashboard user menu shows "Admin panel" only for admins.
8. `npm run build`, `npm run lint`, `npx tsc --noEmit` pass; unit tests (adjustment + admin schemas) pass.
9. The service-role key is used only server-side; no admin module is imported by client code.

---

## 11. Bootstrap (documented in README)

```sql
-- one-time: make yourself an admin (replace the email)
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

---

## 12. Risks / open items

- **Service-role power:** bypasses RLS entirely, so the `requireAdmin()` guard on every entry point
  is the only thing protecting all users' data — it is applied in the layout and each action.
- **Non-atomic balance/txn pairs:** balance edits and add/delete-transaction perform two sequential
  writes (not a single DB transaction). For this demo that's acceptable; a future hardening could move
  them into a Postgres function like `execute_transfer`.
- **Last-admin demotion / self-demotion** is allowed (no guard); acceptable for the demo — noted.
- **User list scale:** relies on the auth admin API's default page size; fine at demo scale.
