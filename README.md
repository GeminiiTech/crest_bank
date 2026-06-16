# Crest Bank

A premium digital-banking website — marketing site, design system, and the full Supabase
backend foundation. Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and
classic Radix-based shadcn/ui.

> **Milestone 1 (this repo):** scaffold, design system, complete responsive landing page,
> Supabase wiring (credentials-optional), and the full 8-table Postgres backend (schema,
> indexes, triggers, RLS, storage) as migrations. Auth pages, the customer dashboard, and the
> About/Services/Contact pages are planned for later milestones (see [Roadmap](#roadmap)).

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript (strict) |
| Styling | Tailwind CSS **v3** |
| Components | shadcn/ui — classic **Radix** primitives (`asChild` API) |
| Animation | Framer Motion (subtle scroll reveals only) |
| Backend / DB / Auth / Storage | Supabase (PostgreSQL, Auth, Storage) |
| Forms / validation | React Hook Form + Zod |
| Fonts | Sora (display) + Inter (body) via `next/font` |
| Tests | Vitest + Testing Library |

> **Stack note:** This project deliberately uses Tailwind **v3** + the classic **Radix**
> shadcn components. Do **not** run `npx shadcn add` — the current CLI default installs a
> Tailwind-v4 / `@base-ui/react` flavor that is incompatible with this setup. Add new
> primitives by hand-authoring the classic Radix component files in `components/ui/`.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase keys (optional for the marketing site)
npm run dev                  # http://localhost:3000
```

The marketing site runs **without** Supabase credentials — the Supabase clients are guarded
and only error if actually invoked, and the session middleware no-ops when env is absent.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (fetches Google Fonts at build time) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (unit tests) |

## Environment variables

Copy `.env.example` → `.env.local`:

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Privileged key — never import into client code |
| `NEXT_PUBLIC_SITE_URL` | public | App origin used to build auth email confirmation links (e.g. `http://localhost:3000`). Falls back to the request `Origin` header when unset. |

The service-role key bypasses RLS and must only ever be used in server-side code (API route
handlers, server actions). It is not referenced anywhere in the current codebase.

## Supabase setup & migrations

1. Create a project at [supabase.com](https://supabase.com).
2. Put the URL and anon key in `.env.local` (and the service-role key for server use).
3. Apply the migrations in `supabase/migrations/` **in numeric order, `0001` → `0011`**.

Apply options:

- **SQL Editor:** paste each file's contents in order and run.
- **Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`
  (or `supabase db reset` against a local stack to validate end-to-end).

Migration order matters — foreign keys, the shared `set_updated_at()` function, and the
`handle_new_user()` trigger depend on earlier files:

| File | Creates |
|---|---|
| `0001_extensions.sql` | `pgcrypto`, shared `set_updated_at()` trigger fn |
| `0002_profiles.sql` | `profiles` (1:1 with `auth.users`) + auto-create trigger |
| `0003_accounts.sql` | `accounts` |
| `0004_beneficiaries.sql` | `beneficiaries` |
| `0005_transactions.sql` | `transactions` (+ search/filter indexes) |
| `0006_transfers.sql` | `transfers` |
| `0007_cards.sql` | `cards` |
| `0008_notifications.sql` | `notifications` |
| `0009_support_tickets.sql` | `support_tickets` |
| `0010_storage_buckets.sql` | `avatars`, `kyc-documents`, `marketing-assets` buckets + storage RLS |
| `0011_rls_policies.sql` | Enables RLS + owner policies on all 8 tables |

## Authentication (M2)

Email/password **registration** and **login** with **required email verification**, built on
Supabase Auth via Next.js Server Actions. Route protection runs in the session middleware.

### Required Supabase dashboard settings

1. **Authentication → Providers → Email:** enabled, with **"Confirm email" ON**.
2. **Authentication → URL Configuration:**
   - **Site URL:** your app origin (e.g. `http://localhost:3000`; your deployed URL in prod).
   - **Redirect URLs:** add `<origin>/auth/confirm` (e.g. `http://localhost:3000/auth/confirm`).
3. **Authentication → Email Templates → Confirm signup:** point the link at
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
   (The default `{{ .ConfirmationURL }}` also works — the `/auth/confirm` route falls back to
   `exchangeCodeForSession` when a `code` param is present.)
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (recommended)
   `NEXT_PUBLIC_SITE_URL` in `.env.local`, then restart the dev server.

### Manual test plan

1. Go to `/register`, fill the form, submit → you land on `/verify-email`.
2. Open the confirmation email → click the link → you land on `/dashboard`.
3. Try `/login` **before** confirming → blocked with "Please confirm your email first."
4. Log in with confirmed credentials → `/dashboard`; wrong credentials → "Incorrect email or password."
5. While logged out, visit `/dashboard` → redirected to `/login?next=/dashboard`.
6. While logged in, visit `/login` or `/register` → redirected to `/dashboard`.
7. Click **Sign out** → session cleared, back to `/login`.

## Dashboard (M3)

The authenticated dashboard: a persistent shell (sidebar + topbar), an Overview (balances,
spending chart, insights, recent activity, notifications), and Accounts (list + per-account
detail with a derived balance-history chart). Charts use Recharts; balance history is
reconstructed from transactions (no separate history table).

### Setup
- Apply migration `0012_notifications_insert_policy.sql` **after** `0001`–`0011` (it lets the
  per-user demo seed create notifications).
- No new env vars. Recharts is bundled.

### Manual test plan
1. Log in → `/dashboard` shows the shell with an **empty state** (no accounts yet).
2. Click **Set up demo data** → 2 accounts + ~27 transactions + 3 notifications are created;
   the overview populates (balance cards, spending-by-category chart, insights, recent
   activity, notifications). Clicking again does nothing (**idempotent**).
3. **Accounts** → two account cards (masked numbers, balances). Open one → header, a
   **balance-history** chart, and that account's transactions.
4. Visit a foreign/unknown account id (`/dashboard/accounts/<random-uuid>`) → **404**
   (RLS scopes accounts to the owner).
5. Mobile: the sidebar collapses into a drawer from the topbar menu button.

## Transfers, Beneficiaries & Transactions (M4)

Money movement and transaction management: beneficiaries CRUD, internal/external transfers,
and a searchable/filterable/paginated transactions page with CSV export.

### Setup
- Apply migration `0013_execute_transfer.sql` **after** 0001–0012. It adds the atomic
  `execute_transfer` Postgres function **and drops the M1 `accounts update own` policy** —
  after this, account balances can only change via the function (clients can no longer write
  `accounts` directly).

### How money moves
All balance changes run through one `SECURITY DEFINER` function, `execute_transfer`, in a
single row-locked transaction: it verifies ownership via `auth.uid()`, checks funds, then
debits/credits and writes the transaction + transfer rows atomically. External transfers debit
the sender and are recorded **completed (simulated)** — there's no real settlement rail.

### Manual test plan
1. **Beneficiaries** → "Add beneficiary"; edit and delete one.
2. **Transfers** → "Between my accounts": move an amount; both balances change, two
   transactions appear, and "Recent transfers" updates.
3. **Transfers** → "To a beneficiary": the source is debited and one transaction is recorded.
4. Try an amount over your balance → "not enough funds", **no change**. Try the same source
   and destination → blocked.
5. **Transactions** → filter by account/type/category/date + search; paginate; click
   **Export CSV** to download the filtered set.

## Onboarding tour

New users get a skippable **spotlight tour** of the dashboard sidebar on their first visit
(highlights each section with a tooltip; Next/Back/Skip, Esc to exit). It's remembered in the
browser via the `localStorage` key `crest_tour_seen`, so it won't auto-show again — and the
**"Take the tour"** button in the dashboard topbar replays it anytime. No backend or migration;
to re-trigger the auto-start, clear that key in your browser dev tools.

## Cards & Settings (M5)

Card management and account settings — the final feature milestone.

### Setup
- Apply migration `0014_notification_prefs.sql` (after 0001–0013) — adds `profiles.notification_prefs`.
- Ensure the `avatars` Storage bucket + policies exist (created in M1's `0010`).

### Manual test plan
1. **Cards** → (re-)seeding creates a debit card per account. **Freeze/Unfreeze** toggles a
   card's status and dims it. **Request virtual card** (pick an account) adds a virtual card.
2. **Settings → Profile** → edit name/phone/country and Save (persists); **Upload photo** stores
   an avatar that then appears in the topbar / user menu.
3. **Settings → Security** → set a new password (≥8 + confirm), then log out and back in with it.
4. **Settings → Notifications** → toggle the three preferences and Save; reload to confirm they persist.

Cards are simulated (only `last4` is stored). Password change uses the active session (no
current-password step).

## Architecture

```
app/
  (marketing)/        route group: navbar + footer shell, landing + stub pages
  (auth)/             login, register, verify-email (+ actions.ts server actions)
  auth/confirm/       email-confirmation GET route
  dashboard/          authed app: overview, accounts, beneficiaries, transfers,
                      transactions (+ export), cards, settings (+ all server actions)
supabase/migrations/  0013 atomic transfer fn + balance lockdown; 0014 notification_prefs
  design-system/      living style guide (noindex)
  layout.tsx          fonts + metadata
components/
  ui/                 classic Radix shadcn primitives
  auth/               login-form, register-form, password-input
  marketing/          landing sections (hero, stats, features, …)
  shared/             navbar, footer, logo, motion/reveal
lib/
  auth/               redirects.ts (pure resolveAuthRedirect/sanitizeNext)
  supabase/           client.ts, server.ts, middleware.ts (creds-optional + route gating)
  validations/        zod schemas (newsletter, auth)
  constants.ts        typed page content (single source of truth)
supabase/migrations/  numbered SQL (schema, indexes, triggers, RLS, storage)
middleware.ts         session refresh + auth route protection
```

- **Design tokens** are CSS variables in `app/globals.css` (HSL channels) mapped into
  `tailwind.config.ts`, so shadcn semantic classes (`bg-primary`, `text-muted-foreground`)
  and the brand `navy` scale resolve consistently. Palette: deep navy + azure accent +
  mint success.
- **Content is data-driven** from `lib/constants.ts` — sections render from typed arrays.
- **Motion** uses a single `Reveal` wrapper (fade + rise on scroll, once), and
  `prefers-reduced-motion` is respected globally.

## Security

- **RLS deny-by-default** on every table; owner-scoped policies (`auth.uid()`), with
  account-owned tables scoped through the account-ownership chain.
- **Financial immutability:** `transactions` and `transfers` have no client update/delete
  policies; `accounts` has no client delete policy. Balance-mutating writes are reserved for
  server-side service-role routes (built in M4).
- **Profiles** are created by a `SECURITY DEFINER` trigger on signup (no client insert).
- **Service-role key** is server-only and unused in client bundles.
- **Security headers** (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`) are set in `next.config.mjs`.
- **Validation:** all forms use Zod schemas; Supabase queries are parameterized.
- **Auth writes are server-side** (Server Actions, anon key only); login errors are generic to
  limit account enumeration; `next`/redirect params are sanitized to internal paths (no open
  redirect); email confirmation links use a configured site URL, not the inbound `Origin`.
- **Rate limiting:** M2 relies on Supabase Auth's built-in limits; app-level per-IP/per-user
  limiting on custom mutating routes (e.g. Upstash Ratelimit) lands with those routes in M4.

## Roadmap

- **M1 (done):** foundation — design system, landing page, Supabase wiring, full DB backend.
- **M2 (done):** auth — email/password register + login, required email verification,
  protected-route middleware, protected dashboard stub. (Password reset deferred.)
- **M3 (done):** dashboard shell, overview (balances, spending chart, insights, activity,
  notifications), accounts (list + detail with balance-history), per-user demo seed.
- **M4 (done):** beneficiaries CRUD, internal/external transfers (atomic `execute_transfer`
  RPC; client account-balance writes locked down), transactions page (search/filter/paginate/CSV).
- **M5 (done):** cards (view, request virtual, freeze/unfreeze) + settings (profile + avatar
  upload, change password, notification preferences). **All milestones complete.**

---

This is a demonstration project, not a real financial offering.
