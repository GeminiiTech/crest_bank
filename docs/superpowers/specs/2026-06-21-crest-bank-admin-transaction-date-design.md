# Crest Bank — Editable Transaction Dates (Admin) — Design Spec

**Date:** 2026-06-21
**Status:** Approved for spec review
**Builds on:** the admin panel (`app/admin/*`, `components/admin/*`, `app/admin/actions.ts`).

---

## 1. Goal

Let admins control a transaction's **date** in the admin panel: set the date when **adding** a
transaction, and **edit** the date of an existing transaction. Date-only — it never changes
balances.

### Confirmed decisions
- **Both** set-on-add and edit-existing.
- Date stored at **midnight UTC** (`<YYYY-MM-DD>T00:00:00.000Z`) so the displayed day is stable
  (the app formats dates with `timeZone: "UTC"`).
- Changing a date naturally shifts which calendar month the income/spending insights count it in
  (expected, not a bug).
- All behind the existing `requireAdmin`/`getAdminOrNull` guard.

### Out of scope
- Editing other transaction fields (type/amount/category) — still add + delete only for those.
- Customer-facing date editing (admins only).

---

## 2. Architecture / changes

```
lib/admin/dates.ts            # NEW (PURE): toCreatedAtISO(date) -> string | null   (unit-tested)
app/admin/actions.ts          # MODIFY addTransaction (optional date) + ADD updateTransactionDate
components/admin/transaction-manager.tsx  # MODIFY: date input on the add form + inline date edit per row
```

### `lib/admin/dates.ts` (pure)
```ts
export function toCreatedAtISO(date: string): string | null;
```
- Accepts `YYYY-MM-DD` (regex `^\d{4}-\d{2}-\d{2}$`) that is a real date (`!Number.isNaN(Date.parse(...))`).
- Returns `` `${date}T00:00:00.000Z` `` on success, `null` otherwise.
Unit-tested: valid date → ISO; bad format → null; impossible date (`2026-13-40`) → null; empty → null.

### `app/admin/actions.ts`
- **`addTransaction`** — read `formData.get("date")`; if present, `toCreatedAtISO` it; if the value
  was provided but invalid → return `{ error: "Enter a valid date." }`. When valid, include
  `created_at` in the insert; when absent, omit it (DB default `now()`). Balance logic unchanged.
- **`updateTransactionDate(userId, transactionId, formData)`** — guard with `getAdminOrNull`;
  `toCreatedAtISO(formData.get("date"))`; if null → `{ error: "Enter a valid date." }`; else
  `update({ created_at })` on the transaction by id; `revalidatePath("/admin/users/<userId>")` +
  `/admin`. No balance change. Returns `{ ok: true } | { error }`.

### `components/admin/transaction-manager.tsx`
- **Add form:** a `<input type="date" name="date">` defaulting to today's `YYYY-MM-DD`
  (`new Date().toISOString().slice(0,10)` — client component, safe).
- **Each row's date cell:** an `<input type="date">` whose value is `txn.created_at.slice(0,10)`;
  on change it calls `updateTransactionDate(userId, txn.id, fd)` inside a transition; errors surface
  in the existing inline `msg`. (Same onChange-saves pattern as the account status select.)

---

## 3. Error handling
- Invalid/!provided-but-bad date → `{ error }` surfaced inline; no write.
- `updateTransactionDate` only touches `created_at`; if the row id is wrong the update affects
  nothing (service-role + admin-guarded) and returns ok.

## 4. Security
- Reuses the admin guard on the new/edited actions; service-role stays server-only. No new surface.

## 5. Testing
- **Unit:** `toCreatedAtISO` (valid, bad format, impossible date, empty).
- **Manual:** in the admin user page, add a transaction with a chosen past date → it appears with
  that date; change an existing transaction's date inline → it persists and the insights month
  recalculates; an invalid date is rejected.

## 6. Acceptance criteria
1. The admin "Add transaction" form has a date field (defaults to today) and honors it on insert.
2. Each transaction row lets an admin change its date inline; the change persists.
3. Editing a date does not change any balance.
4. `npm run build`, `npm run lint`, `npx tsc --noEmit` pass; `toCreatedAtISO` unit tests pass.
