# Crest Bank Foundation (M1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Crest Bank foundation — Next.js 14 scaffold, design system, full responsive landing page, Supabase wiring, and the complete 8-table backend (schema + RLS + storage) as migrations.

**Architecture:** App Router with a `(marketing)` route group. Design tokens live as CSS variables in `globals.css`, mapped into `tailwind.config.ts` so shadcn semantic classes resolve. Page content is data-driven from `lib/constants.ts`. Supabase clients are lazily/guarded so the marketing site renders without live credentials. The DB backend ships as numbered SQL migrations applied later by the user.

**Tech Stack:** Next.js 14 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui (Radix), Framer Motion, Supabase (@supabase/ssr), React Hook Form + Zod, Sora + Inter (next/font), lucide-react, Vitest for unit tests.

**Verification gates (run after each phase):**
- `npm run lint` → 0 errors
- `npx tsc --noEmit` → 0 errors
- `npm run build` → succeeds
- `npm run test` (Vitest) → passes (for tasks with tests)

---

## Phase 0 — Scaffold & Tooling

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Scaffold Next.js in the existing repo**

Run from repo root (note the `.` to scaffold into the current, non-empty dir):
```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --no-turbopack
```
If prompted to proceed in a non-empty directory, accept (the only files are images + docs).

- [ ] **Step 2: Verify dev server boots**

Run: `npm run dev` then visit `http://localhost:3000`.
Expected: default Next.js page renders. Stop the server (Ctrl-C).

- [ ] **Step 3: Move reference images out of the web root**

```bash
mkdir -p docs/reference-images
git mv "WhatsApp Image 2026-06-12 at 8.51.32 AM.jpeg" docs/reference-images/ 2>/dev/null || true
# repeat-move all WhatsApp*.jpeg into docs/reference-images/
```
PowerShell alternative:
```powershell
New-Item -ItemType Directory -Force docs/reference-images | Out-Null
Get-ChildItem "WhatsApp Image*.jpeg" | ForEach-Object { git mv $_.Name "docs/reference-images/$($_.Name)" }
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app + relocate reference images"
```

---

### Task 2: Install dependencies & init shadcn/ui

**Files:**
- Modify: `package.json`
- Create: `components.json`, `lib/utils.ts`, `components/ui/*`

- [ ] **Step 1: Install runtime + dev dependencies**

```bash
npm install @supabase/ssr @supabase/supabase-js framer-motion react-hook-form zod @hookform/resolvers lucide-react class-variance-authority clsx tailwind-merge tailwindcss-animate
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```
Choose defaults (style: default, base color: slate, CSS variables: yes). This creates `components.json` and `lib/utils.ts` (with `cn`).

- [ ] **Step 3: Add the shadcn primitives we need**

```bash
npx shadcn@latest add button card accordion input sheet badge separator
```

- [ ] **Step 4: Verify it still builds**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add deps, init shadcn/ui + base components"
```

---

### Task 3: Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add scripts to `package.json`**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Smoke-test Vitest**

Create `lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });
```
Run: `npm run test`
Expected: 1 passing test. Then delete the smoke file.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: configure Vitest"
```

---

## Phase 1 — Design System

### Task 4: Design tokens in globals.css + Tailwind config

**Files:**
- Modify: `app/globals.css`, `tailwind.config.ts`

- [ ] **Step 1: Replace the `:root`/`.dark` token blocks in `app/globals.css`**

Keep the `@tailwind` directives at the top. Replace the shadcn token block with Crest tokens (HSL channels, no `hsl()` wrapper):
```css
@layer base {
  :root {
    --background: 210 40% 99%;
    --foreground: 213 64% 11%;
    --card: 0 0% 100%;
    --card-foreground: 213 64% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 213 64% 11%;
    --primary: 220 87% 56%;            /* azure-500 #2D6FF0 */
    --primary-foreground: 0 0% 100%;
    --secondary: 214 32% 91%;
    --secondary-foreground: 213 64% 11%;
    --muted: 214 32% 95%;
    --muted-foreground: 215 16% 47%;
    --accent: 214 32% 91%;
    --accent-foreground: 213 64% 11%;
    --success: 160 84% 39%;            /* mint-500 #10B981 */
    --success-foreground: 0 0% 100%;
    --destructive: 347 77% 50%;        /* rose-500 #E11D48 */
    --destructive-foreground: 0 0% 100%;
    --border: 214 32% 88%;
    --input: 214 32% 88%;
    --ring: 220 87% 56%;
    --radius: 0.75rem;
    /* brand navy scale */
    --navy-950: 213 67% 10%;
    --navy-900: 212 65% 11%;
    --navy-800: 211 65% 16%;
    --navy-700: 213 59% 22%;
  }
}
@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}
```

- [ ] **Step 2: Extend `tailwind.config.ts`**

