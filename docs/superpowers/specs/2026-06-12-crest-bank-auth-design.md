# Crest Bank — Authentication (Milestone 2) — Design Spec

**Date:** 2026-06-12
**Status:** Approved for spec review
**Author:** Engineering (with Kene)
**Builds on:** [M1 foundation](2026-06-12-crest-bank-foundation-design.md)

---

## 1. Goal

Add real authentication to Crest Bank: email/password **registration** and **login**, with
**required email verification** before accessing the authenticated area, and **route
protection** via middleware. Post-login lands on a protected `/dashboard` **stub** (the real
dashboard is M3).

### Confirmed decisions
- **Screens:** Register + Login only. Password-reset flow is deferred to a later milestone.
- **Registration fields (minimal):** full name, email, password, confirm password,
  agree-to-terms. Country/mobile are collected later (M5 settings).
- **Email verification:** REQUIRED. After signup the user must confirm via emailed link
  before they can log in / reach the dashboard.
- **Login identifier:** email + password (no username login).
- **Auth mutations:** Next.js **Server Actions** using the server-side Supabase client.

### Out of scope (later milestones)
- Password reset / forgot password.
- OAuth / social login, magic links, MFA.
- The real dashboard, accounts, transfers, cards, settings (M3–M5).
- Profile editing, avatar upload, KYC.

---

## 2. Architecture

```
app/
  (auth)/
    layout.tsx          # centered auth card on navy bg, "Back to home"
    login/page.tsx
    register/page.tsx
    verify-email/page.tsx   # "check your email" notice (post-signup)
    actions.ts          # "use server" — signIn, signUp, signOut
  auth/
    confirm/route.ts    # GET — verifyOtp(token_hash,type) -> redirect /dashboard
  dashboard/
    page.tsx            # PROTECTED stub: greets user, Sign out
components/
  auth/
    login-form.tsx      # client: RHF + Zod -> signIn action
    register-form.tsx   # client: RHF + Zod -> signUp action
lib/
  validations/auth.ts   # loginSchema, registerSchema (+ inferred types)
  auth/redirects.ts     # pure resolveAuthRedirect(pathname, hasSession)
  supabase/middleware.ts # EXTENDED: enforce gating
```

The existing M1 placeholder pages `app/login/page.tsx` and `app/register/page.tsx` are
**removed** and replaced by the `(auth)` group routes (same public URLs `/login`,
`/register`). The navbar/footer links already point to `/login` and `/register` — unchanged.

### Why these boundaries
- **Server Actions** (`actions.ts`) own all Supabase auth writes; forms never touch the
  service role and get cookie-based sessions for free via `@supabase/ssr`.
- **`resolveAuthRedirect`** is a pure function (pathname + hasSession → redirect target or
  null) so route-protection logic is unit-testable without a browser or DB.
- **Forms** are thin client components: validate with Zod, call an action, render returned
  errors. No business logic.

---

## 3. Data flow

### Registration
1. User submits register form → client Zod validation → calls `signUp(formData)`.
2. `signUp` re-validates server-side with `registerSchema`, then
   `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: <site>/auth/confirm } })`.
3. Supabase creates `auth.users` (unconfirmed) → the M1 `handle_new_user` trigger inserts a
   `profiles` row with `full_name`.
4. On success the action `redirect("/verify-email")`. On error it returns `{ error }`.
5. User clicks the emailed link → `GET /auth/confirm?token_hash=…&type=email` →
   `supabase.auth.verifyOtp({ type, token_hash })` sets the session cookie →
   `redirect("/dashboard")`. On failure → `redirect("/login?error=verification")`.

### Login
1. User submits login form → Zod → `signIn(formData)`.
2. `signIn` validates, then `supabase.auth.signInWithPassword({ email, password })`.
3. Errors map to friendly messages:
   - invalid credentials → "Incorrect email or password."
   - email not confirmed (`email_not_confirmed`) → "Please confirm your email first. Check your inbox."
4. On success → `redirect(next ?? "/dashboard")` where `next` comes from `?next=` (validated to a safe internal path).

### Logout
- `signOut` action calls `supabase.auth.signOut()` then `redirect("/login")`. Triggered by a
  form/button on the dashboard stub.

---

## 4. Route protection (middleware)

Extend `lib/supabase/middleware.ts`. After the existing session refresh
(`supabase.auth.getUser()`), apply gating via `resolveAuthRedirect`:

- **Protected prefixes:** `["/dashboard"]`.
- **Auth-only pages:** `["/login", "/register"]`.

Rules (`resolveAuthRedirect(pathname, hasSession)`):
- No session + pathname starts with a protected prefix → redirect `"/login?next=<pathname>"`.
- Has session + pathname is an auth-only page → redirect `"/dashboard"`.
- Otherwise → `null` (no redirect).

`next` sanitization: only honor `next` values that start with `/` and not `//` (prevent
open-redirect). Invalid → fall back to `/dashboard`.

When Supabase env is **not configured**, middleware continues to no-op (M1 behavior) — but
note `/dashboard` would then be unreachable anyway since there's no way to authenticate; the
gating code still runs only in the `configured` branch.

---

## 5. Validation (`lib/validations/auth.ts`)

