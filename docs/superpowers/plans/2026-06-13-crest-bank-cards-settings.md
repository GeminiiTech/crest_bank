# Crest Bank Cards & Settings (M5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cards page (view, request virtual card, freeze/unfreeze) and a Settings page (profile + avatar upload, change password, notification preferences), completing the product.

**Architecture:** Pure card/validation logic is unit-tested; Server Components read RLS-scoped data; client forms call owner-scoped server actions (card status/create, profile update, avatar upload to Storage, password, notification prefs). Migration 0014 adds `profiles.notification_prefs`. The demo seed reuses the pure `buildCard` generator to create a card per account.

**Tech Stack:** Next.js 14 App Router, TS strict, Tailwind v3 + classic Radix shadcn, Supabase (Postgres + Storage + Auth), Vitest.

**Codebase facts to rely on:**
- `lib/supabase/server.ts` exports SYNC `createClient()` (no await). Supabase `numeric` → strings (none here; cards/profile have no numeric money fields).
- `app/dashboard/actions.ts` has `seedDemoData()` (idempotent) which inserts accounts then transactions+notifications; we APPEND a card insert per account.
- `lib/dashboard/nav.ts` exports `dashboardNav` (Cards + Settings currently `enabled: false`).
- `lib/format.ts` (`maskAccountNumber`), `lib/dashboard/constants.ts` (`accountTypeLabel`).
- `app/dashboard/layout.tsx` loads the user + notifications and renders `Topbar`; `components/dashboard/topbar.tsx` → `user-menu.tsx` shows an initial-letter avatar.
- UI primitives: `Button` (asChild), `Card*`, `Input`, `Badge`. RHF+Zod pattern as in `components/auth/*` and `components/dashboard/beneficiary-form.tsx`.
- Storage bucket `avatars` exists (M1) with owner-scoped write at path prefix `auth.uid()`.
- Path alias `@/*` = repo root.

**Verification gates (per phase):** `npm run test`, `npx tsc --noEmit`, `npm run lint`. Run `npm run build` only at the final task (fonts flaky; retry once; `dangerouslyDisableSandbox: true` if sandbox blocks npm).

---

## Phase 1 — Pure logic (TDD)

### Task 1: Card helpers

**Files:**
- Create: `lib/cards.ts`
- Test: `lib/__tests__/cards.test.ts`

- [ ] **Step 1: Write failing test** — `lib/__tests__/cards.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildCard, nextCardStatus } from "@/lib/cards";

const now = new Date("2026-06-13T00:00:00.000Z");

describe("buildCard", () => {
  it("derives a 4-digit last4 and valid expiry from the seed", () => {
    const c = buildCard(1234, { now });
    expect(c.last4).toBe("1234");
    expect(c.exp_month).toBeGreaterThanOrEqual(1);
    expect(c.exp_month).toBeLessThanOrEqual(12);
    expect(c.exp_year).toBe(2029);
    expect(c.type).toBe("debit");
    expect(c.is_virtual).toBe(false);
    expect(c.status).toBe("active");
    expect(c.brand).toBe("Visa");
  });
  it("pads short last4 and honors options", () => {
    const c = buildCard(5, { type: "credit", isVirtual: true, now });
    expect(c.last4).toBe("0005");
    expect(c.type).toBe("credit");
    expect(c.is_virtual).toBe(true);
  });
});

describe("nextCardStatus", () => {
  it("toggles active/frozen and recovers from cancelled", () => {
    expect(nextCardStatus("active")).toBe("frozen");
    expect(nextCardStatus("frozen")).toBe("active");
    expect(nextCardStatus("cancelled")).toBe("active");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — `lib/cards.ts`

```ts
export type GeneratedCard = {
  brand: string;
  type: "debit" | "credit";
  last4: string;
  exp_month: number;
  exp_year: number;
  is_virtual: boolean;
  status: "active";
};

export function buildCard(
  seed: number,
  opts: { type?: "debit" | "credit"; isVirtual?: boolean; now?: Date } = {}
): GeneratedCard {
  const now = opts.now ?? new Date();
  const n = Math.abs(Math.trunc(seed));
  return {
    brand: "Visa",
    type: opts.type ?? "debit",
    last4: String(n % 10000).padStart(4, "0"),
    exp_month: (n % 12) + 1,
    exp_year: now.getUTCFullYear() + 3,
    is_virtual: opts.isVirtual ?? false,
    status: "active",
  };
}

