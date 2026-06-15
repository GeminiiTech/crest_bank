# Crest Bank — Cards & Settings (Milestone 5) — Design Spec

**Date:** 2026-06-13
**Status:** Approved for spec review
**Author:** Engineering (with Kene)
**Builds on:** M1 foundation, M2 auth, M3 dashboard, M4 transfers. **Final milestone.**

---

## 1. Goal

Complete the customer experience: a **Cards** page (view, request a virtual card,
freeze/unfreeze) and a **Settings** page (profile editing + avatar upload, password change,
notification preferences). This finishes the planned product surface.

### Confirmed decisions
- **Cards:** seed one debit card per account (demo); "Request virtual card" action; freeze/
  unfreeze via card `status` (active↔frozen). Card numbers simulated.
- **Settings:** Profile (name/phone/country + avatar upload), Security (change password),
  Notifications (preferences).
- **Avatar upload:** server action receiving the file via FormData, uploading to the `avatars`
  Storage bucket (owner-scoped path), saving the URL to `profiles.avatar_url`.
- **Password change:** `supabase.auth.updateUser({ password })` using the active session (no
  current-password re-entry); new password ≥8 + confirm match.
- **Notification preferences:** migration **0014** adds `profiles.notification_prefs jsonb`.
- Enable **Cards** + **Settings** in the sidebar nav (last two disabled items).

### Out of scope
- KYC document upload (the `kyc-documents` bucket stays unused; no KYC flow requested).
- Real card issuance/processing; card PIN; spending limits.
- Account-level role/admin management.

---

## 2. Migration 0014

```sql
alter table public.profiles
  add column notification_prefs jsonb not null
  default '{"product": true, "security": true, "transfers": true}'::jsonb;
```
Additive; existing M1 `profiles update own` RLS already permits owner updates to this column.
No new policy needed.

---

## 3. Architecture

```
supabase/migrations/0014_notification_prefs.sql
app/dashboard/
  cards/page.tsx             # server: list cards + accounts; empty state
  cards/actions.ts           # requestVirtualCard(accountId), setCardStatus(id, status)
  settings/page.tsx          # server: loads profile; renders 3 section cards
  settings/actions.ts        # updateProfile, uploadAvatar, updatePassword, updateNotificationPrefs
components/dashboard/
  card-visual.tsx            # presentational gradient card
  cards-grid.tsx             # client: per-card freeze/unfreeze + "Request virtual card"
  profile-form.tsx           # client: name/phone/country (RHF + Zod)
  avatar-uploader.tsx        # client: file picker -> uploadAvatar action
  password-form.tsx          # client: new password + confirm (RHF + Zod)
  notifications-form.tsx     # client: toggles -> updateNotificationPrefs
lib/
  data/cards.ts              # getCards()
  data/profile.ts            # getProfile()
  cards.ts                   # PURE: buildCard(seed), nextCardStatus(current)
  validations/profile.ts     # PURE: profileSchema, passwordSchema, notificationPrefsSchema
lib/dashboard/nav.ts         # enable Cards + Settings
lib/demo/seed-data.ts        # + buildDemoCards(seed) generator
app/dashboard/actions.ts     # seedDemoData(): also insert a card per account
app/dashboard/layout.tsx     # load profile.avatar_url, pass to Topbar
components/dashboard/topbar.tsx + user-menu.tsx  # show avatar image when present
```

### Boundaries
- **Pure layer** (`cards.ts`, `validations/profile.ts`, the demo generators): no I/O, unit-tested.
- **Data layer** (`getCards`, `getProfile`): RLS-scoped reads.
- **Mutations** (server actions): card create/status, profile update, avatar upload, password,
  notification prefs — all server-side, Zod-validated, owner-scoped.
- **UI** (client components): forms call actions and render `{ error }`/success.

---

## 4. Data flow

### Cards
- `getCards()` returns the user's cards (RLS via account ownership). The page also loads
  accounts to label each card by account and to offer accounts in "Request virtual card".
- `requestVirtualCard(accountId)`: verifies the account belongs to the user (RLS insert check
  already enforces account ownership), builds a virtual debit card via `buildCard`, inserts it,
  `revalidatePath("/dashboard/cards")`.
- `setCardStatus(cardId, status)`: validates `status ∈ {active, frozen}`, updates the card
  (owner-scoped: `.eq("id", cardId)` + RLS), `revalidatePath`.

### Settings
- `updateProfile(formData)`: validates with `profileSchema`; updates `profiles`
  (full_name/phone/country); `revalidatePath("/dashboard/settings")` + `"/dashboard"` (for the
  greeting).
