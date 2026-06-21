# Editable Admin Transaction Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins set a transaction's date when adding one and edit the date of existing transactions, in the admin panel.

**Architecture:** A pure `toCreatedAtISO` helper (unit-tested) turns a `YYYY-MM-DD` value into a midnight-UTC ISO timestamp; the existing `addTransaction` action gains an optional date; a new `updateTransactionDate` action edits `created_at` only; the admin transaction manager gets a date input on add and an inline date input per row.

**Tech Stack:** Next.js 14 App Router, TS strict, Tailwind v3, Vitest.

**Codebase facts (verified):**
- `app/admin/actions.ts` already has `addTransaction(userId, accountId, formData)` (inserts a txn + moves balance via `signedDelta`) and a `revalidateUser(userId)` helper. `getAdminOrNull` + `createAdminClient` already imported.
- `components/admin/transaction-manager.tsx` (`"use client"`) renders the add form + a table of `AdminTransaction[]`; it already imports `addTransaction, deleteTransaction`, uses `useTransition`, has `const selectClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm"`, and a `msg` state.
- `AdminTransaction.created_at` is an ISO string. `formatTxnDate` formats with `timeZone: "UTC"`.
- Path alias `@/*` = repo root. Vitest configured.

**Verification gates:** `npm run test`, `npx tsc --noEmit`, `npm run lint`. Build only at the final task (`dangerouslyDisableSandbox: true` if sandbox blocks npm; retry once on a fonts socket error).

---

## Task 1: `toCreatedAtISO` helper (TDD)

**Files:** Create `lib/admin/dates.ts`; Test `lib/admin/__tests__/dates.test.ts`

- [ ] **Step 1: Write failing test** — `lib/admin/__tests__/dates.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { toCreatedAtISO } from "@/lib/admin/dates";

describe("toCreatedAtISO", () => {
  it("converts a valid date to midnight UTC ISO", () => {
    expect(toCreatedAtISO("2026-06-21")).toBe("2026-06-21T00:00:00.000Z");
  });
  it("rejects a bad format", () => {
    expect(toCreatedAtISO("06/21/2026")).toBeNull();
    expect(toCreatedAtISO("2026-6-1")).toBeNull();
    expect(toCreatedAtISO("")).toBeNull();
  });
  it("rejects impossible dates (no silent rollover)", () => {
    expect(toCreatedAtISO("2026-13-40")).toBeNull();
    expect(toCreatedAtISO("2026-02-30")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — `lib/admin/dates.ts`

```ts
/** `YYYY-MM-DD` -> `YYYY-MM-DDT00:00:00.000Z`, or null if not a real calendar date. */
export function toCreatedAtISO(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return null;
  // reject rollovers like 2026-02-30 -> Mar 2
  if (
    dt.getUTCFullYear() !== Number(y) ||
    dt.getUTCMonth() + 1 !== Number(mo) ||
    dt.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return `${date}T00:00:00.000Z`;
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/admin/dates.ts lib/admin/__tests__/dates.test.ts
git commit -m "feat(admin): pure toCreatedAtISO date helper"
```

---

## Task 2: Actions — optional date on add + `updateTransactionDate`

**Files:** Modify `app/admin/actions.ts`

- [ ] **Step 1: Add the import** near the other imports at the top:

```ts
import { toCreatedAtISO } from "@/lib/admin/dates";
```

- [ ] **Step 2: Honor an optional `date` in `addTransaction`.** Inside `addTransaction`, AFTER the
  `if (!parsed.success) ...` line and BEFORE `const admin = createAdminClient();`, add:

```ts
  const rawDate = formData.get("date")?.toString();
  let createdAt: string | undefined;
  if (rawDate) {
    const iso = toCreatedAtISO(rawDate);
    if (!iso) return { error: "Enter a valid date." };
    createdAt = iso;
  }
```
  Then change the `.insert({ ... })` call to include `created_at` only when set — replace the insert object's closing so it reads:

```ts
  const { error: insErr } = await admin.from("transactions").insert({
    account_id: accountId,
    type: parsed.data.type,
    category: parsed.data.category,
    amount: parsed.data.amount,
    currency: (account.currency as string) ?? "USD",
    status: "completed",
    description: parsed.data.description || null,
    counterparty: "Admin",
    ...(createdAt ? { created_at: createdAt } : {}),
  });
```
  (Everything else in `addTransaction` — the balance update via `signedDelta`, the `revalidateUser` — stays unchanged.)

- [ ] **Step 3: Add the new action** at the end of the file (after `deleteTransaction`, before the beneficiary helpers is fine — anywhere top-level):

```ts
export async function updateTransactionDate(
  userId: string,
  transactionId: string,
  formData: FormData
): Promise<AdminResult> {
  if (!(await getAdminOrNull())) return { error: "Not authorized." };
  const iso = toCreatedAtISO(formData.get("date")?.toString() ?? "");
  if (!iso) return { error: "Enter a valid date." };
  const admin = createAdminClient();
  const { error } = await admin.from("transactions").update({ created_at: iso }).eq("id", transactionId);
  if (error) return { error: "Could not update the date." };
  revalidateUser(userId);
  return { ok: true };
}
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0; `npm run lint` → 0.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/actions.ts"
git commit -m "feat(admin): optional date on add + updateTransactionDate action"
```

---

## Task 3: UI — date input on add + inline per-row date

**Files:** Modify `components/admin/transaction-manager.tsx`

- [ ] **Step 1: Import the new action** — change the actions import line to:

```ts
import { addTransaction, deleteTransaction, updateTransactionDate } from "@/app/admin/actions";
```

- [ ] **Step 2: Add a `today` constant + a `changeDate` handler.** Right after
  `const [pending, startTransition] = useTransition();` add:

```ts
  const today = new Date().toISOString().slice(0, 10);

  function changeDate(id: string, date: string) {
    setMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("date", date);
      const result = await updateTransactionDate(userId, id, fd);
      setMsg("error" in result ? result.error : "Date updated.");
    });
  }