export function nextCardStatus(
  current: "active" | "frozen" | "cancelled"
): "active" | "frozen" {
  return current === "active" ? "frozen" : "active";
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/cards.ts lib/__tests__/cards.test.ts
git commit -m "feat(m5): pure card helpers (buildCard, nextCardStatus)"
```

---

### Task 2: Settings validation schemas

**Files:**
- Create: `lib/validations/profile.ts`
- Test: `lib/validations/__tests__/profile.test.ts`

- [ ] **Step 1: Write failing test** — `lib/validations/__tests__/profile.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { profileSchema, passwordSchema, notificationPrefsSchema } from "@/lib/validations/profile";

describe("profileSchema", () => {
  it("accepts a full name with optional phone/country", () => {
    expect(profileSchema.safeParse({ full_name: "Ada Lovelace", phone: "+1 555", country: "US" }).success).toBe(true);
    expect(profileSchema.safeParse({ full_name: "Ada Lovelace" }).success).toBe(true);
  });
  it("rejects a short name", () => {
    expect(profileSchema.safeParse({ full_name: "A" }).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts matching passwords of 8+ chars", () => {
    expect(passwordSchema.safeParse({ password: "password1", confirmPassword: "password1" }).success).toBe(true);
  });
  it("rejects short or mismatched passwords", () => {
    expect(passwordSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: "password1", confirmPassword: "password2" }).success).toBe(false);
  });
});

