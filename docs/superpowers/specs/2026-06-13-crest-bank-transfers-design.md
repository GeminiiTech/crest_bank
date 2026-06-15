# Crest Bank — Transfers, Beneficiaries & Transactions (Milestone 4) — Design Spec

**Date:** 2026-06-13
**Status:** Approved for spec review
**Author:** Engineering (with Kene)
**Builds on:** M1 foundation, M2 auth, M3 dashboard.

---

## 1. Goal

Add real money movement and transaction management: **beneficiaries** (CRUD), **transfers**
(internal between own accounts + external to a beneficiary), and a full **transactions page**
(search, filter, pagination, CSV export). Balance changes are performed by an **atomic
Postgres function**, never by multiple client writes.

### Confirmed decisions
- **Scope:** all three features in M4.
- **Transfer types:** internal (own→own, real atomic move) + external/wire (to a saved
  beneficiary; sender debited, recorded **completed (simulated)** — no settlement rail).
- **Balance moves:** a single `SECURITY DEFINER` Postgres function `execute_transfer(...)`
  (migration 0013) — atomic, row-locked, funds-checked, ownership-verified.
- **Beneficiaries:** own sidebar nav item + `/dashboard/beneficiaries` page (full CRUD).
- **Transactions page:** search + filter + server-side pagination + CSV export of the filtered set.

### Out of scope (later)
- Scheduled/recurring transfers; transfer approval flows; real external settlement.
- Editing/voiding posted transactions (financial immutability stands).
- Cards, settings (M5).

---

## 2. The atomic transfer function (migration 0013)

`public.execute_transfer(p_from_account uuid, p_to_account uuid, p_beneficiary uuid,
p_amount numeric, p_kind text, p_reference text default null) returns uuid`

- `language plpgsql security definer set search_path = public`.
- Reads `auth.uid()`; raises if null.
- Validates `p_amount > 0`.
- `select ... for update` locks the source account; verifies `user_id = auth.uid()` and
  `status = 'active'`; raises `Insufficient funds` if `balance < p_amount`.
- **internal:** requires `p_to_account` (≠ source), owned by the caller (locked too); decrement
  source, increment destination; insert a **debit** txn on source + **credit** txn on
  destination; insert one `transfers` row (`kind='internal'`, `status='completed'`). Returns its id.
- **external/wire:** requires `p_beneficiary` owned by caller; decrement source; insert a
  **debit** txn on source; insert a `transfers` row (`kind=p_kind`, `status='completed'`).
- Everything runs in the function's single transaction → all-or-nothing.
- `grant execute ... to authenticated`. The function is the ONLY path that mutates balances.

**Hardening (same migration 0013):** M1's `accounts update own` RLS policy currently lets a
client directly `update` its own row — including `balance`. Once money movement exists that is
a hole (a user could set their own balance). Nothing in M1–M5 needs client-side account
updates, so 0013 **drops** that policy:
`drop policy if exists "accounts update own" on public.accounts;`
The `SECURITY DEFINER` RPC runs as the table owner and bypasses RLS, so it can still update
balances; clients no longer can.

Raised exceptions carry stable messages (`Insufficient funds`, `Cannot transfer to the same
account`, `Source account not found`, `Destination account not found`, `Beneficiary not
found`, `Source account is not active`) which the server action maps to user-facing copy.

Idempotency note: transfers are not idempotent by design for M4; the UI disables the submit
button while pending to avoid double submits. (A client-supplied idempotency key is a future
enhancement.)

---

## 3. Architecture

```
app/dashboard/
  beneficiaries/page.tsx        # list + add/edit/delete
  beneficiaries/actions.ts      # create/update/delete beneficiary (Zod + RLS)
  transfers/page.tsx            # transfer form + recent transfers
  transfers/actions.ts          # executeTransfer() -> supabase.rpc("execute_transfer")
  transactions/page.tsx         # filters + paginated table + CSV button
  transactions/export/route.ts  # GET -> text/csv (auth + RLS, same filters)
components/dashboard/
  beneficiary-form.tsx          # client dialog form (RHF + Zod)
  beneficiary-list.tsx          # client: rows + edit/delete
  transfer-form.tsx             # client: mode toggle, account/beneficiary selects, amount
  recent-transfers.tsx          # server: list of recent transfers
  transactions-table.tsx        # server: results table
  transactions-filters.tsx      # client: filter controls -> updates searchParams
  pagination.tsx                # client: prev/next + page info (searchParams)
lib/
  data/beneficiaries.ts         # getBeneficiaries(), getBeneficiaryById(id)
  data/transfers.ts             # getRecentTransfers(limit)
  data/transactions.ts          # + getTransactionsPage(filters) -> { rows, total }
  validations/beneficiary.ts    # beneficiarySchema
  validations/transfer.ts       # transferSchema (discriminated by mode)
  transactions/filters.ts       # PURE: parseTransactionQuery(params) -> TransactionQuery
  transactions/csv.ts           # PURE: toCsv(rows) -> string
supabase/migrations/0013_execute_transfer.sql
lib/dashboard/nav.ts            # enable Transfers + Transactions; add Beneficiaries
```

