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

## Architecture

```
app/
  (marketing)/        route group: navbar + footer shell, landing + stub pages
  login, register/    auth route stubs (full flow in M2)
  design-system/      living style guide (noindex)
  layout.tsx          fonts + metadata
components/
  ui/                 classic Radix shadcn primitives
  marketing/          landing sections (hero, stats, features, …)
  shared/             navbar, footer, logo, motion/reveal
lib/
  supabase/           client.ts, server.ts, middleware.ts (creds-optional)
  validations/        zod schemas
  constants.ts        typed page content (single source of truth)
supabase/migrations/  numbered SQL (schema, indexes, triggers, RLS, storage)
middleware.ts         session refresh (route gating lands in M2)
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
- **Rate limiting (planned, M2):** mutating API route handlers will apply a per-IP +
  per-user token-bucket limit (e.g. Upstash Ratelimit) before touching the database.

## Roadmap

- **M1 (done):** foundation — design system, landing page, Supabase wiring, full DB backend.
- **M2:** auth (login/register/reset/verify) + protected-route middleware.
- **M3:** dashboard overview + accounts.
- **M4:** transfers, beneficiaries, transactions (server-side balance mutations).
- **M5:** cards + settings.

---

This is a demonstration project, not a real financial offering.