Ensure `content` covers `app`, `components`, `lib`. In `theme.extend` add:
```ts
colors: {
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
  secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
  muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
  accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
  success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
  destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
  card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
  popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
  navy: {
    950: "hsl(var(--navy-950))", 900: "hsl(var(--navy-900))",
    800: "hsl(var(--navy-800))", 700: "hsl(var(--navy-700))",
  },
},
fontFamily: {
  sans: ["var(--font-inter)", "system-ui", "sans-serif"],
  display: ["var(--font-sora)", "system-ui", "sans-serif"],
},
borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)", "2xl": "1rem" },
boxShadow: { card: "0 1px 3px rgba(8,21,43,.06), 0 8px 24px rgba(8,21,43,.06)" },
keyframes: {
  "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
  "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
},
animation: { "accordion-down": "accordion-down .2s ease-out", "accordion-up": "accordion-up .2s ease-out" },
```
Ensure `plugins: [require("tailwindcss-animate")]`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Crest Bank design tokens + tailwind theme"
```

---

### Task 5: Root layout with fonts + metadata

**Files:**
- Modify: `app/layout.tsx`
- Create: `lib/site.ts`

- [ ] **Step 1: Create `lib/site.ts`**

```ts
export const site = {
  name: "Crest Bank",
  tagline: "Banking built on trust.",
  description:
    "Crest Bank is a premium digital bank offering secure personal and business banking, savings, loans, cards, and investments — all in one place.",
  url: "https://crestbank.example",
} as const;
```

- [ ] **Step 2: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${site.name} — ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  metadataBase: new URL(site.url),
  openGraph: { title: site.name, description: site.description, type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds (fonts download at build).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: root layout with Sora/Inter fonts + metadata"
```

---

### Task 6: Reveal motion wrapper + Logo

**Files:**
- Create: `components/shared/motion/reveal.tsx`, `components/shared/logo.tsx`

- [ ] **Step 1: Create `components/shared/motion/reveal.tsx`**

```tsx
"use client";
import { motion, type Variants } from "framer-motion";

const variants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function Reveal({
  children, className, delay = 0, as = "div",
}: { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" }) {
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay }}
    >
      {children}
    </MotionTag>
  );
}
```

- [ ] **Step 2: Create `components/shared/logo.tsx`**

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 font-display font-bold tracking-tight", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M9 21v-6h6v6" />
        </svg>
      </span>
      <span className={cn("text-lg", inverted ? "text-white" : "text-foreground")}>Crest Bank</span>
    </Link>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Reveal motion wrapper + Logo"
```

---

## Phase 2 — Landing Page Content & Shell

### Task 7: Content constants

**Files:**
- Create: `lib/constants.ts`

- [ ] **Step 1: Create `lib/constants.ts`** with typed data arrays used by sections:

```ts
import { ShieldCheck, Wallet, Building2, PiggyBank, CreditCard, LineChart,
  Lock, Fingerprint, BellRing, BadgeCheck } from "lucide-react";