### Boundaries
- **Pure layer** (`filters.ts`, `csv.ts`, validation schemas): no I/O, unit-tested.
- **Data layer**: RLS-scoped reads; `getTransactionsPage` builds a filtered, counted, ranged query.
- **Mutations**: transfers via the RPC (server action); beneficiaries via owner-scoped
  inserts/updates/deletes (server actions). All server-side; Zod-validated.
- **UI**: client forms call server actions and render returned `{ error }`.

---

## 4. Data flow

### Transfer
1. User picks mode (my accounts / beneficiary), source, target, amount, optional reference.
2. Client Zod validation (positive amount; client also blocks amount > selected source balance for UX).
3. `executeTransfer(formData)` re-validates with `transferSchema`, then
   `supabase.rpc("execute_transfer", { p_from_account, p_to_account, p_beneficiary, p_amount, p_kind, p_reference })`.
4. RPC error → map to friendly `{ error }`. Success → `revalidatePath("/dashboard")`,
   `/dashboard/transfers`, `/dashboard/accounts`; return a success marker; UI refreshes and
   shows the updated source balance.

### Beneficiary CRUD
- create/update/delete server actions validate with `beneficiarySchema` and write owner rows
  (RLS enforces `auth.uid() = user_id`). `revalidatePath("/dashboard/beneficiaries")`.

### Transactions page + export
- Page reads `searchParams` → `parseTransactionQuery` → `getTransactionsPage` → table + pagination.
- Filters: `accountId?`, `type? (credit|debit)`, `category?`, `search?` (ilike on description/counterparty),
  `from?`/`to?` (date range on created_at), `page`, `pageSize` (clamped, default 20, max 100).
- Pagination uses Supabase `.range(offset, offset+pageSize-1)` + `{ count: "exact" }` for total.
- Export route applies the same parsed query (no pagination → capped at a safe max, e.g. 1000
  rows) and returns `text/csv` with `Content-Disposition: attachment`.

---

## 5. Validation

`lib/validations/beneficiary.ts` — `beneficiarySchema`:
- name (min 2), type (`internal|external|wire`), account_number (min 4),
  bank_name (optional), routing_number (optional), iban (optional).

`lib/validations/transfer.ts` — `transferSchema` (discriminated union on `mode`):
- `mode: "internal"`: fromAccountId (uuid), toAccountId (uuid), amount (> 0), reference (optional);
  refine fromAccountId ≠ toAccountId.
- `mode: "external"`: fromAccountId (uuid), beneficiaryId (uuid), amount (> 0), reference (optional).
- Amount parsed from string to number with 2-dp precision; reject ≤ 0 / NaN.

Server actions re-parse with these schemas (source of truth). The RPC independently enforces
funds/ownership.

---

## 6. UI / UX

- **Beneficiaries page:** header + "Add beneficiary" → dialog form; a list/table of saved
  beneficiaries (name, bank, masked account number, type badge) with edit/delete (delete
  confirms). Empty state when none.
- **Transfers page:** a card with a segmented control (Between my accounts / To a beneficiary).
  Internal: from-account select + to-account select (each shows type + balance); external:
  from-account select + beneficiary select. Amount input (currency-formatted helper text shows
  source balance), optional reference, submit (disabled while pending). Inline error banner.
  A "Recent transfers" list below. Link to add a beneficiary when none exist.
- **Transactions page:** filter bar (account, type, category, date range, search) that updates
  the URL; a responsive table (date, description, category, account, amount with credit/debit
  styling, status); pagination controls; a "Export CSV" button reflecting current filters.
- Reuses the M3 dashboard shell, tokens, `Card`, `Badge`, `Button`, `Input`, plus a new
  `select` and `dialog` primitive (hand-authored classic Radix — do NOT use `shadcn add`).
- **A11y:** labeled controls, dialog focus trap (Radix), `aria-live` on transfer result,
  keyboard-operable selects/pagination.

---

## 7. New UI primitives (hand-authored, classic Radix)

