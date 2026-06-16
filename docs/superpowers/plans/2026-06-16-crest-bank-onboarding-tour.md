# Crest Bank Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a skippable, replayable spotlight coachmark tour that auto-starts for new users on their first dashboard visit and walks them through the sidebar sections.

**Architecture:** A pure, unit-tested layout function computes the spotlight hole + tooltip position; a client `TourProvider` (context) owns tour state and auto-starts via a `localStorage` flag; a `TourOverlay` renders the dimmer/hole/tooltip by measuring `data-tour` targets; a topbar `TourLauncher` re-opens it. No DB, no network.

**Tech Stack:** Next.js 14 App Router, TS strict, Tailwind v3, lucide-react, Vitest.

**Codebase facts:**
- Dashboard shell: `app/dashboard/layout.tsx` (server) renders `aside` (SidebarNav), `Topbar`, and `<main>`.
- `components/dashboard/sidebar.tsx` (`SidebarNav`, client, `usePathname`) maps `dashboardNav` to links; enabled items render `<Link>`, disabled render `<span>`. All 7 items are enabled after M5.
- `components/dashboard/topbar.tsx` (client) renders `NotificationsPopover` + `UserMenu`.
- Nav hrefs: `/dashboard`, `/dashboard/accounts`, `/dashboard/beneficiaries`, `/dashboard/transfers`, `/dashboard/transactions`, `/dashboard/cards`, `/dashboard/settings`.
- `Button` (variants default/outline; sizes sm), `cn`. Tokens: `bg-card`, `shadow-card`, `ring-primary`, `text-muted-foreground`, `font-display`, `border`, navy values. The topbar is `z-30`.
- Path alias `@/*` = repo root. Vitest + jsdom configured.

**Verification gates (per phase):** `npm run test`, `npx tsc --noEmit`, `npm run lint`. Run `npm run build` only at the final task (fonts flaky; retry once; `dangerouslyDisableSandbox: true` if sandbox blocks npm).

---

## Phase 1 — Pure logic + data

### Task 1: Spotlight layout function

**Files:**
- Create: `lib/tour/position.ts`
- Test: `lib/tour/__tests__/position.test.ts`

