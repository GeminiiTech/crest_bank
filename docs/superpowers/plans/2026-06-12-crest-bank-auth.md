# Crest Bank Authentication (M2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password registration + login with required email verification and middleware route protection, landing authenticated users on a protected `/dashboard` stub.

**Architecture:** Next.js Server Actions own all Supabase auth writes (sign in/up/out). Forms are thin client components (React Hook Form + Zod) that call the actions and render returned errors. Route protection lives in the existing `updateSession` middleware, driven by a pure, unit-tested `resolveAuthRedirect` helper. Email confirmation goes through a `/auth/confirm` GET route.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, `@supabase/ssr`, React Hook Form + Zod, Vitest, Tailwind v3 + classic Radix shadcn.

**Existing facts to rely on (do not change):**
- `lib/supabase/server.ts` exports a **synchronous** `createClient()` (uses sync `cookies()`). Call it WITHOUT `await`.
- `lib/supabase/middleware.ts` exports `async updateSession(request)`; it no-ops when env unconfigured and otherwise refreshes the session via `supabase.auth.getUser()`.
- `next/headers` `headers()` and `cookies()` are **synchronous** in this Next 14.2 setup — do NOT `await` them.
- `profiles` is auto-created from `auth.users` by the `handle_new_user` trigger, copying `raw_user_meta_data->>'full_name'`. So passing `options.data.full_name` at signup populates `profiles.full_name`.
- UI primitives available: `Button` (asChild), `Input`, `Card*`, `Logo`. Tokens: `bg-navy-950/900/800`, `bg-primary`, `text-success`, `text-rose-400/500`, `font-display`, `shadow-card`.
- The current placeholder pages `app/login/page.tsx` and `app/register/page.tsx` will be REPLACED by `(auth)` group routes at the same URLs.

**Verification gates (per phase):** `npm run test`, `npx tsc --noEmit`, `npm run lint`. Run `npm run build` only at the final task (it fetches Google Fonts and can be flaky in-sandbox; retry once on a fonts socket error; use `dangerouslyDisableSandbox: true` if the sandbox blocks npm).

---

## Phase 1 — Pure logic (TDD)

### Task 1: Auth validation schemas

**Files:**
- Create: `lib/validations/auth.ts`
- Test: `lib/validations/__tests__/auth.test.ts`

- [ ] **Step 1: Write failing test** — `lib/validations/__tests__/auth.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
  it("rejects invalid email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
  it("rejects empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = {
    fullName: "Ada Lovelace",
    email: "ada@b.com",
    password: "password1",
    confirmPassword: "password1",
    terms: true,
  };
  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });
  it("rejects password shorter than 8", () => {
    expect(registerSchema.safeParse({ ...base, password: "short", confirmPassword: "short" }).success).toBe(false);
  });
  it("rejects mismatched passwords", () => {
    expect(registerSchema.safeParse({ ...base, confirmPassword: "different1" }).success).toBe(false);
  });
  it("rejects when terms not accepted", () => {
    expect(registerSchema.safeParse({ ...base, terms: false }).success).toBe(false);
  });
  it("rejects a one-character name", () => {
    expect(registerSchema.safeParse({ ...base, fullName: "A" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`@/lib/validations/auth` not found)

Run: `npm run test`

- [ ] **Step 3: Implement** — `lib/validations/auth.ts`

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    terms: z.boolean().refine((v) => v === true, { message: "You must accept the terms" }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type RegisterInput = z.infer<typeof registerSchema>;
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/validations/auth.ts lib/validations/__tests__/auth.test.ts
git commit -m "feat(auth): login + register Zod schemas"
```

---

### Task 2: Redirect resolver

**Files:**
- Create: `lib/auth/redirects.ts`
- Test: `lib/auth/__tests__/redirects.test.ts`