describe("notificationPrefsSchema", () => {
  it("requires the three booleans", () => {
    expect(notificationPrefsSchema.safeParse({ product: true, security: false, transfers: true }).success).toBe(true);
    expect(notificationPrefsSchema.safeParse({ product: true, security: false }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — `lib/validations/profile.ts`

```ts
import { z } from "zod";

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().trim().max(32).optional(),
  country: z.string().trim().max(64).optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const passwordSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type PasswordInput = z.infer<typeof passwordSchema>;

export const notificationPrefsSchema = z.object({
  product: z.boolean(),
  security: z.boolean(),
  transfers: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/validations/profile.ts lib/validations/__tests__/profile.test.ts
git commit -m "feat(m5): profile/password/notification Zod schemas"
```

---

## Phase 2 — Migration, nav, seed extension

### Task 3: Migration 0014 + nav enable

**Files:**
- Create: `supabase/migrations/0014_notification_prefs.sql`
- Modify: `lib/dashboard/nav.ts`

- [ ] **Step 1: Create `supabase/migrations/0014_notification_prefs.sql`**

```sql
-- Notification preferences for the settings page (owner-writable via existing RLS).
alter table public.profiles
  add column notification_prefs jsonb not null
  default '{"product": true, "security": true, "transfers": true}'::jsonb;
```

- [ ] **Step 2: Enable Cards + Settings in `lib/dashboard/nav.ts`** — change the last two items' `enabled` to `true`:

```ts
  { label: "Cards", href: "/dashboard/cards", icon: CreditCard, enabled: true },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, enabled: true },
```

- [ ] **Step 3: Verify** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0014_notification_prefs.sql lib/dashboard/nav.ts
git commit -m "feat(m5): notification_prefs column (0014) + enable cards/settings nav"
```

---

### Task 4: Seed a card per account

**Files:**
- Modify: `app/dashboard/actions.ts`

- [ ] **Step 1: Add the import** at the top of `app/dashboard/actions.ts`:

```ts
import { buildCard } from "@/lib/cards";
```

- [ ] **Step 2: Insert cards after the transactions insert.** Locate the block that inserts `txnRows` (and returns on `txnErr`). Immediately AFTER that block and BEFORE the notifications insert, add:

```ts
  const cardRows = inserted.map((acc, i) => ({
    ...buildCard(seed + i + 1, { now }),
    account_id: acc.id,
  }));
  const { error: cardErr } = await supabase.from("cards").insert(cardRows);
  if (cardErr) {
    return { error: "Could not create demo cards. Please try again." };
  }
```
(`seed`, `now`, and `inserted` already exist in `seedDemoData`. `buildCard` returns `brand/type/last4/exp_month/exp_year/is_virtual/status`; spreading + `account_id` matches the `cards` columns.)

- [ ] **Step 3: Verify** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/actions.ts
git commit -m "feat(m5): seed a debit card per account"
```

---

## Phase 3 — Data layer + actions

### Task 5: Data layer (cards, profile)

**Files:**
- Create: `lib/data/cards.ts`, `lib/data/profile.ts`

- [ ] **Step 1: `lib/data/cards.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export type Card = {
  id: string;
  account_id: string;
  brand: string;
  type: "debit" | "credit";
  last4: string;
  exp_month: number;
  exp_year: number;
  status: "active" | "frozen" | "cancelled";
  is_virtual: boolean;
};

export async function getCards(): Promise<Card[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cards")
    .select("id, account_id, brand, type, last4, exp_month, exp_year, status, is_virtual")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as Card[];
}
```

- [ ] **Step 2: `lib/data/profile.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export type NotificationPrefsValue = {
  product: boolean;
  security: boolean;
  transfers: boolean;
};

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  avatar_url: string | null;
  notification_prefs: NotificationPrefsValue;
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
    .select("id, full_name, phone, country, avatar_url, notification_prefs")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    notification_prefs: { ...DEFAULT_PREFS, ...(data.notification_prefs ?? {}) },
  } as Profile;
}
```

- [ ] **Step 3: Verify** `npx tsc --noEmit` → 0 errors (if `data.notification_prefs` is typed loosely, the spread still compiles; add `as Record<string, unknown>` to it if needed).

- [ ] **Step 4: Commit**

```bash
git add lib/data/cards.ts lib/data/profile.ts
git commit -m "feat(m5): data layer (cards, profile)"
```

---

### Task 6: Card actions

**Files:**
- Create: `app/dashboard/cards/actions.ts`

- [ ] **Step 1: Implement** — `app/dashboard/cards/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCard } from "@/lib/cards";

export type CardResult = { error: string } | { ok: true };

export async function requestVirtualCard(accountId: string): Promise<CardResult> {
  if (!accountId) return { error: "Choose an account." };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  // Confirm the account belongs to the user (RLS also enforces this on insert).
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return { error: "Account not found." };

  const seed = Math.floor(new Date().getTime() % 1_000_000);
  const card = buildCard(seed, { isVirtual: true });
  const { error } = await supabase.from("cards").insert({ ...card, account_id: accountId });
  if (error) return { error: "Could not create the card. Please try again." };
  revalidatePath("/dashboard/cards");
  return { ok: true };
}

export async function setCardStatus(
  cardId: string,
  status: "active" | "frozen"
): Promise<CardResult> {
  if (status !== "active" && status !== "frozen") return { error: "Invalid status." };
  const supabase = createClient();
  const { error } = await supabase.from("cards").update({ status }).eq("id", cardId);
  if (error) return { error: "Could not update the card. Please try again." };
  revalidatePath("/dashboard/cards");
  return { ok: true };
}
```
Card update/insert are owner-scoped by the M1 `cards` RLS policies (account-ownership subquery).

- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/dashboard/cards/actions.ts"
git commit -m "feat(m5): card actions (request virtual card, set status)"
```

---

### Task 7: Settings actions

**Files:**
- Create: `app/dashboard/settings/actions.ts`

- [ ] **Step 1: Implement** — `app/dashboard/settings/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, passwordSchema, notificationPrefsSchema } from "@/lib/validations/profile";

export type SettingsResult = { error: string } | { ok: true };

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function updateProfile(formData: FormData): Promise<SettingsResult> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || undefined,
    country: formData.get("country") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      country: parsed.data.country || null,
    })
    .eq("id", user.id);
  if (error) return { error: "Could not save your profile. Please try again." };
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function uploadAvatar(formData: FormData): Promise<SettingsResult> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (!file.type.startsWith("image/")) return { error: "Please choose an image file." };
  if (file.size > MAX_AVATAR_BYTES) return { error: "Image must be 2 MB or smaller." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: "Could not upload the image. Please try again." };

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: pub.publicUrl })
    .eq("id", user.id);
  if (updateError) return { error: "Uploaded, but could not save the avatar. Please try again." };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updatePassword(formData: FormData): Promise<SettingsResult> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("should be different") || m.includes("same")) {
      return { error: "Choose a password different from your current one." };
    }
    if (m.includes("weak") || m.includes("password")) {
      return { error: "That password is too weak. Try a longer one." };
    }
    return { error: "Could not update your password. Please try again." };
  }
  return { ok: true };
}