```
loginSchema:
  email: string, trimmed, required, email
  password: string, required (min 1 — real strength enforced at signup)

registerSchema:
  fullName: string, trimmed, min 2 ("Enter your full name")
  email: string, trimmed, email
  password: string, min 8 ("At least 8 characters")
  confirmPassword: string
  terms: literal(true) / boolean refine ("You must accept the terms")
  + refine(password === confirmPassword, path: confirmPassword, "Passwords do not match")
```

Both client (RHF `zodResolver`) and server (inside the action) parse with these schemas;
server parse is the source of truth.

---

## 6. UI / UX

- **Auth layout:** full-height navy background, centered `Card` (max-w ~420px) with the Logo,
  heading, the form, and a cross-link ("Already have an account? Log in" / "Open an account").
  "Back to home" link top-left. Matches the M1 premium navy aesthetic; reference screenshots
  inform spacing/hierarchy only.
- **Forms:** labeled inputs, inline field errors (rose), a form-level error banner for action
  errors, password fields with a show/hide toggle, submit button shows a pending state
  (`useFormStatus` / RHF `isSubmitting`). Terms checkbox links to the (stub) policy pages.
- **verify-email page:** icon + "Check your email", the address hint, and a "Back to login"
  link. No resend in M2 (deferred).
- **dashboard stub:** authenticated greeting ("Welcome, {full_name or email}"), a short "Your
  dashboard is coming in the next release" note, and a working **Sign out** button. Uses the
  server client to read the user; not styled as the full dashboard yet.
- **Accessibility:** labels tied to inputs, `aria-invalid`, `aria-describedby` for errors,
  focus-visible rings, the show/hide toggle is a labeled button, error banner uses
  `role="alert"`.

---

## 7. Error handling

- Server actions return `{ error: string }` (form-level) and never throw to the client for
  expected failures; `redirect()` is used for success/navigation.
- Mapped Supabase errors: invalid login, email not confirmed, user already registered
  ("An account with this email already exists."), weak/short password, rate-limited
  ("Too many attempts. Try again shortly.").
- The confirm route handles missing/expired tokens by redirecting to `/login?error=verification`
  with a visible message.

---

## 8. Security

- All auth writes are server-side (Server Actions); anon key only, RLS still governs data.
- `next`/redirect parameters sanitized to internal paths (no open redirect).
- Passwords never logged; action inputs validated and trimmed.
- Email enumeration: keep messages reasonable but do not over-disclose (login uses a generic
  "incorrect email or password"; signup duplicate is acceptable to surface for UX).
- Rate limiting: relies on Supabase Auth's built-in limits for M2; app-level rate limiting on
  custom mutating routes remains a later concern (no custom mutating routes added here).
- Middleware enforces auth on `/dashboard*` server-side on every request.

---

## 9. Supabase project configuration (user applies)

Documented in README; the user enables these in their Supabase dashboard:
- **Authentication → Providers → Email:** enabled, **"Confirm email" ON**.
- **Authentication → URL Configuration:** Site URL = app origin (e.g. `http://localhost:3000`),
  Redirect URLs include `<origin>/auth/confirm`.
- **Email template (Confirm signup):** link target uses the `token_hash` + `type` format
  pointing at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (the spec's
  confirm route expects `token_hash` + `type`). The default Supabase template's
  `{{ .ConfirmationURL }}` also works if Redirect URLs are set; README documents the
  `token_hash` variant to match the route.
- `.env.local` populated with project URL + anon key (service-role not required for M2).

---

## 10. Testing

**Unit (Vitest, no live DB):**
- `lib/validations/auth.ts`: valid/invalid login; register password length, mismatch,
  terms-required, short name.
- `lib/auth/redirects.ts`: no-session+/dashboard → /login?next; session+/login → /dashboard;
  public path → null; `next` open-redirect sanitization.

**Manual (against the user's Supabase project)** — documented step-by-step in README:
register → "check your email" → click link → lands on /dashboard → sign out → log back in →
try logging in before confirming (blocked with the right message) → visit /login while
authed (redirected to /dashboard) → visit /dashboard while logged out (redirected to /login).

---

## 11. Acceptance criteria

1. `/register` creates an unconfirmed user, writes `full_name`, and redirects to
   `/verify-email`; duplicate email shows a clear error.
2. Logging in before confirmation is blocked with a "confirm your email" message.
3. Clicking the email link confirms the account and lands the user on `/dashboard`.
4. `/login` with correct, confirmed credentials reaches `/dashboard`; wrong credentials show a
   generic error.
5. Unauthenticated access to `/dashboard` redirects to `/login?next=/dashboard`; authenticated
   access to `/login` or `/register` redirects to `/dashboard`.
6. `Sign out` clears the session and returns to `/login`.
7. `npm run build`, `npm run lint`, `npx tsc --noEmit` pass; unit tests for schemas + redirects
   pass.
8. README documents the required Supabase dashboard settings and a manual test plan.

---

## 12. Risks / open items

- **Email deliverability/config** depends on the user's Supabase setup; verification can't be
  exercised in CI here. Mitigated by the documented manual test plan and unit-tested pure logic.
- **Confirm link format**: Supabase has both PKCE (`code`) and `token_hash`+`type` email link
  styles. The confirm route targets `token_hash`+`type` (current `@supabase/ssr` email
  pattern); README tells the user to use the matching email template. If their project sends a
  `code` link instead, the route also falls back to `exchangeCodeForSession` when a `code`
  param is present.
- Post-login destination is a **stub** until M3; this is intended.