- [ ] **Step 1: Write failing test** — `lib/auth/__tests__/redirects.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { resolveAuthRedirect, sanitizeNext } from "@/lib/auth/redirects";

describe("sanitizeNext", () => {
  it("defaults to /dashboard when missing", () => {
    expect(sanitizeNext(null)).toBe("/dashboard");
    expect(sanitizeNext(undefined)).toBe("/dashboard");
  });
  it("rejects external/protocol-relative urls", () => {
    expect(sanitizeNext("//evil.com")).toBe("/dashboard");
    expect(sanitizeNext("https://evil.com")).toBe("/dashboard");
  });
  it("passes through safe internal paths", () => {
    expect(sanitizeNext("/dashboard/cards")).toBe("/dashboard/cards");
  });
});

describe("resolveAuthRedirect", () => {
  it("sends logged-out users from protected paths to /login with next", () => {
    expect(resolveAuthRedirect("/dashboard", false)).toBe("/login?next=%2Fdashboard");
    expect(resolveAuthRedirect("/dashboard/cards", false)).toBe("/login?next=%2Fdashboard%2Fcards");
  });
  it("sends logged-in users away from auth pages", () => {
    expect(resolveAuthRedirect("/login", true)).toBe("/dashboard");
    expect(resolveAuthRedirect("/register", true)).toBe("/dashboard");
  });
  it("returns null for public paths", () => {
    expect(resolveAuthRedirect("/", false)).toBeNull();
    expect(resolveAuthRedirect("/", true)).toBeNull();
    expect(resolveAuthRedirect("/dashboard", true)).toBeNull();
    expect(resolveAuthRedirect("/login", false)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test`

- [ ] **Step 3: Implement** — `lib/auth/redirects.ts`

```ts
const PROTECTED_PREFIXES = ["/dashboard"];
const AUTH_ONLY_PATHS = ["/login", "/register"];

export function sanitizeNext(next: string | null | undefined): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export function resolveAuthRedirect(
  pathname: string,
  hasSession: boolean
): string | null {
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isAuthOnly = AUTH_ONLY_PATHS.includes(pathname);

  if (!hasSession && isProtected) {
    return `/login?next=${encodeURIComponent(pathname)}`;
  }
  if (hasSession && isAuthOnly) {
    return "/dashboard";
  }
  return null;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/auth/redirects.ts lib/auth/__tests__/redirects.test.ts
git commit -m "feat(auth): pure resolveAuthRedirect + sanitizeNext helpers"
```

---

## Phase 2 — Server actions, confirm route, middleware gating

### Task 3: Auth server actions

**Files:**
- Create: `app/(auth)/actions.ts`

- [ ] **Step 1: Implement** — `app/(auth)/actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { sanitizeNext } from "@/lib/auth/redirects";

export type ActionResult = { error: string } | void;

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Please check your email and password." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first — check your inbox." };
    }
    return { error: "Incorrect email or password." };
  }

  redirect(sanitizeNext(formData.get("next")?.toString()));
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    terms: formData.get("terms") === "on" || formData.get("terms") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const supabase = createClient();
  const origin = headers().get("origin") ?? "";
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (error.code === "user_already_exists" || msg.includes("already registered") || msg.includes("already exists")) {
      return { error: "An account with this email already exists." };
    }
    if (msg.includes("password")) {
      return { error: "Password is too weak — use at least 8 characters." };
    }
    if (error.code === "over_email_send_rate_limit" || msg.includes("rate")) {
      return { error: "Too many attempts. Please try again shortly." };
    }
    return { error: "Could not create your account. Please try again." };
  }

  redirect("/verify-email");
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

NOTE: `redirect()` throws `NEXT_REDIRECT` by design — never wrap these calls in try/catch.
If `tsc` complains that `headers()`/`cookies()` are Promises, this Next version is async-headers;
in that case add `await` — but per the existing `server.ts` they are SYNC here, so do not await.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/actions.ts"
git commit -m "feat(auth): signIn/signUp/signOut server actions"
```

---

### Task 4: Email confirmation route

**Files:**
- Create: `app/auth/confirm/route.ts`

- [ ] **Step 1: Implement** — `app/auth/confirm/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
  }

  return NextResponse.redirect(`${origin}/login?error=verification`);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/auth/confirm/route.ts
git commit -m "feat(auth): email confirmation route (verifyOtp + code fallback)"
```

---

### Task 5: Middleware route gating

**Files:**
- Modify: `lib/supabase/middleware.ts`