export async function updateNotificationPrefs(formData: FormData): Promise<SettingsResult> {
  const parsed = notificationPrefsSchema.safeParse({
    product: formData.get("product") === "on" || formData.get("product") === "true",
    security: formData.get("security") === "on" || formData.get("security") === "true",
    transfers: formData.get("transfers") === "on" || formData.get("transfers") === "true",
  });
  if (!parsed.success) return { error: "Could not save preferences." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: parsed.data })
    .eq("id", user.id);
  if (error) return { error: "Could not save preferences. Please try again." };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
```
If `error.message` typing on `updateUser` complains, read as `(error as { message: string }).message`.

- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/dashboard/settings/actions.ts"
git commit -m "feat(m5): settings actions (profile, avatar, password, notification prefs)"
```

---

## Phase 4 — Cards UI

### Task 8: Card visual + grid + page

**Files:**
- Create: `components/dashboard/card-visual.tsx`, `components/dashboard/cards-grid.tsx`, `app/dashboard/cards/page.tsx`

- [ ] **Step 1: `components/dashboard/card-visual.tsx`**

```tsx
import type { Card as CardType } from "@/lib/data/cards";
import { cn } from "@/lib/utils";

const MONTHS = (m: number) => String(m).padStart(2, "0");

export function CardVisual({ card }: { card: CardType }) {
  const frozen = card.status !== "active";
  return (
    <div
      className={cn(
        "relative aspect-[1.6] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-navy-900 p-5 text-white shadow-card",
        frozen && "opacity-60 grayscale"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-white/70">
          {card.is_virtual ? "Virtual" : "Crest"} {card.type}
        </span>
        <span className="text-sm font-semibold">{card.brand}</span>
      </div>
      <p className="mt-8 font-mono text-lg tracking-widest">•••• •••• •••• {card.last4}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-white/80">
        <span>EXP {MONTHS(card.exp_month)}/{String(card.exp_year).slice(-2)}</span>
        <span className="uppercase">{card.status}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `components/dashboard/cards-grid.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Snowflake, Sun, Plus } from "lucide-react";
