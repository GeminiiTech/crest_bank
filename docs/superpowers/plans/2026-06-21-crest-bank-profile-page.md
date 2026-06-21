# User Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `/dashboard/profile` page where a signed-in user can view their details, reachable from the user menu.

**Architecture:** Extend `getProfile()` with `email`/`kyc_status`/`created_at` (additive), add a server-rendered profile page that reads it, and turn the disabled "Profile (soon)" menu item into a working link.

**Tech Stack:** Next.js 14 App Router, TS strict, Tailwind v3 + classic Radix shadcn.

**Codebase facts (verified):**
- `lib/data/profile.ts` `getProfile()` already loads the auth `user` and selects `id, full_name, phone, country, avatar_url, notification_prefs, role`; returns type `Profile`. Used by `app/dashboard/layout.tsx` and `app/dashboard/settings/page.tsx` (additive fields won't break them).
- `components/dashboard/user-menu.tsx` already imports `Link` (next/link), `Image`, `UserIcon`/`LogOut`/`ShieldCheck` (lucide), and renders a disabled `DropdownMenuItem` ("Profile (soon)") plus an admin link + sign out.
- `lib/format.ts` exports `formatTxnDate(iso)` (UTC-stable). UI: `Card*`, `Badge` (variants incl. `success`/`secondary`), `Button` (asChild).
- `/dashboard/*` is already auth-gated by middleware; `formatTxnDate` is unit-tested. No new pure logic here.
- Path alias `@/*` = repo root.

**Verification gates:** `npm run test`, `npx tsc --noEmit`, `npm run lint`. Build only at the final task (`dangerouslyDisableSandbox: true` if sandbox blocks npm; retry once on a fonts socket error).

---

## Task 1: Extend `getProfile` with email / KYC / created_at

**Files:** Modify `lib/data/profile.ts`

- [ ] **Step 1: Replace the file** with:

```ts
import { createClient } from "@/lib/supabase/server";

export type NotificationPrefsValue = {
  product: boolean;
  security: boolean;
  transfers: boolean;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  avatar_url: string | null;
  kyc_status: string;
  created_at: string;
  notification_prefs: NotificationPrefsValue;
  role: "customer" | "admin";
};

const DEFAULT_PREFS: NotificationPrefsValue = { product: true, security: true, transfers: true };

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, country, avatar_url, kyc_status, created_at, notification_prefs, role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    email: user.email ?? null,
    kyc_status: (data.kyc_status as string) ?? "unverified",
    created_at: data.created_at as string,
    notification_prefs: { ...DEFAULT_PREFS, ...((data.notification_prefs as Record<string, boolean> | null) ?? {}) },
    role: (data.role as "customer" | "admin") ?? "customer",
  } as Profile;
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0 (existing callers compile — fields are additive).

- [ ] **Step 3: Commit**

```bash
git add lib/data/profile.ts
git commit -m "feat(profile): expose email, kyc_status, created_at from getProfile"
```

---

## Task 2: Profile page

**Files:** Create `app/dashboard/profile/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data/profile";
import { formatTxnDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/dashboard/profile");

  const initial = (profile.full_name || profile.email || "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Profile</h1>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt="Your profile photo"
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <span
                className="grid h-16 w-16 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground"
                aria-hidden
              >
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold">{profile.full_name || "—"}</p>
              <p className="truncate text-sm text-muted-foreground">{profile.email ?? "—"}</p>
            </div>
          </div>

          <dl className="mt-6 divide-y">
            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{profile.phone || "—"}</dd>
            </div>
            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-muted-foreground">Country</dt>
              <dd className="font-medium">{profile.country || "—"}</dd>
            </div>
            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-muted-foreground">KYC status</dt>
              <dd>
                <Badge variant={profile.kyc_status === "verified" ? "success" : "secondary"}>
                  {profile.kyc_status}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">{formatTxnDate(profile.created_at)}</dd>
            </div>
          </dl>

          <Button asChild className="mt-6">
            <Link href="/dashboard/settings">Edit in settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0; `npm run lint` → 0.

- [ ] **Step 3: Commit**

```bash
git add "app/dashboard/profile/page.tsx"
git commit -m "feat(profile): read-only user profile page"
```

---

## Task 3: Enable the Profile menu link

**Files:** Modify `components/dashboard/user-menu.tsx`

- [ ] **Step 1: Replace the disabled Profile item.** Find:

```tsx
        <DropdownMenuItem className="text-muted-foreground" disabled>
          <UserIcon className="mr-2 h-4 w-4" /> Profile (soon)
        </DropdownMenuItem>
```
  and replace it with:

```tsx
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile" className="flex w-full items-center">
            <UserIcon className="mr-2 h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
```
  (`Link`, `UserIcon`, and `DropdownMenuItem` are already imported in this file. If for any reason `Link` is not imported, add `import Link from "next/link";`.)

- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0; `npm run lint` → 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/user-menu.tsx
git commit -m "feat(profile): link the user menu to the profile page"
```

---

## Task 4: Docs + final verification

**Files:** Modify `README.md`

- [ ] **Step 1: Add a one-line note** under the Dashboard section (or near the user-menu mention): a
  signed-in user can view their details at **`/dashboard/profile`** (opened from the user menu);
  editing is in Settings.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: note the user profile page"
```

- [ ] **Step 3: Final gate** — `npm run test` (all pass), `npx tsc --noEmit` (0), `npm run lint` (0),
  `npm run build` (succeeds; `/dashboard/profile` compiles). Retry build once on a fonts socket error.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore(profile): verification fixes"
```

---

## Self-Review Notes (coverage vs spec)

- §2 `getProfile` adds email/kyc_status/created_at (additive) → Task 1. ✓
- §2 read-only profile page (avatar/name/email/phone/country/KYC/member-since + Edit link) → Task 2. ✓
- §2 user-menu Profile link → Task 3. ✓
- §3 security (own profile, RLS-scoped, auth-gated route) → Tasks 1,2 (middleware already gates `/dashboard/*`). ✓
- §4 testing (no new pure logic; manual + existing) → Task 4. ✓
- §5 acceptance criteria → Task 4 gate + manual. ✓

**Type consistency:** `Profile` (Task 1) gains `email`/`kyc_status`/`created_at`, consumed by the page (Task 2); existing consumers (dashboard layout reads `avatar_url`/`role`; settings reads `full_name`/`phone`/`country`/`avatar_url`/`notification_prefs`) are unaffected by additive fields. `formatTxnDate` used for `created_at`. Menu `Link` href `/dashboard/profile` matches the new route (Tasks 2,3).
