# Crest Bank — User Profile Page — Design Spec

**Date:** 2026-06-21
**Status:** Approved for spec review
**Builds on:** the dashboard (M3) + settings (M5).

---

## 1. Goal

Give a signed-in user a **dedicated profile page** to view their own details (read view), reachable
from the dashboard user menu. Editing stays in Settings; this page links there.

### Confirmed decisions
- A new `/dashboard/profile` read page (not just routing the menu to Settings).
- Shows: avatar (or initial), full name, email, phone, country, **KYC status**, **member since**.
- The user menu's "Profile (soon)" item becomes a working **Profile** link to `/dashboard/profile`.

### Out of scope
- Editing on this page (Settings already does that).
- Adding Profile to the sidebar or the per-page tour registry.
- Any schema change.

---

## 2. Architecture / changes

```
lib/data/profile.ts                 # add email, kyc_status, created_at to Profile + getProfile()
app/dashboard/profile/page.tsx      # NEW read-only profile view
components/dashboard/user-menu.tsx  # enable the Profile item -> Link to /dashboard/profile
```

### `lib/data/profile.ts`
- Extend the `Profile` type with `email: string | null;`, `kyc_status: string;`, `created_at: string;`.
- `getProfile()` already loads the auth `user` — set `email: user.email ?? null`.
- Add `kyc_status, created_at` to the `.select(...)` and to the returned object
  (`kyc_status: (data.kyc_status as string) ?? "unverified"`, `created_at: data.created_at as string`).
- Existing callers (dashboard layout, settings page) keep working — only additive fields.

### `app/dashboard/profile/page.tsx` (server component)
- `const profile = await getProfile(); if (!profile) redirect("/login?next=/dashboard/profile");`
- A `Card` with: avatar (`next/image` with `unoptimized` if `avatar_url`, else an initial circle),
  full name (or "—"), email; then a definition list of Phone, Country, **KYC** (a `Badge`),
  **Member since** (`formatTxnDate(profile.created_at)`); and a Button `asChild` linking to
  `/dashboard/settings` ("Edit in settings"). `metadata.title = "Profile"`.

### `components/dashboard/user-menu.tsx`
- Replace the disabled `DropdownMenuItem` ("Profile (soon)") with:
  ```tsx
  <DropdownMenuItem asChild>
    <Link href="/dashboard/profile" className="flex w-full items-center">
      <UserIcon className="mr-2 h-4 w-4" /> Profile
    </Link>
  </DropdownMenuItem>
  ```
  (`Link` import added; `UserIcon` already imported. The admin link + sign-out remain.)

---

## 3. Security / data
- Reads only the current user's own profile (RLS-scoped; `getProfile` filters by `auth.uid()`).
  Route is under `/dashboard/*` so the existing middleware requires auth.

## 4. Testing
- No new pure logic → existing unit tests stay green (`formatTxnDate` already covered).
- **Manual:** open the user menu → Profile → the page shows avatar, name, email, phone, country,
  KYC badge, and member-since; "Edit in settings" navigates to Settings; logged-out access to
  `/dashboard/profile` redirects to login.

## 5. Acceptance criteria
1. The user menu has a working **Profile** item linking to `/dashboard/profile`.
2. `/dashboard/profile` shows the user's avatar/name/email/phone/country/KYC/member-since (read-only)
   with an "Edit in settings" link.
3. `getProfile()` exposes `email`, `kyc_status`, `created_at` without breaking existing callers.
4. `npm run build`, `npm run lint`, `npx tsc --noEmit` pass; existing tests still pass.