import type { Card as CardType } from "@/lib/data/cards";
import type { Account } from "@/lib/data/accounts";
import { requestVirtualCard, setCardStatus } from "@/app/dashboard/cards/actions";
import { nextCardStatus } from "@/lib/cards";
import { accountTypeLabel } from "@/lib/dashboard/constants";
import { CardVisual } from "@/components/dashboard/card-visual";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CardsGrid({ cards, accounts }: { cards: CardType[]; accounts: Account[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  function toggle(card: CardType) {
    setError(null);
    startTransition(async () => {
      const result = await setCardStatus(card.id, nextCardStatus(card.status));
      if ("error" in result) setError(result.error);
    });
  }

  function request() {
    setError(null);
    startTransition(async () => {
      const result = await requestVirtualCard(accountId);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div className="flex-1">
            <label htmlFor="card-account" className="mb-1 block text-sm font-medium">Request a virtual card for</label>
            <select
              id="card-account"
              className="flex h-11 w-full max-w-sm rounded-xl border border-input bg-background px-4 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{accountTypeLabel(a.type)}</option>
              ))}
            </select>
          </div>
          <Button onClick={request} disabled={pending || accounts.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" /> Request virtual card
          </Button>
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}

      {cards.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-16 text-center text-sm text-muted-foreground">
            No cards yet. Request your first card above.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.id} className="space-y-3">
              <CardVisual card={card} />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={pending || card.status === "cancelled"}
                onClick={() => toggle(card)}
              >
                {card.status === "active" ? (
                  <><Snowflake className="mr-1.5 h-4 w-4" /> Freeze</>
                ) : (
                  <><Sun className="mr-1.5 h-4 w-4" /> Unfreeze</>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `app/dashboard/cards/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getCards } from "@/lib/data/cards";
import { getAccounts } from "@/lib/data/accounts";
import { CardsGrid } from "@/components/dashboard/cards-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cards" };

export default async function CardsPage() {
  const [cards, accounts] = await Promise.all([getCards(), getAccounts()]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Cards</h1>
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
        <CardsGrid cards={cards} accounts={accounts} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/card-visual.tsx components/dashboard/cards-grid.tsx "app/dashboard/cards/page.tsx"
git commit -m "feat(m5): cards page (view, request, freeze/unfreeze)"
```

---

## Phase 5 — Settings UI + avatar in shell

### Task 9: Settings forms

**Files:**
- Create: `components/dashboard/profile-form.tsx`, `components/dashboard/avatar-uploader.tsx`, `components/dashboard/password-form.tsx`, `components/dashboard/notifications-form.tsx`

- [ ] **Step 1: `components/dashboard/profile-form.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";
import { updateProfile } from "@/app/dashboard/settings/actions";
import type { Profile } from "@/lib/data/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? undefined,
      country: profile.country ?? undefined,
    },
  });

  function onSubmit(values: ProfileInput) {
    setMsg(null);
    const fd = new FormData();
    fd.set("full_name", values.full_name);
    fd.set("phone", values.phone ?? "");
    fd.set("country", values.country ?? "");
    startTransition(async () => {
      const result = await updateProfile(fd);
      setMsg("error" in result ? { text: result.error } : { ok: true, text: "Profile saved." });
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-rose-500/10 text-rose-500"}`}>
          {msg.text}
        </p>
      )}
      <div>
        <label htmlFor="pf-name" className="mb-1 block text-sm font-medium">Full name</label>
        <Input id="pf-name" aria-invalid={!!errors.full_name} {...register("full_name")} />
        {errors.full_name && <p className="mt-1 text-xs text-rose-500">{errors.full_name.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-phone" className="mb-1 block text-sm font-medium">Phone</label>
          <Input id="pf-phone" {...register("phone")} />
        </div>
        <div>
          <label htmlFor="pf-country" className="mb-1 block text-sm font-medium">Country</label>
          <Input id="pf-country" {...register("country")} />
        </div>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}
```

- [ ] **Step 2: `components/dashboard/avatar-uploader.tsx`**

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { uploadAvatar } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";

export function AvatarUploader({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initial = (name || "?").charAt(0).toUpperCase();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("avatar", file);
    startTransition(async () => {
      const result = await uploadAvatar(fd);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-4">
      {avatarUrl ? (
        <Image src={avatarUrl} alt="Your profile photo" width={64} height={64} className="h-16 w-16 rounded-full object-cover" unoptimized />
      ) : (
        <span className="grid h-16 w-16 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground" aria-hidden>
          {initial}
        </span>
      )}
      <div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} aria-label="Upload profile photo" />
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? "Uploading…" : "Upload photo"}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">PNG or JPG, up to 2 MB.</p>
        {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
      </div>
    </div>
  );
}
```
NOTE: uses `next/image` with `unoptimized` (Supabase public URL; avoids needing a `remotePatterns` config). If lint/build complains about the domain, `unoptimized` covers it.

- [ ] **Step 3: `components/dashboard/password-form.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { passwordSchema, type PasswordInput } from "@/lib/validations/profile";
import { updatePassword } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { PasswordInput as PasswordField } from "@/components/auth/password-input";

export function PasswordForm() {
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordInput>({ resolver: zodResolver(passwordSchema) });

  function onSubmit(values: PasswordInput) {
    setMsg(null);
    const fd = new FormData();
    fd.set("password", values.password);
    fd.set("confirmPassword", values.confirmPassword);
    startTransition(async () => {
      const result = await updatePassword(fd);
      if ("error" in result) setMsg({ text: result.error });
      else {
        setMsg({ ok: true, text: "Password updated." });
        reset();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-rose-500/10 text-rose-500"}`}>
          {msg.text}
        </p>
      )}
      <div>
        <label htmlFor="pw-new" className="mb-1 block text-sm font-medium">New password</label>
        <PasswordField id="pw-new" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        {errors.password && <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>}
      </div>
      <div>
        <label htmlFor="pw-confirm" className="mb-1 block text-sm font-medium">Confirm new password</label>
        <PasswordField id="pw-confirm" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
        {errors.confirmPassword && <p className="mt-1 text-xs text-rose-500">{errors.confirmPassword.message}</p>}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Updating…" : "Update password"}</Button>
    </form>
  );
}
```

- [ ] **Step 4: `components/dashboard/notifications-form.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateNotificationPrefs } from "@/app/dashboard/settings/actions";
import type { NotificationPrefsValue } from "@/lib/data/profile";
import { Button } from "@/components/ui/button";