- `components/ui/select.tsx` — wraps `@radix-ui/react-select`.
- `components/ui/dialog.tsx` — wraps `@radix-ui/react-dialog` (separate from the existing
  `sheet.tsx`, which also uses the dialog primitive — that's fine; distinct components).
- `components/ui/label.tsx` — wraps `@radix-ui/react-label` (optional; plain `<label>` is
  acceptable). Use plain labels to avoid an extra dep unless needed.

New deps: `@radix-ui/react-select` (and `@radix-ui/react-dialog` is already installed).

---

## 8. Error handling

- Server actions return `{ error }` for expected failures (validation, mapped RPC errors);
  never throw to the client for those. `redirect()`/`revalidatePath` for success.
- RPC exception messages mapped: insufficient funds, same-account, inactive account,
  not-found (source/destination/beneficiary), invalid kind → friendly copy; unknown → generic.
- Export route: if not authenticated → 401/redirect; if query invalid → 400 with a message;
  empty result → a CSV with headers only.
- Beneficiary delete that is referenced by past transfers is fine (`beneficiary_id` is
  `on delete set null`), so deletes never fail on FK.

---

## 8a. Data-integrity note

`transfers.beneficiary_id` is `on delete set null` and `to_account_id` likewise, so historical
transfers survive beneficiary/account deletion (the row remains, the link nulls). Transactions
created by the RPC are immutable (no client update/delete), preserving the ledger.

---

## 9. Security

- **All balance mutation flows through `execute_transfer`** — atomic, row-locked, funds- and
  ownership-checked via `auth.uid()`. The M1 `accounts update own` policy is **dropped** in
  0013, so clients can no longer write `accounts` (incl. `balance`) directly — only the RPC can.
- Beneficiary/transfer reads + beneficiary writes are RLS-scoped to the owner.
- The RPC is `SECURITY DEFINER` but authorizes every account/beneficiary against `auth.uid()`
  before acting; `search_path` pinned to `public`.
- Export route is auth-gated (middleware + defensive `getUser`) and RLS-scoped; output capped
  to avoid unbounded responses.
- Inputs Zod-validated and parameterized; amounts coerced/clamped server-side.

---

## 10. Testing

**Unit (Vitest, no DB):**
- `transactions/filters.ts`: defaults (page=1, pageSize=20), clamps (page≥1, pageSize≤100),
  parses type/category/search/date, ignores invalid values.
- `transactions/csv.ts`: header row, field order, escaping of commas/quotes/newlines, amount
  sign formatting, empty input → headers only.
- `validations/beneficiary.ts`: required name/account_number/type; optional fields.
- `validations/transfer.ts`: internal requires distinct from/to; external requires beneficiary;
  amount > 0; bad amount rejected.

**Manual (against Supabase with 0013 applied)** — README plan: internal transfer moves money
between two own accounts (both balances change, two transactions appear); external transfer
debits source + records the transfer + one transaction; insufficient funds rejected with the
right message; same-account rejected; a transfer using another user's account/beneficiary id
fails; transactions page filters + paginates; CSV export downloads the filtered set.

---

## 11. Acceptance criteria

1. Internal transfer between two of the user's accounts atomically debits one and credits the
   other, creates a debit+credit transaction pair and a `completed` transfer; new balances show.
2. External transfer to a beneficiary debits the source, creates one debit transaction and a
   `completed` transfer; the beneficiary is unaffected.
3. Insufficient funds, same-account, and foreign-account/beneficiary attempts are rejected with
   clear messages and **no balance change**.
4. Beneficiaries can be created, edited, and deleted; transfers can select them.
5. Transactions page filters (account/type/category/date/search), paginates server-side, and
   exports the filtered set to CSV.
6. `npm run build`, `npm run lint`, `npx tsc --noEmit` pass; unit tests (filters, csv, schemas) pass.
7. Migration `0013` documented; README manual test plan updated; nav shows Beneficiaries,
   Transfers, Transactions enabled; roadmap marks M4 done.

---

## 12. Risks / open items

- **0013 can't run in CI here** — validated by careful review + the manual test plan; applied by
  the user (after 0001–0012).
- **Concurrency:** `for update` row locks serialize concurrent transfers on the same source
  account, preventing double-spend. Cross-account deadlock risk is minimal (lock order is
  source-then-destination; acceptable for this app's scale).
- **No idempotency key** in M4 — mitigated by disabling submit while pending; a future
  enhancement can add a client token + unique constraint.
- **CSV export cap** (e.g. 1000 rows) is a deliberate safety bound; documented in the UI when hit.