- [ ] **Step 1: Write failing test** — `lib/tour/__tests__/position.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { computeSpotlightLayout, type Rect } from "@/lib/tour/position";

const tooltip = { width: 300, height: 150 };
const viewport = { width: 1000, height: 800 };

describe("computeSpotlightLayout", () => {
  it("centers with no hole when the target is null", () => {
    const l = computeSpotlightLayout(null, tooltip, viewport);
    expect(l.placement).toBe("center");
    expect(l.hole).toBeNull();
    expect(l.tooltip).toEqual({ top: 325, left: 350 });
  });

  it("centers when the target has zero size (hidden, e.g. mobile)", () => {
    const target: Rect = { top: 0, left: 0, width: 0, height: 0 };
    expect(computeSpotlightLayout(target, tooltip, viewport).placement).toBe("center");
  });

  it("places below a target with room beneath it", () => {
    const target: Rect = { top: 100, left: 50, width: 200, height: 40 };
    const l = computeSpotlightLayout(target, tooltip, viewport, { gap: 12, pad: 8 });
    expect(l.placement).toBe("below");
    expect(l.tooltip.top).toBe(152); // 100 + 40 + 12
    expect(l.tooltip.left).toBe(50);
    expect(l.hole).toEqual({ top: 92, left: 42, width: 216, height: 56 });
  });

  it("flips above when there is no room below", () => {
    const target: Rect = { top: 700, left: 50, width: 200, height: 40 };
    const l = computeSpotlightLayout(target, tooltip, viewport, { gap: 12 });
    expect(l.placement).toBe("above");
    expect(l.tooltip.top).toBe(538); // 700 - 12 - 150
  });

  it("clamps the tooltip horizontally within the viewport", () => {
    const target: Rect = { top: 100, left: 950, width: 40, height: 40 };
    const l = computeSpotlightLayout(target, tooltip, viewport, { margin: 8 });
    expect(l.tooltip.left).toBe(692); // 1000 - 300 - 8
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — `lib/tour/position.ts`

```ts
export type Rect = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Viewport = { width: number; height: number };
export type SpotlightLayout = {
  hole: Rect | null;
  tooltip: { top: number; left: number };
  placement: "below" | "above" | "center";
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeSpotlightLayout(
  target: Rect | null,
  tooltip: Size,
  viewport: Viewport,
  opts: { gap?: number; pad?: number; margin?: number } = {}
): SpotlightLayout {
  const gap = opts.gap ?? 12;
  const pad = opts.pad ?? 8;
  const margin = opts.margin ?? 8;

  if (!target || target.width === 0 || target.height === 0) {
    return {
      hole: null,
      placement: "center",
      tooltip: {
        top: Math.max(margin, viewport.height / 2 - tooltip.height / 2),
        left: Math.max(margin, viewport.width / 2 - tooltip.width / 2),
      },
    };
  }

  const hole: Rect = {
    top: target.top - pad,
    left: target.left - pad,
    width: target.width + pad * 2,
    height: target.height + pad * 2,
  };

  const belowTop = target.top + target.height + gap;
  const fitsBelow = belowTop + tooltip.height + margin <= viewport.height;
  const placement = fitsBelow ? "below" : "above";
  const rawTop = fitsBelow ? belowTop : target.top - gap - tooltip.height;

  const top = clamp(rawTop, margin, Math.max(margin, viewport.height - tooltip.height - margin));
  const left = clamp(target.left, margin, Math.max(margin, viewport.width - tooltip.width - margin));

  return { hole, placement, tooltip: { top, left } };
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/tour/position.ts lib/tour/__tests__/position.test.ts
git commit -m "feat(tour): pure spotlight layout function"
```

---

### Task 2: Steps data + storage helpers

**Files:**
- Create: `lib/tour/steps.ts`, `lib/tour/storage.ts`

- [ ] **Step 1: Create `lib/tour/steps.ts`**

```ts
export type TourStep = { key: string; title: string; body: string };

// `key` matches the `data-tour` attribute on the corresponding sidebar link.
export const tourSteps: TourStep[] = [
  { key: "dashboard", title: "Your dashboard", body: "See your balances, spending, recent activity, and notifications at a glance." },
  { key: "accounts", title: "Accounts", body: "Open any account to view its balance history and transactions." },
  { key: "beneficiaries", title: "Beneficiaries", body: "Save the people and businesses you want to pay." },
  { key: "transfers", title: "Transfers", body: "Move money between your own accounts or send to a beneficiary." },
  { key: "transactions", title: "Transactions", body: "Search, filter, and export your full transaction history." },
  { key: "cards", title: "Cards", body: "View your cards, freeze or unfreeze them, or request a virtual card." },
  { key: "settings", title: "Settings", body: "Update your profile and avatar, change your password, and set notification preferences." },
];
```

- [ ] **Step 2: Create `lib/tour/storage.ts`**

```ts
const KEY = "crest_tour_seen";

export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true; // never auto-start during SSR
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false; // private mode: treat as unseen (shows each session), never throw
  }
}

export function markTourSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore (private mode / storage disabled) */
  }
}
```

- [ ] **Step 3: Verify** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/tour/steps.ts lib/tour/storage.ts
git commit -m "feat(tour): step definitions + localStorage seen helpers"
```

---

## Phase 2 — Tour components

### Task 3: Tour overlay

**Files:**
- Create: `components/dashboard/tour/tour-overlay.tsx`

- [ ] **Step 1: Implement** — `components/dashboard/tour/tour-overlay.tsx`