const ITEMS: { key: keyof NotificationPrefsValue; label: string; desc: string }[] = [
  { key: "product", label: "Product updates", desc: "News about features and improvements." },
  { key: "security", label: "Security alerts", desc: "Sign-ins and security-related activity." },
  { key: "transfers", label: "Transfer activity", desc: "Notifications when money moves." },
];

export function NotificationsForm({ prefs }: { prefs: NotificationPrefsValue }) {
  const [state, setState] = useState<NotificationPrefsValue>(prefs);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMsg(null);
    const fd = new FormData();
    fd.set("product", state.product ? "true" : "false");
    fd.set("security", state.security ? "true" : "false");
    fd.set("transfers", state.transfers ? "true" : "false");
    startTransition(async () => {
      const result = await updateNotificationPrefs(fd);
      setMsg("error" in result ? { text: result.error } : { ok: true, text: "Preferences saved." });
    });
  }

  return (
    <div className="space-y-4">
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-rose-500/10 text-rose-500"}`}>
          {msg.text}
        </p>
      )}
      <ul className="space-y-3">
        {ITEMS.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-4">
            <label htmlFor={`nt-${item.key}`} className="cursor-pointer">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.desc}</span>
            </label>
            <input
              id={`nt-${item.key}`}
              type="checkbox"
              className="h-5 w-5 rounded border-input"
              checked={state[item.key]}
              onChange={(e) => setState((s) => ({ ...s, [item.key]: e.target.checked }))}
            />
          </li>
        ))}
      </ul>
      <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save preferences"}</Button>
    </div>
  );
}
```

- [ ] **Step 5: Verify** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/profile-form.tsx components/dashboard/avatar-uploader.tsx components/dashboard/password-form.tsx components/dashboard/notifications-form.tsx
git commit -m "feat(m5): settings forms (profile, avatar, password, notifications)"
```

---

### Task 10: Settings page

**Files:**
- Create: `app/dashboard/settings/page.tsx`

- [ ] **Step 1: Implement** — `app/dashboard/settings/page.tsx`

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data/profile";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { AvatarUploader } from "@/components/dashboard/avatar-uploader";
import { PasswordForm } from "@/components/dashboard/password-form";
import { NotificationsForm } from "@/components/dashboard/notifications-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/dashboard/settings");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarUploader avatarUrl={profile.avatar_url} name={profile.full_name ?? ""} />
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationsForm prefs={profile.notification_prefs} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/dashboard/settings/page.tsx"
git commit -m "feat(m5): settings page"
```

---

### Task 11: Avatar in the dashboard shell

**Files:**
- Modify: `app/dashboard/layout.tsx`, `components/dashboard/topbar.tsx`, `components/dashboard/user-menu.tsx`

- [ ] **Step 1: `app/dashboard/layout.tsx`** — load the profile avatar and pass it to `Topbar`. Add the import and fetch, then pass `avatarUrl`:

Add import near the others:
```ts
import { getProfile } from "@/lib/data/profile";
```
After `const notifications = await getNotifications();` add:
```ts
  const profile = await getProfile();
```
Change the `<Topbar ... />` usage to include the avatar:
```tsx
        <Topbar
          name={name}
          email={user.email ?? ""}
          notifications={notifications}
          avatarUrl={profile?.avatar_url ?? null}
        />