- `uploadAvatar(formData)`: reads the file, validates type (image/*) and size (≤2 MB); uploads
  to `avatars` at `${user.id}/avatar-<timestamp>.<ext>` (owner path satisfies Storage RLS);
  gets the public URL; sets `profiles.avatar_url`; revalidate. Replaces prior avatar by
  overwriting/upserting; old object cleanup is best-effort (not required).
- `updatePassword(formData)`: validates with `passwordSchema`;
  `supabase.auth.updateUser({ password })`; returns success/`{ error }`.
- `updateNotificationPrefs(formData)`: parses three booleans with `notificationPrefsSchema`;
  updates `profiles.notification_prefs`; revalidate.

### Avatar display
- `layout.tsx` loads `getProfile()` and passes `avatarUrl` to `Topbar` → `UserMenu`, which
  renders an `<img>` (with `alt`) when present, else the initial letter (current behavior).

---

## 5. Pure functions (unit-tested)

`lib/cards.ts`:
- `buildCard(seed: number, opts?: { type?: "debit" | "credit"; isVirtual?: boolean; now?: Date }): { brand: string; type: "debit"|"credit"; last4: string; exp_month: number; exp_year: number; is_virtual: boolean; status: "active" }`
  — deterministic given inputs: `last4` is a 4-digit string derived from seed; expiry ~3 years
  out; brand "Visa". Tested: last4 is 4 digits, exp_month 1–12, exp_year > current year.
- `nextCardStatus(current: "active" | "frozen" | "cancelled"): "active" | "frozen"`
  — `active → frozen`, otherwise `active`. Tested both directions.

`lib/validations/profile.ts`:
- `profileSchema`: full_name (min 2), phone (optional, max 32), country (optional, max 64).
- `passwordSchema`: password (min 8), confirmPassword; refine equal (path confirmPassword).
- `notificationPrefsSchema`: `{ product: boolean, security: boolean, transfers: boolean }`
  (coerce `"true"`/`"on"` from FormData in the action; schema validates booleans).

`lib/demo/seed-data.ts`:
- `buildDemoCards(seed: number, opts?: { now?: Date }): { brand; type; last4; exp_month; exp_year; status; is_virtual }[]`
  — one active physical debit card; deterministic. (Inserted once per account by the seed.)

---

## 6. UI / UX

- **Cards page:** grid of `card-visual`s (navy→azure gradient, brand, `•••• last4`, `MM/YY`,
  type label, status pill). Each card has a Freeze/Unfreeze button (frozen cards look dimmed).
  A "Request virtual card" control (account picker + button). Empty state when no cards
  ("Request your first card"). Frozen state clearly indicated.
- **Settings page:** three stacked section `Card`s:
  - **Profile:** avatar (current image or initial) with an "Upload photo" picker; name, phone,
    country inputs; Save.
  - **Security:** new password + confirm; Update password. Success/inline errors.
  - **Notifications:** three labeled toggles; Save (or save-on-change). Reflects stored prefs.
- Reuses dashboard shell + tokens + `Card`, `Button`, `Input`, `Badge`. Toggles use a styled
  checkbox/switch (native checkbox styled, to avoid a new dependency).
- **A11y:** labeled inputs and toggles, `role="alert"`/`role="status"` messages, avatar
  `<img alt>`, file input labeled, buttons show pending state.

---

## 7. Error handling

- Server actions return `{ error }` for expected failures; success returns `{ ok: true }` or
  revalidates. No throws to the client for expected cases.
- `uploadAvatar`: reject non-image or >2 MB with a clear message; Storage errors → friendly copy.
- `updatePassword`: maps Supabase errors (e.g. weak password, same-as-old if surfaced) to copy.
- `requestVirtualCard`/`setCardStatus`: invalid account/card or RLS denial → generic failure copy.
- `setCardStatus` rejects any status outside `{active, frozen}` before hitting the DB.

---

## 8. Security

- All mutations are server-side and owner-scoped (RLS): cards via account-ownership policies;
  profile/prefs via `profiles update own`; password via the authenticated session.
- Avatar upload path is prefixed with `auth.uid()`, matching the M1 Storage RLS (owner-only
  write); file type/size validated server-side before upload.
- No service-role key used. `notification_prefs` only writable by the owner.
- Card numbers are simulated; no real PAN is stored (only `last4`).

---

## 9. Testing

**Unit (Vitest, no DB):** `buildCard`, `nextCardStatus`, `profileSchema`, `passwordSchema`,
`notificationPrefsSchema`, `buildDemoCards`.

**Manual (Supabase project with 0014 applied + Storage/Auth):** documented in README —
re-seed (or request) shows cards; freeze/unfreeze toggles status and styling; request virtual
card adds one; edit profile persists; upload avatar shows in the topbar; change password then
re-login with the new one; toggle notification prefs and confirm they persist on reload.

---

## 10. Acceptance criteria

1. Cards page lists the user's cards; "Request virtual card" adds a virtual debit card to a
   chosen account; freeze/unfreeze toggles a card's status and its appearance.
2. The demo seed creates a debit card per account (new seedings); existing users can use
   "Request virtual card".
3. Settings → Profile saves name/phone/country; uploading an avatar stores it and it appears in
   the topbar/user menu.
4. Settings → Security changes the password (≥8 + confirm); the user can log in with it.
5. Settings → Notifications persists the three toggles to `profiles.notification_prefs`.
6. `npm run build`, `npm run lint`, `npx tsc --noEmit` pass; unit tests pass.
7. Migration 0014 documented; README manual test plan updated; nav shows Cards + Settings
   enabled; roadmap marks M5 done (all milestones complete).

---

## 11. Risks / open items

- **Avatar upload / Storage** can't be exercised in CI here — covered by the manual plan;
  path/type/size validation is unit-reasoned. Requires the `avatars` bucket + policies (M1).
- **Password change** uses the session (no current-password step) — a documented demo
  simplification; re-authentication can be added later.
- **0014** is additive and low-risk; applied by the user after 0001–0013.
- Old avatar objects aren't garbage-collected on replace (best-effort) — acceptable for the demo.