```tsx
"use client";

import * as React from "react";
import { X } from "lucide-react";
import { tourSteps } from "@/lib/tour/steps";
import { computeSpotlightLayout, type Rect, type SpotlightLayout } from "@/lib/tour/position";
import { Button } from "@/components/ui/button";

const TOOLTIP = { width: 320, height: 210 };

function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function TourOverlay({
  stepIndex,
  onNext,
  onBack,
  onClose,
}: {
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const step = tourSteps[stepIndex];
  const total = tourSteps.length;
  const isLast = stepIndex === total - 1;
  const isFirst = stepIndex === 0;

  const [layout, setLayout] = React.useState<SpotlightLayout | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  const measure = React.useCallback(() => {
    const el = document.querySelector(`[data-tour="${step.key}"]`);
    if (el) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const target = rectOf(el);
    setLayout(
      computeSpotlightLayout(target, TOOLTIP, {
        width: window.innerWidth,
        height: window.innerHeight,
      })
    );
  }, [step.key]);

  React.useEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
    };
  }, [measure]);

  React.useEffect(() => {
    cardRef.current?.focus();
  }, [stepIndex]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!layout) return null;
  const { hole, tooltip } = layout;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={step.title}>
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id="crest-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx="12" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(8,21,43,0.6)" mask="url(#crest-tour-mask)" />
      </svg>

      {hole && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
          aria-hidden="true"
        />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        className="absolute w-80 rounded-2xl border bg-card p-5 text-card-foreground shadow-card outline-none"
        style={{ top: tooltip.top, left: tooltip.left }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Skip tour"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-xs font-medium text-muted-foreground">Step {stepIndex + 1} of {total}</p>
        <h2 className="mt-1 font-display text-lg font-semibold">{step.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Skip
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
            )}
            <Button size="sm" onClick={isLast ? onClose : onNext}>
              {isLast ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/tour/tour-overlay.tsx
git commit -m "feat(tour): spotlight overlay (dimmer, hole, tooltip, controls)"
```

---

### Task 4: Tour provider + launcher

**Files:**
- Create: `components/dashboard/tour/tour-provider.tsx`, `components/dashboard/tour/tour-launcher.tsx`

- [ ] **Step 1: Implement** — `components/dashboard/tour/tour-provider.tsx`

```tsx
"use client";

import * as React from "react";
import { tourSteps } from "@/lib/tour/steps";
import { hasSeenTour, markTourSeen } from "@/lib/tour/storage";
import { TourOverlay } from "@/components/dashboard/tour/tour-overlay";

type TourContextValue = { start: () => void };

const TourContext = React.createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = React.useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);

  const start = React.useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const end = React.useCallback(() => {
    setActive(false);
    markTourSeen();
  }, []);

  React.useEffect(() => {
    if (hasSeenTour()) return;
    const t = setTimeout(() => {
      setStepIndex(0);
      setActive(true);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <TourContext.Provider value={{ start }}>
      {children}
      {active && (
        <TourOverlay
          stepIndex={stepIndex}
          onNext={() => setStepIndex((i) => Math.min(i + 1, tourSteps.length - 1))}
          onBack={() => setStepIndex((i) => Math.max(i - 1, 0))}
          onClose={end}
        />
      )}
    </TourContext.Provider>
  );
}
```

- [ ] **Step 2: Implement** — `components/dashboard/tour/tour-launcher.tsx`

```tsx
"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/components/dashboard/tour/tour-provider";

export function TourLauncher() {
  const { start } = useTour();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={start}
      aria-label="Take the tour"
      className="text-slate-200 hover:bg-white/10 hover:text-white"
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}
```

- [ ] **Step 3: Verify** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/tour/tour-provider.tsx components/dashboard/tour/tour-launcher.tsx
git commit -m "feat(tour): provider (auto-start + context) and launcher button"
```

---

## Phase 3 — Wire into the dashboard shell

### Task 5: data-tour attributes + launcher + provider

**Files:**
- Modify: `components/dashboard/sidebar.tsx`, `components/dashboard/topbar.tsx`, `app/dashboard/layout.tsx`

- [ ] **Step 1: Add `data-tour` to sidebar links** in `components/dashboard/sidebar.tsx`.
  Compute the key from the href and set it on BOTH the enabled `<Link>` and the disabled `<span>`
  (harmless if some are disabled). Add this helper near the top of the component body (after
  `const pathname = usePathname();`):

```tsx
  const tourKey = (href: string) => (href === "/dashboard" ? "dashboard" : href.split("/").pop());