- [ ] **Step 1: Replace the file** — `lib/supabase/middleware.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import { resolveAuthRedirect } from "@/lib/auth/redirects";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey, configured } = getSupabaseEnv();
  if (!configured) return response; // marketing site runs without Supabase

  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const target = resolveAuthRedirect(request.nextUrl.pathname, Boolean(user));
  if (target) {
    const redirectUrl = request.nextUrl.clone();
    const [pathname, query] = target.split("?");
    redirectUrl.pathname = pathname;
    redirectUrl.search = query ? `?${query}` : "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // preserve any refreshed auth cookies on the redirect
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run test`
Expected: 0 type errors; all existing tests still pass (redirect tests cover the logic this uses).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/middleware.ts
git commit -m "feat(auth): enforce route protection in session middleware"
```

---

## Phase 3 — Auth UI

### Task 6: Password input with show/hide toggle

**Files:**
- Create: `components/auth/password-input.tsx`

- [ ] **Step 1: Implement** — `components/auth/password-input.tsx`

```tsx
"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/auth/password-input.tsx
git commit -m "feat(auth): password input with show/hide toggle"
```

---

### Task 7: Login form

**Files:**
- Create: `components/auth/login-form.tsx`

- [ ] **Step 1: Implement** — `components/auth/login-form.tsx`

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { signIn } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";

export function LoginForm({ next }: { next?: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  function onSubmit(values: LoginInput) {
    setFormError(null);
    const fd = new FormData();
    fd.set("email", values.email);
    fd.set("password", values.password);
    if (next) fd.set("next", next);
    startTransition(async () => {
      const result = await signIn(fd);
      if (result?.error) setFormError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {formError}
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-200">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="bg-navy-800 border-navy-700 text-white placeholder:text-slate-500"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-200">
          Password
        </label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          className="bg-navy-800 border-navy-700 text-white placeholder:text-slate-500"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Log in"}
      </Button>
      <p className="text-center text-sm text-slate-400">
        New to Crest Bank?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Open an account
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/auth/login-form.tsx
git commit -m "feat(auth): login form"
```

---

### Task 8: Register form

**Files:**
- Create: `components/auth/register-form.tsx`

- [ ] **Step 1: Implement** — `components/auth/register-form.tsx`

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { signUp } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";

const fieldClass = "bg-navy-800 border-navy-700 text-white placeholder:text-slate-500";

