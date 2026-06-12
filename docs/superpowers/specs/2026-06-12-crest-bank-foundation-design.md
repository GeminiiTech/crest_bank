# Crest Bank — Foundation & Design System (Milestone 1) — Design Spec

**Date:** 2026-06-12
**Status:** Approved for spec review
**Author:** Engineering (with Kene)

---

## 1. Context & Goal

Crest Bank is a new premium digital-banking brand. This spec covers **Milestone 1: the
foundation** — the scaffold, design system, Supabase wiring, the complete public landing
page, and the full database backend (schema + RLS + storage). It is the base every later
milestone builds on.

Reference screenshots (a competitor, "Nova First Banking") inform the dark-navy,
trustworthy banking aesthetic. We take inspiration for hierarchy and feel only — we do not
copy layout, copy, or branding.

### Brand decisions (confirmed)
- **Name:** Crest Bank (new brand; ignore "Nova First Banking" naming in references).
- **Aesthetic:** elevated dark-navy premium banking — improved hierarchy/spacing/polish vs references.
- **Supabase:** all migrations + client code written now; credentials supplied later via env. The marketing site runs without a live DB connection.
- **Backend in M1:** full 9-table schema, RLS, indexes, storage buckets committed now.

### Out of scope for M1 (later milestones)
- **M2:** Auth pages (login/register/reset/verify) + protected-route middleware enforcement.
- **M3:** Dashboard overview + accounts.
- **M4:** Transfers, beneficiaries, transactions.
- **M5:** Cards, settings.
- About / Services / Contact marketing pages (M1 ships landing only; routes stubbed).

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14+ (App Router) + TypeScript (strict) |
| Styling | Tailwind CSS |
| Components | shadcn/ui (Radix primitives) |
| Animation | Framer Motion (subtle only) |
| Backend/DB/Auth/Storage | Supabase (PostgreSQL, Auth, Storage) |
| Forms/Validation | React Hook Form + Zod |
| Fonts | Sora (display) + Inter (body) via `next/font` |
| Icons | lucide-react |

Package manager: npm. Node 18+.

---

## 3. Design System

### 3.1 Color tokens (CSS variables, HSL, light + dark surfaces)

The site uses a **navy ↔ light rhythm**: dark navy hero/CTA/footer sections alternating
with light content sections, as in the references but more deliberate.

| Token | Value (hex ref) | Use |
|---|---|---|
| `navy-950` | `#08152B` | deepest backgrounds |
| `navy-900` | `#0A1A2F` | primary dark surface (hero, footer) |
| `navy-800` | `#0E2542` | raised dark cards |
| `navy-700` | `#16335C` | dark borders / hover |
| `azure-500` | `#2D6FF0` | primary accent / CTAs |
| `azure-600` | `#1E5AD6` | CTA hover |
| `azure-400` | `#5B8DF5` | accent on dark |
| `mint-500` | `#10B981` | success / positive balance |
| `rose-500` | `#E11D48` | error / negative / required `*` |
| `slate-50…900` | standard | neutral text/surfaces on light sections |

- **Light section:** background `slate-50`/white, text `navy-900`, muted `slate-500`.
- **Dark section:** background `navy-900`, text `slate-50`, muted `slate-400`.
- Tokens defined as CSS vars in `globals.css` and mapped in `tailwind.config.ts` so shadcn
  `bg-background`, `text-foreground`, `bg-primary`, etc. resolve correctly.
- **Contrast:** all text/background pairings meet WCAG AA (≥4.5:1 body, ≥3:1 large).

### 3.2 Typography
- **Display:** Sora — headings, tight tracking (`-0.02em`), weights 600/700.
- **Body:** Inter — paragraphs/UI, weight 400/500.
- Scale (rem): `xs .75 / sm .875 / base 1 / lg 1.125 / xl 1.25 / 2xl 1.5 / 3xl 1.875 / 4xl 2.25 / 5xl 3 / 6xl 3.75`. Hero headline uses fluid `clamp()`.

### 3.3 Spacing, radius, shadow, motion
- **Spacing:** 8pt system (Tailwind default 4px scale, used in multiples of 2).
- **Container:** `max-w-7xl`, gutters `px-4 sm:px-6 lg:px-8`.
- **Radius:** `--radius: 0.75rem` (cards `rounded-2xl`, inputs/buttons `rounded-xl`).
- **Shadow:** soft layered — `shadow-sm` resting, `shadow-lg` raised; custom `shadow-card`.
- **Motion:** Framer Motion only for: fade+rise on scroll (`opacity 0→1`, `y 16→0`, ~0.4s
  ease-out, `viewport once`), gentle hover lift on cards/buttons (`y -2`, scale 1.01).
  Respect `prefers-reduced-motion` (disable transforms).

### 3.4 Documentation
A `/design-system` route (dev-facing, noindex) renders the palette, type scale, spacing,
buttons, and card variants as living documentation.