```

- [ ] **Step 3: Add a Date field to the add form.** Insert this `<div>` as the FIRST child inside the
  add `<form>` (before the Account `<div>`):

```tsx
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
            <input type="date" name="date" defaultValue={today} className={selectClass} aria-label="Transaction date" />
          </div>
```

- [ ] **Step 4: Make each row's date editable.** Replace the date `<td>` in the table body:

```tsx
                <td className="px-3 py-2 text-muted-foreground">{formatTxnDate(t.created_at)}</td>
```
  with:

```tsx
                <td className="px-3 py-2">
                  <input
                    type="date"
                    defaultValue={t.created_at.slice(0, 10)}
                    onChange={(e) => changeDate(t.id, e.target.value)}
                    disabled={pending}
                    aria-label="Transaction date"
                    className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                  />
                </td>
```
  `formatTxnDate` is now unused in this file — remove it from the `@/lib/format` import (keep
  `formatCurrency`) to satisfy lint.

- [ ] **Step 5: Verify** `npx tsc --noEmit` → 0; `npm run lint` → 0.

- [ ] **Step 6: Commit**

```bash
git add components/admin/transaction-manager.tsx
git commit -m "feat(admin): editable transaction dates (add + inline edit)"
```

---

## Task 4: Docs + final verification

**Files:** Modify `README.md`

- [ ] **Step 1: Tweak the admin "What admins can do" line** about transactions to mention dates:
  change "**add/delete transactions** (account balance moves/reverts)" to
  "**add/delete transactions** (account balance moves/reverts) and **edit a transaction's date**".

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: note editable admin transaction dates"
```

- [ ] **Step 3: Final gate** — Run `npm run test` (all pass incl. `toCreatedAtISO`), `npx tsc --noEmit` (0), `npm run lint` (0), `npm run build` (succeeds; `/admin/users/[id]` compiles). Retry build once on a fonts socket error; `dangerouslyDisableSandbox: true` if sandbox blocks npm.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore(admin): transaction-date verification fixes"
```

---

## Self-Review Notes (coverage vs spec)

- §2 `toCreatedAtISO` (pure, robust against rollover) → Task 1. ✓
- §2 `addTransaction` optional date + `updateTransactionDate` → Task 2. ✓
- §2 UI: date on add + inline per-row edit → Task 3. ✓
- §3 error handling (invalid date → `{error}`, surfaced inline) → Tasks 2,3. ✓
- §4 security (reuses `getAdminOrNull`; service-role server-only) → Task 2. ✓
- §5 testing (`toCreatedAtISO` unit; manual) → Tasks 1,4. ✓
- §6 acceptance criteria → Task 4 gate + manual. ✓

**Type consistency:** `toCreatedAtISO` (Task 1) imported by `app/admin/actions.ts` (Task 2) and used in both `addTransaction` and `updateTransactionDate`. `updateTransactionDate(userId, transactionId, formData)` (Task 2) matches the call in `changeDate` (Task 3). The add form's `date` field name (`"date"`) matches what `addTransaction` reads (Task 2). `AdminResult` is the existing return type. Removing the now-unused `formatTxnDate` import keeps lint clean (Task 3).