```
  Then on the disabled `<span ...>` add `data-tour={tourKey(item.href)}`, and on the active/link
  `<Link ...>` add `data-tour={tourKey(item.href)}`. (Place the attribute alongside the existing
  `key`/`href` props.)

- [ ] **Step 2: Add the launcher to `components/dashboard/topbar.tsx`.**
  Add the import:
```tsx
import { TourLauncher } from "@/components/dashboard/tour/tour-launcher";
```
  In the right-hand controls cluster (the `div` containing `NotificationsPopover` and
  `UserMenu`), render `<TourLauncher />` as the first child:
```tsx
      <div className="flex items-center gap-2">
        <TourLauncher />
        <NotificationsPopover notifications={notifications} />
        <UserMenu name={name} email={email} avatarUrl={avatarUrl} />
      </div>
```

- [ ] **Step 3: Wrap the shell in `TourProvider` in `app/dashboard/layout.tsx`.**
  Add the import:
```tsx
import { TourProvider } from "@/components/dashboard/tour/tour-provider";
```
  Wrap the returned root `<div className="min-h-screen ...">…</div>` so the provider is the
  outermost element:
```tsx
  return (
    <TourProvider>
      <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]">
        {/* ...existing aside + Topbar + main unchanged... */}
      </div>
    </TourProvider>
  );
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/sidebar.tsx components/dashboard/topbar.tsx app/dashboard/layout.tsx
git commit -m "feat(tour): wire tour into dashboard shell (data-tour, launcher, provider)"
```

---

## Phase 4 — Docs & final verification

### Task 6: README note

**Files:** Modify `README.md`

- [ ] **Step 1: Add a short "Onboarding tour" note** under the Dashboard (M3) section: new users
  get a skippable spotlight tour on their first dashboard visit (remembered via `localStorage`
  key `crest_tour_seen`); a "Take the tour" button in the topbar replays it. No backend/migration.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: note the new-user onboarding tour"
```

---

### Task 7: Final verification gate

- [ ] **Step 1: Tests** — `npm run test` → all pass (including `computeSpotlightLayout`).
- [ ] **Step 2: Types** — `npx tsc --noEmit` → 0 errors.
- [ ] **Step 3: Lint** — `npm run lint` → 0 errors.
- [ ] **Step 4: Build** — `npm run build` → succeeds; the dashboard routes still compile. (Retry once on a fonts socket error; `dangerouslyDisableSandbox: true` if sandbox blocks npm.)
- [ ] **Step 5: Manual smoke (optional, needs Supabase + a logged-in user):** clear the
  `crest_tour_seen` key, load `/dashboard` → tour auto-starts; Next/Back/Skip/Esc work; reload →
  no auto-show; "Take the tour" replays; shrink to mobile width → tooltip centers.
- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "chore(tour): verification fixes"
```

---

## Self-Review Notes (coverage vs spec)

- §2 architecture (position, steps, storage, provider, overlay, launcher, wiring) → Tasks 1–5. ✓
- §3 pure logic (computeSpotlightLayout) → Task 1. ✓
- §4 steps → Task 2. ✓
- §5 behavior (auto-start via localStorage, next/back/skip/finish, replay) → Tasks 3,4,5. ✓
- §6 UI (dimmer + hole + tooltip + controls + launcher; z-[60] above topbar) → Tasks 3,4,5. ✓
- §7 edge cases (hidden target → centered; localStorage guarded; resize re-measure; SSR-safe) → Tasks 1,2,3. ✓
- §8 security/perf (no data/network; passive listeners removed) → Task 3. ✓
- §9 testing (computeSpotlightLayout unit + manual plan) → Tasks 1,7. ✓
- §10 acceptance criteria → Task 7 gate + manual plan. ✓

**Type consistency:** `Rect`/`SpotlightLayout` from `position.ts` (Task 1) used by `tour-overlay` (Task 3). `tourSteps`/`TourStep` (Task 2) used by overlay + provider (Tasks 3,4). `useTour()` exported by provider (Task 4), consumed by launcher (Task 4) and reachable in topbar (Task 5, within provider). `data-tour` keys (Task 5: `dashboard|accounts|beneficiaries|transfers|transactions|cards|settings`) exactly match `tourSteps[].key` (Task 2). Overlay props (`stepIndex/onNext/onBack/onClose`) match the provider's render (Task 4).