---

## 4. Project Structure

```
crest-bank/
├─ app/
│  ├─ (marketing)/
│  │  ├─ layout.tsx              # marketing shell (navbar + footer)
│  │  └─ page.tsx                # landing
│  ├─ design-system/page.tsx     # living style guide (noindex)
│  ├─ layout.tsx                 # root: fonts, metadata, html lang
│  ├─ globals.css                # tokens + base
│  └─ not-found.tsx
├─ components/
│  ├─ ui/                        # shadcn primitives (button, card, accordion, input...)
│  ├─ marketing/
│  │  ├─ hero.tsx
│  │  ├─ stats.tsx
│  │  ├─ features.tsx
│  │  ├─ benefits.tsx
│  │  ├─ security.tsx
│  │  ├─ testimonials.tsx
│  │  ├─ faq.tsx
│  │  └─ cta-band.tsx
│  └─ shared/
│     ├─ navbar.tsx
│     ├─ footer.tsx
│     ├─ logo.tsx
│     └─ motion/reveal.tsx       # reusable scroll-reveal wrapper
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts               # browser client
│  │  ├─ server.ts               # server client (cookies)
│  │  └─ middleware.ts           # session refresh helper
│  ├─ validations/               # zod (newsletter/contact stub in M1)
│  ├─ constants.ts               # nav links, stats, features, faqs data
│  └─ utils.ts                   # cn(), formatters
├─ supabase/
│  ├─ migrations/
│  │  ├─ 0001_extensions.sql
│  │  ├─ 0002_profiles.sql
│  │  ├─ 0003_accounts.sql
│  │  ├─ 0004_beneficiaries.sql
│  │  ├─ 0005_transactions.sql
│  │  ├─ 0006_transfers.sql
│  │  ├─ 0007_cards.sql
│  │  ├─ 0008_notifications.sql
│  │  ├─ 0009_support_tickets.sql
│  │  ├─ 0010_storage_buckets.sql
│  │  └─ 0011_rls_policies.sql
│  └─ seed.sql                   # optional demo data (dev only)
├─ middleware.ts                 # session refresh (enforcement lands in M2)
├─ .env.example
├─ tailwind.config.ts
├─ components.json               # shadcn config
└─ README.md
```

---

## 5. Landing Page Composition

Order top→bottom, alternating navy/light:

1. **Navbar** (sticky, transparent-over-hero → solid on scroll). Logo, links (Personal,
   Business, About, Contact — hrefs stubbed), "Log in" ghost + "Open account" primary.
   Mobile: hamburger → slide-over sheet.
2. **Hero** (navy) — eyebrow, fluid H1 value prop, subcopy, two CTAs ("Open an account",
   "Explore banking"), trust row (e.g. "FDIC-insured · 256-bit encryption"), abstract
   product visual (CSS/SVG card mock, no external image dependency).
3. **Stats band** (light) — 4 metrics (customers, assets, countries, uptime) in cards.
4. **Features overview** (light) — 6 feature cards (icon + title + copy): Personal Banking,
   Business Banking, Savings, Loans, Cards, Investments.
5. **Benefits** (navy) — 3–4 benefit rows with supporting visual; "why Crest" value props.
6. **Security highlights** (light) — encryption, fraud monitoring, biometric/2FA, insured;
   icon list + reassurance copy.
7. **Testimonials** (navy) — 3 customer quotes, name/role, subtle cards.
8. **FAQ** (light) — shadcn Accordion, 6–8 Q&As.
9. **CTA band** (azure/navy gradient) — final "Open your account today" + button.
10. **Footer** (navy-950) — brand blurb, link columns (Products, Company, Legal, Support),
    newsletter input (Zod-validated, stub submit), socials, copyright, regulatory line.

All section content sourced from `lib/constants.ts` (typed arrays) — no inline magic data.
All sections wrapped in `Reveal` for subtle scroll animation. Fully responsive
(mobile-first), semantic landmarks (`header/nav/main/section/footer`), `aria` labels.

---

## 6. Database Schema (full backend, M1)