export const navLinks = [
  { label: "Personal", href: "#features" },
  { label: "Business", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export const stats = [
  { value: "2.4M+", label: "Customers worldwide" },
  { value: "$48B", label: "Assets under management" },
  { value: "32", label: "Countries served" },
  { value: "99.99%", label: "Platform uptime" },
] as const;

export const features = [
  { icon: Wallet, title: "Personal Banking", desc: "Everyday accounts with instant transfers, smart insights, and zero hidden fees." },
  { icon: Building2, title: "Business Banking", desc: "Accounts, payroll, and multi-user controls built for growing companies." },
  { icon: PiggyBank, title: "Savings Accounts", desc: "Competitive rates and automated goals that help your money grow faster." },
  { icon: LineChart, title: "Investments", desc: "Diversified portfolios and advisory tools to build long-term wealth." },
  { icon: CreditCard, title: "Cards", desc: "Virtual and physical debit and credit cards with real-time controls." },
  { icon: ShieldCheck, title: "Loans & Credit", desc: "Transparent personal and business lending with fast decisions." },
] as const;

export const benefits = [
  { title: "Move money in seconds", desc: "Real-time internal transfers and fast external payments, 24/7." },
  { title: "See where it goes", desc: "Automatic categorization and spending insights across every account." },
  { title: "Bank from anywhere", desc: "A fast, accessible experience on web and mobile, fully in sync." },
] as const;

export const security = [
  { icon: Lock, title: "256-bit encryption", desc: "Your data is encrypted in transit and at rest." },
  { icon: Fingerprint, title: "Biometric & 2FA", desc: "Multi-factor and biometric login keep accounts safe." },
  { icon: BellRing, title: "Real-time fraud alerts", desc: "We monitor activity and flag anything unusual instantly." },
  { icon: BadgeCheck, title: "Insured deposits", desc: "Eligible deposits are protected up to regulatory limits." },
] as const;

export const testimonials = [
  { quote: "Switching to Crest Bank was the easiest financial decision we made this year. Transfers are instant and support is excellent.", name: "Amara Okafor", role: "Founder, Lumen Studio" },
  { quote: "The spending insights actually changed how I budget. Everything is clear, fast, and genuinely well designed.", name: "David Chen", role: "Product Manager" },
  { quote: "Business banking that finally keeps up with us. Multi-user controls and payroll just work.", name: "Sofia Marquez", role: "COO, Northwind Logistics" },
] as const;

export const faqs = [
  { q: "Is Crest Bank a real bank?", a: "Crest Bank provides banking services through regulated banking partners. Eligible deposits are insured up to applicable limits." },
  { q: "How long does it take to open an account?", a: "Most customers complete onboarding in under five minutes with a valid ID and basic details." },
  { q: "What does it cost?", a: "Personal accounts have no monthly maintenance fees. Business and premium plans are priced transparently with no hidden charges." },
  { q: "How do you protect my money and data?", a: "We use 256-bit encryption, multi-factor authentication, continuous fraud monitoring, and strict access controls." },
  { q: "Can I use Crest Bank for my business?", a: "Yes. Business Banking includes multi-user access, role controls, payroll, and dedicated support." },
  { q: "Which countries do you support?", a: "Crest Bank operates across 32 countries, with more added regularly. Availability of specific products varies by region." },
] as const;

export const footerColumns = [
  { title: "Products", links: ["Personal Banking", "Business Banking", "Savings", "Cards", "Investments"] },
  { title: "Company", links: ["About", "Careers", "Press", "Contact"] },
  { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Disclosures"] },
  { title: "Support", links: ["Help Center", "Security", "Status", "Contact Support"] },
] as const;
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: landing page content constants"
```

---

### Task 8: Navbar

**Files:**
- Create: `components/shared/navbar.tsx`

- [ ] **Step 1: Create `components/shared/navbar.tsx`**

```tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { navLinks } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-colors",
      scrolled ? "bg-navy-900/90 backdrop-blur supports-[backdrop-filter]:bg-navy-900/80 shadow-card" : "bg-transparent")}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main">
        <Logo inverted />
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <Link key={l.label} href={l.href} className="text-sm font-medium text-slate-200 transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild><Link href="/register">Open account</Link></Button>
        </div>
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-navy-900 text-white border-navy-700">
            <SheetTitle className="text-white">Menu</SheetTitle>
            <div className="mt-8 flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link key={l.label} href={l.href} className="rounded-lg px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/10">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild variant="outline" className="border-navy-700 bg-transparent text-white hover:bg-white/10">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild><Link href="/register">Open account</Link></Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: responsive navbar with mobile sheet"
```

---

### Task 9: Footer with newsletter (Zod-validated)

**Files:**
- Create: `components/shared/footer.tsx`, `components/marketing/newsletter-form.tsx`, `lib/validations/newsletter.ts`
- Test: `lib/validations/__tests__/newsletter.test.ts`

- [ ] **Step 1: Write failing test for the schema**

`lib/validations/__tests__/newsletter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { newsletterSchema } from "@/lib/validations/newsletter";

describe("newsletterSchema", () => {
  it("accepts a valid email", () => {
    expect(newsletterSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
  it("rejects an invalid email", () => {
    expect(newsletterSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run: `npm run test`
Expected: FAIL — cannot resolve `@/lib/validations/newsletter`.

- [ ] **Step 3: Create `lib/validations/newsletter.ts`**

```ts
import { z } from "zod";
export const newsletterSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;
```

- [ ] **Step 4: Run test (expect pass)**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Create `components/marketing/newsletter-form.tsx`**

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { newsletterSchema, type NewsletterInput } from "@/lib/validations/newsletter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } =
    useForm<NewsletterInput>({ resolver: zodResolver(newsletterSchema) });

  async function onSubmit(_data: NewsletterInput) {
    // Stub: real submission wired in a later milestone.
    await new Promise((r) => setTimeout(r, 400));
    setDone(true);
    reset();
  }

  if (done) return <p className="text-sm text-success">Thanks — you're subscribed.</p>;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2 sm:flex-row" noValidate>
      <div className="flex-1">
        <label htmlFor="nl-email" className="sr-only">Email address</label>
        <Input id="nl-email" type="email" placeholder="you@email.com"
          className="bg-navy-800 border-navy-700 text-white placeholder:text-slate-400"
          aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Joining…" : "Subscribe"}</Button>
    </form>
  );
}
```

- [ ] **Step 6: Create `components/shared/footer.tsx`**

```tsx
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { NewsletterForm } from "@/components/marketing/newsletter-form";
import { footerColumns } from "@/lib/constants";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="bg-navy-950 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo inverted />
            <p className="mt-4 max-w-sm text-sm text-slate-400">{site.description}</p>
            <div className="mt-6 max-w-sm">
              <p className="mb-2 text-sm font-medium text-white">Get product updates</p>
              <NewsletterForm />
            </div>
          </div>
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-white">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l}><Link href="#" className="text-sm text-slate-400 transition-colors hover:text-white">{l}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-navy-800 pt-8 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <p className="mt-2 max-w-3xl">
            Crest Bank provides banking services through regulated partner institutions. This site is a demonstration
            project and not a real financial offering. Eligible deposits are insured up to applicable regulatory limits.
          </p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 7: Verify**

Run: `npm run test && npx tsc --noEmit`
Expected: tests pass, 0 type errors.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: footer + Zod-validated newsletter form"
```

---

### Task 10: Marketing layout (route group shell)

**Files:**
- Create: `app/(marketing)/layout.tsx`

- [ ] **Step 1: Create `app/(marketing)/layout.tsx`**

```tsx
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: marketing route-group layout"
```

---

## Phase 3 — Landing Page Sections

> Each section is a focused component in `components/marketing/`. They alternate
> navy/light backgrounds per the spec. All use `Reveal` for subtle scroll animation.

### Task 11: Hero section

**Files:**
- Create: `components/marketing/hero.tsx`

- [ ] **Step 1: Create `components/marketing/hero.tsx`**

```tsx
import Link from "next/link";
import { ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/shared/motion/reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-900 pt-28 pb-20 text-white sm:pt-32 lg:pt-40">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-primary/20 blur-3xl" aria-hidden />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Reveal>
          <span className="inline-flex items-center rounded-full border border-navy-700 bg-navy-800 px-3 py-1 text-xs font-medium text-slate-200">
            Premium digital banking
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Banking built on <span className="text-primary">trust</span>, designed for everyone.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">
            Open an account in minutes. Move money instantly, grow your savings, and manage personal and business
            finances with security you can rely on — 24/7.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg"><Link href="/register">Open an account</Link></Button>
            <Button asChild size="lg" variant="outline" className="border-navy-700 bg-transparent text-white hover:bg-white/10">
              <Link href="#features">Explore banking</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> Insured deposits</span>
            <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-success" /> 256-bit encryption</span>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="hidden lg:block">
          <HeroCard />
        </Reveal>
      </div>
    </section>
  );
}

function HeroCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-navy-700 bg-navy-800/80 p-6 shadow-card backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Total balance</p>
            <p className="mt-1 font-display text-3xl font-bold">$48,250.00</p>
          </div>
          <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">+2.4%</span>
        </div>
        <div className="mt-6 rounded-xl bg-gradient-to-br from-primary to-navy-700 p-5 text-white">
          <p className="text-xs uppercase tracking-wide text-white/70">Crest Debit</p>
          <p className="mt-6 font-mono text-lg tracking-widest">•••• •••• •••• 4921</p>
          <div className="mt-4 flex justify-between text-xs text-white/80"><span>A. CUSTOMER</span><span>12/29</span></div>
        </div>
        <div className="mt-6 space-y-3">
          {[["Apple Store", "-$129.00"], ["Salary", "+$5,400.00"], ["Transfer to Sofia", "-$250.00"]].map(([t, a]) => (
            <div key={t} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{t}</span>
              <span className={a.startsWith("+") ? "text-success" : "text-slate-200"}>{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: hero section"
```

---

### Task 12: Stats, Features, Benefits, Security, Testimonials, FAQ, CTA sections

**Files:**
- Create: `components/marketing/stats.tsx`, `features.tsx`, `benefits.tsx`, `security.tsx`, `testimonials.tsx`, `faq.tsx`, `cta-band.tsx`

- [ ] **Step 1: `components/marketing/stats.tsx`**

```tsx
import { Reveal } from "@/components/shared/motion/reveal";
import { stats } from "@/lib/constants";

export function Stats() {
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.05} className="rounded-2xl border bg-card p-6 text-center shadow-card">
              <p className="font-display text-3xl font-bold text-foreground sm:text-4xl">{s.value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `components/marketing/features.tsx`**

```tsx
import { Reveal } from "@/components/shared/motion/reveal";
import { features } from "@/lib/constants";

export function Features() {
  return (
    <section id="features" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to bank with confidence</h2>
          <p className="mt-4 text-lg text-muted-foreground">One platform for personal and business finance — accounts, savings, cards, lending, and investing.</p>
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05} className="group rounded-2xl border bg-card p-7 shadow-card transition-shadow hover:shadow-lg">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-6 w-6" /></span>
              <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `components/marketing/benefits.tsx`**

```tsx
import { CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/shared/motion/reveal";
import { benefits } from "@/lib/constants";

export function Benefits() {
  return (
    <section className="bg-navy-900 py-20 text-white sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Reveal>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Why customers choose Crest</h2>
          <p className="mt-4 text-lg text-slate-300">A banking experience that's fast, transparent, and genuinely on your side.</p>
          <ul className="mt-8 space-y-6">
            {benefits.map((b) => (
              <li key={b.title} className="flex gap-4">
                <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-success" />
                <div>
                  <h3 className="font-display text-lg font-semibold">{b.title}</h3>
                  <p className="mt-1 text-slate-300">{b.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1} className="rounded-2xl border border-navy-700 bg-navy-800 p-8 shadow-card">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-navy-900 p-4">
              <span className="text-sm text-slate-300">Monthly spending</span>
              <span className="font-display text-xl font-bold">$3,120</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-navy-900"><div className="h-full w-2/3 rounded-full bg-primary" /></div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              {[["Housing", "42%"], ["Food", "23%"], ["Other", "35%"]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-navy-900 p-3"><p className="font-display text-lg font-bold">{v}</p><p className="text-slate-400">{k}</p></div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: `components/marketing/security.tsx`**

```tsx
import { Reveal } from "@/components/shared/motion/reveal";
import { security } from "@/lib/constants";

export function Security() {
  return (
    <section id="security" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Your security is the foundation</h2>
          <p className="mt-4 text-lg text-muted-foreground">Bank-grade protection on every account, every transaction, every day.</p>
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {security.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05} className="rounded-2xl border bg-card p-7 text-center shadow-card">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-success/10 text-success"><s.icon className="h-6 w-6" /></span>
              <h3 className="mt-5 font-display text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: `components/marketing/testimonials.tsx`**

```tsx
import { Reveal } from "@/components/shared/motion/reveal";
import { testimonials } from "@/lib/constants";

export function Testimonials() {
  return (
    <section className="bg-navy-900 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Trusted by millions</h2>
          <p className="mt-4 text-lg text-slate-300">Real stories from people and businesses that bank with Crest.</p>
        </Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.05} className="flex flex-col rounded-2xl border border-navy-700 bg-navy-800 p-7">
              <p className="flex-1 text-slate-200">“{t.quote}”</p>
              <div className="mt-6">
                <p className="font-display font-semibold">{t.name}</p>
                <p className="text-sm text-slate-400">{t.role}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: `components/marketing/faq.tsx`**

```tsx
import { Reveal } from "@/components/shared/motion/reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqs } from "@/lib/constants";

export function Faq() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h2>
          <p className="mt-4 text-lg text-muted-foreground">Everything you need to know before getting started.</p>
        </Reveal>
        <Reveal className="mt-10">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`}>
                <AccordionTrigger className="text-left font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: `components/marketing/cta-band.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/shared/motion/reveal";

export function CtaBand() {
  return (
    <section className="bg-background pb-20 sm:pb-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-navy-900 px-8 py-16 text-center text-white sm:px-16">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Open your Crest account today</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">It takes about five minutes. No paperwork, no hidden fees, no branch visit.</p>
          <Button asChild size="lg" variant="secondary" className="mt-8 bg-white text-navy-900 hover:bg-slate-100">
            <Link href="/register">Get started — it's free</Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: stats, features, benefits, security, testimonials, faq, cta sections"
```

---

### Task 13: Assemble landing page

**Files:**
- Create: `app/(marketing)/page.tsx`
- Delete: `app/page.tsx` (default scaffold page, replaced by route-group page)

- [ ] **Step 1: Remove the default root page**

```bash
git rm app/page.tsx
```

- [ ] **Step 2: Create `app/(marketing)/page.tsx`**

```tsx
import { Hero } from "@/components/marketing/hero";
import { Stats } from "@/components/marketing/stats";
import { Features } from "@/components/marketing/features";
import { Benefits } from "@/components/marketing/benefits";
import { Security } from "@/components/marketing/security";
import { Testimonials } from "@/components/marketing/testimonials";
import { Faq } from "@/components/marketing/faq";
import { CtaBand } from "@/components/marketing/cta-band";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Features />
      <Benefits />
      <Security />
      <Testimonials />
      <Faq />
      <CtaBand />
    </>
  );
}
```

- [ ] **Step 3: Verify the full build + manual check**

Run: `npm run build` then `npm run dev`, visit `http://localhost:3000`.
Expected: full landing page renders, all sections present, navbar turns solid on scroll, mobile menu works (resize to <768px), FAQ accordion opens. Stop server.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: assemble Crest Bank landing page"
```

---

### Task 14: Stub routes + not-found + design-system page

**Files:**
- Create: `app/(marketing)/about/page.tsx`, `app/(marketing)/contact/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/not-found.tsx`, `app/design-system/page.tsx`

- [ ] **Step 1: Create a shared stub for deferred pages**

`app/(marketing)/about/page.tsx`:
```tsx
export const metadata = { title: "About" };
export default function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-40 text-center">
      <h1 className="font-display text-4xl font-bold">About Crest Bank</h1>
      <p className="mt-4 text-muted-foreground">This page ships in a later milestone.</p>
    </section>
  );
}
```
Create `app/(marketing)/contact/page.tsx` identically with title "Contact" and heading "Contact us".

- [ ] **Step 2: Create auth route stubs**

`app/login/page.tsx`:
```tsx
export const metadata = { title: "Log in" };
export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-navy-900 px-4 text-center text-white">
      <div>
        <h1 className="font-display text-3xl font-bold">Welcome back</h1>
        <p className="mt-3 text-slate-300">Authentication ships in Milestone 2.</p>
        <a href="/" className="mt-6 inline-block text-primary underline">Back to home</a>
      </div>
    </main>
  );
}
```
Create `app/register/page.tsx` identically with title "Open an account" and heading "Create your account".

- [ ] **Step 3: Create `app/not-found.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <p className="font-display text-6xl font-bold text-primary">404</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">The page you're looking for doesn't exist.</p>
        <Button asChild className="mt-6"><Link href="/">Back to home</Link></Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create `app/design-system/page.tsx`** (noindex living style guide)

```tsx
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Design System", robots: { index: false, follow: false } };

const swatches = [
  ["Navy 950", "bg-navy-950"], ["Navy 900", "bg-navy-900"], ["Navy 800", "bg-navy-800"],
  ["Primary", "bg-primary"], ["Success", "bg-success"], ["Destructive", "bg-destructive"],
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-4xl font-bold">Crest Bank Design System</h1>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Color</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {swatches.map(([name, cls]) => (
            <div key={name} className="overflow-hidden rounded-xl border">
              <div className={`h-20 ${cls}`} />
              <p className="p-3 text-sm font-medium">{name}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Typography</h2>
        <div className="mt-4 space-y-3">
          <p className="font-display text-5xl font-bold">Display 5xl</p>
          <p className="font-display text-3xl font-bold">Heading 3xl</p>
          <p className="text-lg">Body large — Inter regular.</p>
          <p className="text-sm text-muted-foreground">Muted small text.</p>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: succeeds; routes `/about`, `/contact`, `/login`, `/register`, `/design-system` compile.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: stub routes, 404, and design-system page"
```

---

## Phase 4 — Supabase Wiring

### Task 15: Supabase client/server/middleware helpers + env

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, `.env.example`, `lib/env.ts`

- [ ] **Step 1: Create `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Create `lib/env.ts`** (safe accessors so the site runs without creds)

```ts
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anonKey, configured: Boolean(url && anonKey) };
}
```

- [ ] **Step 3: Create `lib/supabase/client.ts`**

```ts
"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";

export function createClient() {
  const { url, anonKey, configured } = getSupabaseEnv();
  if (!configured) throw new Error("Supabase env not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return createBrowserClient(url!, anonKey!);
}
```

- [ ] **Step 4: Create `lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey, configured } = getSupabaseEnv();
  if (!configured) throw new Error("Supabase env not configured.");
  return createServerClient(url!, anonKey!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* called from a Server Component */ }
      },
    },
  });
}
```

- [ ] **Step 5: Create `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";

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
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser(); // refresh session; route gating added in M2
  return response;
}
```

- [ ] **Step 6: Create root `middleware.ts`**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 7: Verify build runs WITHOUT env set**

Run: `npm run build`
Expected: build succeeds and the landing page does not throw (clients are lazy/guarded).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: Supabase client/server/middleware wiring (creds-optional)"
```

---

## Phase 5 — Database Backend (SQL Migrations)

> All migrations live in `supabase/migrations/`. They must apply in numeric order to a
> fresh database. Money is `numeric(19,4)`. Every table has `created_at`/`updated_at` and
> deny-by-default RLS.

### Task 16: Extensions + shared trigger + profiles

**Files:**
- Create: `supabase/migrations/0001_extensions.sql`, `0002_profiles.sql`

- [ ] **Step 1: `0001_extensions.sql`**

```sql
-- Extensions & shared helpers
create extension if not exists pgcrypto;

-- Shared updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;
```

- [ ] **Step 2: `0002_profiles.sql`**

```sql
-- profiles: app-facing user record, 1:1 with auth.users
create type public.kyc_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.user_role as enum ('customer', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  country text,
  avatar_url text,
  kyc_status public.kyc_status not null default 'unverified',
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when an auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): extensions, updated_at trigger, profiles + new-user trigger"
```

---

### Task 17: accounts + beneficiaries

**Files:**
- Create: `supabase/migrations/0003_accounts.sql`, `0004_beneficiaries.sql`

- [ ] **Step 1: `0003_accounts.sql`**

```sql
create type public.account_type as enum ('checking', 'savings', 'current', 'business');
create type public.account_status as enum ('active', 'frozen', 'closed');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_number text not null unique,
  type public.account_type not null default 'checking',
  currency char(3) not null default 'USD',
  balance numeric(19,4) not null default 0,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts(user_id);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: `0004_beneficiaries.sql`**

```sql
create type public.beneficiary_type as enum ('internal', 'external', 'wire');

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  bank_name text,
  account_number text not null,
  routing_number text,
  iban text,
  type public.beneficiary_type not null default 'internal',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index beneficiaries_user_id_idx on public.beneficiaries(user_id);

create trigger beneficiaries_set_updated_at
  before update on public.beneficiaries
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): accounts + beneficiaries"
```

---

### Task 18: transactions + transfers

**Files:**
- Create: `supabase/migrations/0005_transactions.sql`, `0006_transfers.sql`

- [ ] **Step 1: `0005_transactions.sql`**

```sql
create type public.txn_type as enum ('credit', 'debit');
create type public.txn_status as enum ('pending', 'completed', 'failed', 'reversed');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  type public.txn_type not null,
  category text not null default 'general',
  amount numeric(19,4) not null check (amount >= 0),
  currency char(3) not null default 'USD',
  status public.txn_status not null default 'completed',
  description text,
  counterparty text,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_account_created_idx on public.transactions(account_id, created_at desc);
create index transactions_category_idx on public.transactions(category);
create index transactions_status_idx on public.transactions(status);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: `0006_transfers.sql`**

```sql
create type public.transfer_kind as enum ('internal', 'external', 'wire');
create type public.transfer_status as enum ('pending', 'completed', 'failed', 'scheduled');

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.accounts(id) on delete cascade,
  to_account_id uuid references public.accounts(id) on delete set null,
  beneficiary_id uuid references public.beneficiaries(id) on delete set null,
  amount numeric(19,4) not null check (amount > 0),
  currency char(3) not null default 'USD',
  kind public.transfer_kind not null default 'internal',
  status public.transfer_status not null default 'pending',
  reference text,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transfers_from_account_idx on public.transfers(from_account_id);

create trigger transfers_set_updated_at
  before update on public.transfers
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): transactions + transfers"
```

---

### Task 19: cards + notifications + support_tickets

**Files:**
- Create: `supabase/migrations/0007_cards.sql`, `0008_notifications.sql`, `0009_support_tickets.sql`

- [ ] **Step 1: `0007_cards.sql`**

```sql
create type public.card_type as enum ('debit', 'credit');
create type public.card_status as enum ('active', 'frozen', 'cancelled');

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  brand text not null default 'Visa',
  type public.card_type not null default 'debit',
  last4 char(4) not null,
  exp_month smallint not null check (exp_month between 1 and 12),
  exp_year smallint not null,
  status public.card_status not null default 'active',
  is_virtual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cards_account_id_idx on public.cards(account_id);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: `0008_notifications.sql`**

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_user_read_idx on public.notifications(user_id, is_read);

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3: `0009_support_tickets.sql`**

```sql
create type public.ticket_status as enum ('open', 'pending', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  body text not null,
  category text not null default 'general',
  status public.ticket_status not null default 'open',
  priority public.ticket_priority not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_user_status_idx on public.support_tickets(user_id, status);

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): cards, notifications, support_tickets"
```

---

### Task 20: Storage buckets

**Files:**
- Create: `supabase/migrations/0010_storage_buckets.sql`

- [ ] **Step 1: `0010_storage_buckets.sql`**

```sql
-- Buckets
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('kyc-documents', 'kyc-documents', false),
  ('marketing-assets', 'marketing-assets', true)
on conflict (id) do nothing;

-- avatars: public read, owner-scoped write (path prefix = auth.uid())
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars owner write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars owner update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars owner delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- kyc-documents: owner-only read/write (no public read)
create policy "kyc owner read" on storage.objects
  for select using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "kyc owner write" on storage.objects
  for insert with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- marketing-assets: public read; writes reserved for service role (no insert policy = denied to anon/auth)
create policy "marketing public read" on storage.objects
  for select using (bucket_id = 'marketing-assets');
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(db): storage buckets + storage RLS policies"
```

---

### Task 21: Row Level Security policies

**Files:**
- Create: `supabase/migrations/0011_rls_policies.sql`

- [ ] **Step 1: `0011_rls_policies.sql`** (enable RLS + deny-by-default + owner policies)

```sql
-- Enable RLS on all app tables (deny-by-default once enabled)
alter table public.profiles        enable row level security;
alter table public.accounts        enable row level security;
alter table public.beneficiaries   enable row level security;
alter table public.transactions    enable row level security;
alter table public.transfers       enable row level security;
alter table public.cards           enable row level security;
alter table public.notifications   enable row level security;
alter table public.support_tickets enable row level security;

-- profiles: owner select/update (no insert from client; trigger handles creation)
create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- accounts: owner full access
create policy "accounts select own" on public.accounts for select using (auth.uid() = user_id);
create policy "accounts insert own" on public.accounts for insert with check (auth.uid() = user_id);
create policy "accounts update own" on public.accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- beneficiaries: owner full access
create policy "beneficiaries select own" on public.beneficiaries for select using (auth.uid() = user_id);
create policy "beneficiaries insert own" on public.beneficiaries for insert with check (auth.uid() = user_id);
create policy "beneficiaries update own" on public.beneficiaries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "beneficiaries delete own" on public.beneficiaries for delete using (auth.uid() = user_id);

-- helper predicate inlined: account belongs to current user
-- transactions: select/insert scoped to owned accounts; no client update/delete (financial immutability)
create policy "transactions select own" on public.transactions for select
  using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "transactions insert own" on public.transactions for insert
  with check (account_id in (select id from public.accounts where user_id = auth.uid()));

-- transfers: select/insert scoped to owned source account; no client update/delete
create policy "transfers select own" on public.transfers for select
  using (from_account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "transfers insert own" on public.transfers for insert
  with check (from_account_id in (select id from public.accounts where user_id = auth.uid()));

-- cards: scoped to owned accounts
create policy "cards select own" on public.cards for select
  using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "cards insert own" on public.cards for insert
  with check (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "cards update own" on public.cards for update
  using (account_id in (select id from public.accounts where user_id = auth.uid()))
  with check (account_id in (select id from public.accounts where user_id = auth.uid()));

-- notifications: owner select/update (mark read)
create policy "notifications select own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications update own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- support_tickets: owner full access
create policy "tickets select own" on public.support_tickets for select using (auth.uid() = user_id);
create policy "tickets insert own" on public.support_tickets for insert with check (auth.uid() = user_id);
create policy "tickets update own" on public.support_tickets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: (If Docker/Supabase CLI available) verify migrations apply**

Run: `npx supabase init` (if not already) then `npx supabase db reset`
Expected: all migrations apply with no errors; tables + policies created.
If the CLI/Docker is unavailable, skip — migrations are validated by the documented apply order in the README (Task 22).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): enable RLS + owner policies on all tables"
```

---

## Phase 6 — Docs & Final Verification

### Task 22: README + env docs + security notes

**Files:**
- Create/Modify: `README.md`

- [ ] **Step 1: Write `README.md`** covering:
  - Project intro (Crest Bank, M1 foundation).
  - Setup: `npm install`, copy `.env.example` → `.env.local`, fill Supabase keys.
  - Run: `npm run dev`, `npm run build`, `npm run lint`, `npm run test`.
  - Supabase: create a project, then apply migrations **in numeric order** via the SQL editor or `supabase db push`/`supabase db reset`. Document the order `0001 → 0011`.
  - Architecture overview (route groups, design tokens, data-driven sections, RLS deny-by-default).
  - Security notes: service-role key is server-only; RLS deny-by-default; rate-limiting strategy planned for M2 API routes (per-IP + per-user token bucket on mutating endpoints); input sanitization via Zod + parameterized Supabase queries.
  - Roadmap: M2 auth, M3 dashboard+accounts, M4 transfers, M5 cards+settings.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "docs: README with setup, migration order, security notes"
```

---

### Task 23: Full verification gate

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 2: Types**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Tests**

Run: `npm run test`
Expected: all pass.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: succeeds; all routes compile.

- [ ] **Step 5: Manual smoke (dev server)**

Run: `npm run dev`. Verify: landing renders all 10 sections; navbar solidifies on scroll; mobile sheet opens/closes; FAQ accordion keyboard-operable; `/design-system` renders; `/about`, `/contact`, `/login`, `/register`, a bogus URL (404) all render. Stop server.

- [ ] **Step 6: Final commit (if any fixes)**

```bash
git add -A && git commit -m "chore: M1 verification fixes"
```

---

## Self-Review Notes (coverage vs spec)

- §3 Design system → Tasks 4–6, 14 (tokens, fonts, motion, /design-system). ✓
- §4 Project structure → created across Tasks 1–22. ✓
- §5 Landing composition (10 sections) → Tasks 8–13. ✓
- §6 Schema (8 tables, indexes, triggers, RLS) → Tasks 16–21. ✓
- §6.4 Storage buckets → Task 20. ✓
- §7 Supabase wiring (creds-optional) → Task 15. ✓
- §8 Security (RLS, service-role server-only, Zod, headers, documented rate-limit) → Tasks 9, 15, 21, 22. ✓
- §9 A11y/perf (semantic, focus, reduced-motion, next/font) → Tasks 4, 5, 8, 11–13. ✓
- §10 Acceptance criteria → Task 23 verification gate. ✓

Note on `next.config` security headers (§8): add a `headers()` async function returning
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Content-Type-Options: nosniff` during Task 15 Step 6 (same commit) — included here so it
isn't missed.