```

- [ ] **Step 2: `components/dashboard/topbar.tsx`** — accept and forward `avatarUrl`. Update the props type and the `UserMenu` usage:

Change the component signature to:
```tsx
export function Topbar({
  name,
  email,
  notifications,
  avatarUrl,
}: {
  name: string;
  email: string;
  notifications: Notification[];
  avatarUrl: string | null;
}) {
```
And change the `<UserMenu .../>` to:
```tsx
        <UserMenu name={name} email={email} avatarUrl={avatarUrl} />
```

- [ ] **Step 3: `components/dashboard/user-menu.tsx`** — accept `avatarUrl` and render an image when present. Add the import:
```ts
import Image from "next/image";
```
Change the signature to `export function UserMenu({ name, email, avatarUrl }: { name: string; email: string; avatarUrl: string | null }) {` and replace the trigger's inner content (the initial) with:
```tsx
      <DropdownMenuTrigger
        className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Open user menu"
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={36} height={36} className="h-9 w-9 object-cover" unoptimized />
        ) : (
          initial
        )}
      </DropdownMenuTrigger>
```
(Keep the existing `const initial = ...` line.)

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/layout.tsx components/dashboard/topbar.tsx components/dashboard/user-menu.tsx
git commit -m "feat(m5): show profile avatar in the dashboard shell"
```

---

## Phase 6 — Docs & final verification

### Task 12: README M5 docs

**Files:** Modify `README.md`

- [ ] **Step 1: Add a "Cards & Settings (M5)" section** documenting:
  - Apply migration `0014_notification_prefs.sql` (after 0001–0013).
  - Ensure the `avatars` Storage bucket + policies exist (from M1's `0010`).
  - Manual test plan: (re-)seed shows a card per account; **Freeze/Unfreeze** toggles a card; **Request virtual card** adds one; Settings → **Profile** save persists; **Upload photo** stores an avatar that appears in the topbar; Settings → **Security** change password then log out and back in with the new password; Settings → **Notifications** toggle + save persists on reload.
  - Update **Roadmap**: mark M5 done — all milestones complete.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: cards & settings setup + manual test plan (M5)"
```

---

### Task 13: Final verification gate

- [ ] **Step 1: Tests** — `npm run test` → all pass (cards, profile schemas + prior).
- [ ] **Step 2: Types** — `npx tsc --noEmit` → 0 errors.
- [ ] **Step 3: Lint** — `npm run lint` → 0 errors.
- [ ] **Step 4: Build** — `npm run build` → succeeds; routes include `/dashboard/cards`, `/dashboard/settings`; Middleware emitted. (Retry once on a fonts socket error; `dangerouslyDisableSandbox: true` if sandbox blocks npm.)
- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(m5): verification fixes"
```

---

## Self-Review Notes (coverage vs spec)

- §2 migration 0014 → Task 3. ✓
- §3 architecture (data, actions, components, nav, seed, shell avatar) → Tasks 3–11. ✓
- §4 data flow (cards, settings, avatar display) → Tasks 6,7,8,9,10,11. ✓
- §5 pure functions (buildCard, nextCardStatus, profile/password/prefs schemas) → Tasks 1,2. ✓
  (`buildDemoCards` dropped in favor of reusing `buildCard` in the seed — Task 4.)
- §6 UI (cards page, settings sections, toggles, avatar) → Tasks 8,9,10,11. ✓
- §7 error handling (avatar type/size, password mapping, status validation) → Tasks 6,7. ✓
- §8 security (owner-scoped writes, avatar path prefix, server-side validation) → Tasks 6,7. ✓
- §9 testing (unit + manual plan) → Tasks 1,2,12. ✓
- §10 acceptance criteria → Task 13 + manual plan. ✓

**Type consistency:** `Card` (Task 5) consumed by `CardVisual`/`CardsGrid` (Task 8); `nextCardStatus` (Task 1) used in `CardsGrid`; `setCardStatus(id, status)`/`requestVirtualCard(accountId)` signatures match between Task 6 and Task 8. `Profile`/`NotificationPrefsValue` (Task 5) flow into settings page + forms (Tasks 9,10). `ProfileInput`/`PasswordInput` from `lib/validations/profile` (Task 2) used by forms. `uploadAvatar`/`updateProfile`/`updatePassword`/`updateNotificationPrefs` (Task 7) called by the forms (Task 9). `Topbar`/`UserMenu` gain `avatarUrl` consistently (Task 11). `buildCard` reused by the seed (Task 4) and card action (Task 6). `createClient()` sync throughout.