All tables in `public`, owned via `auth.users` (Supabase Auth). UUID PKs
(`gen_random_uuid()`), `created_at`/`updated_at timestamptz default now()`, `updated_at`
maintained by a shared trigger. Money stored as `numeric(19,4)`; currency `char(3)`.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` PK=FK→`auth.users.id`, full_name, phone, country, avatar_url, kyc_status, role | 1:1 with auth user; auto-created via trigger on signup |
| `accounts` | id, user_id→profiles, account_number (unique), type (checking/savings/current/business), currency, balance, status | a user has many accounts |
| `beneficiaries` | id, user_id→profiles, name, bank_name, account_number, routing/iban, type (internal/external/wire), is_favorite | |
| `transactions` | id, account_id→accounts, type (credit/debit), category, amount, currency, status, description, counterparty, reference, created_at | indexed for search/filter/pagination |
| `transfers` | id, from_account_id→accounts, to_account_id (nullable), beneficiary_id (nullable), amount, currency, kind (internal/external/wire), status, reference, scheduled_at | spawns transactions |
| `cards` | id, account_id→accounts, brand, type (debit/credit), last4, exp_month, exp_year, status (active/frozen), is_virtual | freeze/unfreeze via status |
| `notifications` | id, user_id→profiles, title, body, type, is_read, created_at | |
| `support_tickets` | id, user_id→profiles, subject, body, category, status (open/pending/closed), priority, created_at | |

`profiles` replaces a separate `users` table — Supabase already provides `auth.users`; our
`profiles` row is the app-facing user record (standard Supabase pattern). The spec's
requested "users" + "profiles" map to `auth.users` + `public.profiles`.

### 6.1 Indexes
- `accounts(user_id)`, `accounts(account_number)` unique.
- `transactions(account_id, created_at desc)`, `transactions(category)`, `transactions(status)`.
- `transfers(from_account_id)`, `beneficiaries(user_id)`, `cards(account_id)`,
  `notifications(user_id, is_read)`, `support_tickets(user_id, status)`.

### 6.2 Triggers / functions
- `handle_new_user()` → inserts a `profiles` row when an `auth.users` row is created.
- `set_updated_at()` → BEFORE UPDATE trigger on all tables with `updated_at`.

### 6.3 Row Level Security (all tables, `enable row level security`)
- Default: **deny all**; explicit policies grant access.
- `profiles`: user can `select/update` own row (`auth.uid() = id`).
- `accounts/beneficiaries/cards/notifications/support_tickets`: user can CRUD rows where
  `user_id = auth.uid()` (or, for account-scoped tables, where the parent account belongs to
  the user via subquery).
- `transactions/transfers`: select/insert constrained to accounts the user owns
  (`account_id in (select id from accounts where user_id = auth.uid())`).
- No client-side `delete` on `transactions`/`transfers` (financial immutability); writes that
  mutate balances are reserved for server-side service-role routes (built in M4).

### 6.4 Storage (`0010_storage_buckets.sql`)
- `avatars` (public read, owner write) — profile images.
- `kyc-documents` (private; owner + service-role only) — KYC uploads.
- `marketing-assets` (public read; admin write) — marketing files.
- Bucket access enforced via storage RLS policies keyed on `auth.uid()` / path prefix.

---

## 7. Supabase Client Wiring

- `lib/supabase/client.ts` — `createBrowserClient` (@supabase/ssr) from `NEXT_PUBLIC_*` env.
- `lib/supabase/server.ts` — `createServerClient` with Next cookies adapter.
- `lib/supabase/middleware.ts` + root `middleware.ts` — refresh session cookie on each
  request. **No route gating in M1** (added in M2) — marketing is public.
- `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed).
- App boots and renders the landing page **without** valid Supabase env (clients
  instantiated lazily / guarded) so the marketing site works pre-credentials.

---

## 8. Security (M1 scope)

- RLS on every table, deny-by-default.
- Service-role key server-only; never imported into client bundles.
- Zod validation on the only M1 form (newsletter) — pattern reused later.
- Security headers via `next.config` (CSP-ready, `X-Frame-Options`, `Referrer-Policy`).
- Input sanitization + rate-limiting strategy **documented** in README for M2 API routes
  (not implemented in M1 since no mutating endpoints ship yet).

---

## 9. Accessibility & Performance

- WCAG AA contrast; visible focus rings; semantic HTML; `alt`/`aria` on all media/controls.
- Keyboard-navigable navbar, mobile sheet, and accordion (Radix handles roving focus).
- `prefers-reduced-motion` respected.
- `next/font` (no FOUT), `next/image` for any raster, lazy below-fold.
- Lighthouse targets: Performance ≥90, A11y ≥95, Best-Practices ≥95 on landing.

---

## 10. Acceptance Criteria (M1 "done")

1. `npm run dev` serves a fully responsive landing page with all 10 sections.
2. `npm run build` and `npm run lint` pass with zero errors; TypeScript strict.
3. Navbar collapses to a working mobile sheet; FAQ accordion works via keyboard.
4. All migrations in `supabase/migrations/` apply cleanly to a fresh Supabase project
   (verified by `supabase db reset` locally OR documented apply order).
5. RLS enabled on all 8 tables; deny-by-default verified.
6. `.env.example` present; app renders landing without live Supabase credentials.
7. `/design-system` renders tokens; README documents setup, env, and migration apply steps.
8. Lighthouse a11y ≥95 on landing.

---

## 11. Risks / Open Items

- **Migration verification** without a live project: we validate SQL via `supabase db reset`
  against a local Supabase (Docker) if available; otherwise migrations are committed and the
  README documents the exact apply order for the user to run. (Acceptable per "credentials later".)
- Later milestones depend on these table/column names — treat the schema as the contract.