export function RegisterForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  function onSubmit(values: RegisterInput) {
    setFormError(null);
    const fd = new FormData();
    fd.set("fullName", values.fullName);
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("confirmPassword", values.confirmPassword);
    fd.set("terms", values.terms ? "true" : "false");
    startTransition(async () => {
      const result = await signUp(fd);
      if (result?.error) setFormError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {formError}
        </p>
      )}
      <div>
        <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-slate-200">
          Full name
        </label>
        <Input id="fullName" autoComplete="name" className={fieldClass}
          aria-invalid={!!errors.fullName} {...register("fullName")} />
        {errors.fullName && <p className="mt-1 text-xs text-rose-400">{errors.fullName.message}</p>}
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-200">
          Email
        </label>
        <Input id="email" type="email" autoComplete="email" className={fieldClass}
          aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-200">
          Password
        </label>
        <PasswordInput id="password" autoComplete="new-password" className={fieldClass}
          aria-invalid={!!errors.password} {...register("password")} />
        {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>}
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-200">
          Confirm password
        </label>
        <PasswordInput id="confirmPassword" autoComplete="new-password" className={fieldClass}
          aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
        {errors.confirmPassword && (
          <p className="mt-1 text-xs text-rose-400">{errors.confirmPassword.message}</p>
        )}
      </div>
      <div>
        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-navy-700 bg-navy-800"
            aria-invalid={!!errors.terms} {...register("terms")} />
          <span>
            I agree to the{" "}
            <Link href="#" className="text-primary hover:underline">Terms of Service</Link> and{" "}
            <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>.
          </span>
        </label>
        {errors.terms && <p className="mt-1 text-xs text-rose-400">{errors.terms.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/auth/register-form.tsx
git commit -m "feat(auth): register form"
```

---

### Task 9: Auth route group (layout + pages) and removal of placeholder pages

**Files:**
- Delete: `app/login/page.tsx`, `app/register/page.tsx` (and their now-empty dirs)
- Create: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/verify-email/page.tsx`

- [ ] **Step 1: Remove placeholder pages** (they conflict with the new `(auth)` routes)

```bash
git rm app/login/page.tsx app/register/page.tsx
```

- [ ] **Step 2: Create** — `app/(auth)/layout.tsx`

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center bg-navy-900 px-4 py-12">
      <Link
        href="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo inverted />
        </div>
        <div className="rounded-2xl border border-navy-700 bg-navy-800/60 p-6 shadow-card sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create** — `app/(auth)/login/page.tsx`

```tsx
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-400">
        Log in to access your Crest Bank account.
      </p>
      {searchParams.error === "verification" && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          That confirmation link is invalid or has expired. Please log in or sign up again.
        </p>
      )}
      <div className="mt-6">
        <LoginForm next={searchParams.next} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create** — `app/(auth)/register/page.tsx`

```tsx
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Open an account" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Create your account</h1>
      <p className="mt-1 text-sm text-slate-400">
        Open a Crest Bank account in a few minutes.
      </p>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create** — `app/(auth)/verify-email/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Check your email" };

export default function VerifyEmailPage() {
  return (
    <div className="text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
        <MailCheck className="h-6 w-6" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-bold text-white">Check your email</h1>
      <p className="mt-2 text-sm text-slate-400">
        We&apos;ve sent a confirmation link to your inbox. Click it to activate your account,
        then log in.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
      >
        Back to login
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors. Confirm `app/login/page.tsx` and `app/register/page.tsx` no longer exist and `app/(auth)/login/page.tsx` / `app/(auth)/register/page.tsx` do (so `/login` and `/register` resolve through the `(auth)` group with no conflict).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): auth route group — layout, login, register, verify-email"
```

---

### Task 10: Protected dashboard stub

**Files:**
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Implement** — `app/dashboard/page.tsx`

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already gates this route; this is a defensive fallback.
  if (!user) redirect("/login?next=/dashboard");

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "there";

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-navy-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo inverted />
          <form action={signOut}>
            <Button type="submit" variant="outline" className="border-navy-700 bg-transparent text-white hover:bg-white/10">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome, {displayName}
        </h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          You&apos;re signed in to Crest Bank. Your full dashboard — accounts, transfers,
          cards, and insights — arrives in the next release.
        </p>
        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-card">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="mt-1 font-medium">{user.email}</p>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(auth): protected dashboard stub with sign out"
```

---

## Phase 4 — Docs & final verification

### Task 11: README auth + Supabase config docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add an "Authentication (M2)" section** to `README.md` documenting:
  - Required Supabase dashboard settings:
    - **Authentication → Providers → Email**: enabled, **Confirm email = ON**.
    - **Authentication → URL Configuration**: Site URL = `http://localhost:3000` (and prod origin); add `http://localhost:3000/auth/confirm` to Redirect URLs.
    - **Email templates → Confirm signup**: set the link to
      `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
      (the default `{{ .ConfirmationURL }}` also works since the confirm route falls back to `exchangeCodeForSession` when a `code` param is present).
  - `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - **Manual test plan** (numbered): register → redirected to `/verify-email` → click email link → lands on `/dashboard`; try logging in before confirming → blocked with "confirm your email"; log in after confirming → `/dashboard`; visit `/dashboard` logged-out → redirected to `/login?next=/dashboard`; visit `/login` while authed → redirected to `/dashboard`; Sign out → back to `/login`.
  - Update the **Roadmap**: mark M2 done.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: authentication setup + manual test plan (M2)"
```

---

### Task 12: Final verification gate

- [ ] **Step 1: Tests** — Run: `npm run test` → all pass (newsletter + auth schemas + redirects).
- [ ] **Step 2: Types** — Run: `npx tsc --noEmit` → 0 errors.
- [ ] **Step 3: Lint** — Run: `npm run lint` → 0 errors.
- [ ] **Step 4: Build** — Run: `npm run build` → succeeds. Confirm `/login`, `/register`, `/verify-email`, `/dashboard` and the `/auth/confirm` route compile, and Middleware is emitted. (Retry once on a Google-Fonts socket error; use `dangerouslyDisableSandbox: true` if the sandbox blocks npm.)
- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(auth): M2 verification fixes"
```

---

## Self-Review Notes (coverage vs spec)

- §2 Architecture (routes/actions/forms/helpers) → Tasks 3,4,6,7,8,9,10. ✓
- §3 Data flow (register→verify-email→confirm→dashboard; login; logout) → Tasks 3,4,9,10. ✓
- §4 Middleware gating + `next` sanitization → Tasks 2,5. ✓
- §5 Validation schemas → Task 1. ✓
- §6 UI/UX (auth layout, forms, verify-email, dashboard stub, show/hide, a11y) → Tasks 6–10. ✓
- §7 Error handling (mapped Supabase errors, confirm failure) → Tasks 3,4,9. ✓
- §8 Security (server-side writes, redirect sanitization) → Tasks 2,3,5. ✓
- §9 Supabase config → Task 11. ✓
- §10 Testing (unit schemas + redirects; manual plan) → Tasks 1,2,11. ✓
- §11 Acceptance criteria → Task 12 gate + manual plan. ✓

**Type-consistency check:** `createClient()` called synchronously everywhere (matches `server.ts`). `signIn(formData)`, `signUp(formData)`, `signOut()` signatures are consistent across actions, forms (Tasks 7,8), and the dashboard form (Task 10). `resolveAuthRedirect`/`sanitizeNext` names match between Task 2 and Task 5. `ActionResult` returned by actions and read as `result?.error` in forms.
