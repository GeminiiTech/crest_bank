# Deploying Crest Bank (Vercel + Supabase)

This app is Next.js 14 (App Router) with server components, middleware, route handlers, and
Supabase. **Vercel** runs all of that with zero extra config. Your code is on GitHub
(`GeminiiTech/crest_bank`) and the production build passes, so deployment is mostly wiring env
vars and pointing Supabase Auth at the live URL.

> Prerequisites: a GitHub repo (done), and a Supabase project with migrations `0001`–`0014`
> applied and your **Project URL** + **anon key** handy.

---

## 1. Import the repo into Vercel

1. Go to **vercel.com** → sign in (use **GitHub** so it can see the repo).
2. **Add New… → Project** → **Import** `GeminiiTech/crest_bank`.
3. Vercel auto-detects **Next.js** — leave Framework Preset, Build Command (`next build`),
   and Output as their defaults. **Don't click Deploy yet** — add env vars first (Step 2),
   or deploy now and add them right after (a redeploy is needed for env changes to take effect).

## 2. Set environment variables

In the import screen (or later under **Project → Settings → Environment Variables**), add these
for the **Production** environment (also add to **Preview** if you want PR previews to work):

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL | from Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon/public key | from Supabase → Settings → API |
| `NEXT_PUBLIC_SITE_URL` | your deployed origin, e.g. `https://crest-bank.vercel.app` | used to build auth confirmation links — see Step 4 |
| `SUPABASE_SERVICE_ROLE_KEY` | *(optional)* service_role key | not used yet; safe to add for future server features. **Never** expose it client-side. |

> You won't know the exact production URL until the first deploy assigns one (e.g.
> `crest-bank-xxxx.vercel.app`). Easiest path: deploy once, copy the assigned domain, set
> `NEXT_PUBLIC_SITE_URL` to it, then **redeploy** (Step 3). If you'll add a custom domain, use
> that value instead.

## 3. Deploy

Click **Deploy**. Vercel installs deps, runs `next build` (it fetches the Google Fonts at build
time — that's expected), and publishes. After it finishes:

- Note the **production URL** Vercel shows.
- If you hadn't set `NEXT_PUBLIC_SITE_URL` yet (or set a placeholder), set it to this URL now
  under Settings → Environment Variables, then **Deployments → ⋯ → Redeploy** so it takes effect.

## 4. Point Supabase Auth at the live URL (required for login/email)

In your Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://<your-vercel-domain>`
- **Redirect URLs:** add `https://<your-vercel-domain>/auth/confirm`
  (keep `http://localhost:3000/auth/confirm` too, for local dev).

And **Authentication → Providers → Email**: keep **Confirm email = ON**. If you customized the
confirm-signup email template, it should point at
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (the default also works —
the `/auth/confirm` route falls back to `exchangeCodeForSession`).

Without this step, registration "confirm your email" links will point at the wrong origin and
login won't complete.

## 5. Post-deploy smoke test

1. Open the production URL → the marketing landing page loads.
2. **Register** a new account → you're sent to **/verify-email**.
3. Open the confirmation email → the link lands on **/dashboard** on the live domain.
4. On the empty dashboard, click **Set up demo data** → accounts, transactions, cards, and
   notifications populate.
5. Try **Transfers**, **Transactions** (filter + Export CSV), **Cards** (freeze / request),
   **Settings** (edit profile, upload avatar, change password, notification prefs).
6. The first visit to each page runs its **spotlight tutorial**; "Take the tour" replays it.

## Notes & gotchas

- **Env changes require a redeploy** on Vercel — they aren't picked up by an already-built deployment.
- **`NEXT_PUBLIC_SITE_URL` must match the live origin** or confirmation emails break. Update it if
  you later add a custom domain.
- **Avatars:** profile images render via `next/image` with `unoptimized`, so no `remotePatterns`
  config is needed for the Supabase Storage domain.
- **Middleware** runs on Vercel; a harmless build-time warning about `process.version` in the
  Edge runtime comes from the Supabase SDK and does not affect functionality.
- **Custom domain (optional):** Project → Settings → Domains → add your domain, then update
  `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL / Redirect URLs to match, and redeploy.
- **Auto-deploys:** once connected, every push to `main` triggers a new production deploy; PRs
  get preview deployments.
- **Secrets:** keep real keys only in Vercel's env settings and your local `.env.local` — never in
  tracked files (e.g. `.env.example`).
