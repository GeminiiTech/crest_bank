# Crest Bank Per-Page Tutorials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the onboarding tour into a registry of per-page tours so each dashboard page (accounts, beneficiaries, transfers, transactions, cards, settings) auto-runs its own first-visit spotlight tutorial, remembered separately and replayable from the topbar.

**Architecture:** A pure registry maps routes → tour ids and holds each tour's steps; the provider becomes route-aware (auto-starts the current route's unseen tour); the overlay takes a `steps` prop; storage is keyed per tour. In-page elements get namespaced `data-tour` attributes.

**Tech Stack:** Next.js 14 App Router, TS strict, Tailwind v3, Vitest. Reuses the existing `computeSpotlightLayout` + overlay.

**Codebase facts (verified):**
- Existing tour files: `lib/tour/position.ts` (pure, tested), `lib/tour/steps.ts` (`tourSteps` — overview steps), `lib/tour/storage.ts` (`hasSeenTour()/markTourSeen()`, no args), `components/dashboard/tour/{tour-overlay,tour-provider,tour-launcher}.tsx`.
- `tour-overlay.tsx` currently imports `tourSteps` and reads `step.key` (string). `tour-provider.tsx` is a single global tour (no routing). `tour-launcher.tsx` calls `useTour().start()` with no args.
- `TourStep.key` is currently `string`; this plan changes it to `string | null` (null = centered step).
- Pages/components to tag (anchors confirmed): see Task 3.
- Path alias `@/*` = repo root. Vitest + jsdom configured.

**Verification gates (per phase):** `npm run test`, `npx tsc --noEmit`, `npm run lint`. Run `npm run build` only at the final task (fonts flaky; retry once; `dangerouslyDisableSandbox: true` if sandbox blocks npm).

---

## Phase 1 — Tour registry (TDD)

### Task 1: Registry + `tourIdForPath`

**Files:**
- Create: `lib/tour/registry.ts`
- Test: `lib/tour/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing test** — `lib/tour/__tests__/registry.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { tourIdForPath, tours } from "@/lib/tour/registry";

describe("tourIdForPath", () => {
  it("maps each dashboard route to its tour id", () => {
    expect(tourIdForPath("/dashboard")).toBe("overview");
    expect(tourIdForPath("/dashboard/accounts")).toBe("accounts");
    expect(tourIdForPath("/dashboard/beneficiaries")).toBe("beneficiaries");
    expect(tourIdForPath("/dashboard/transfers")).toBe("transfers");
    expect(tourIdForPath("/dashboard/transactions")).toBe("transactions");
    expect(tourIdForPath("/dashboard/cards")).toBe("cards");
    expect(tourIdForPath("/dashboard/settings")).toBe("settings");
  });
  it("returns null for unknown or detail routes", () => {
    expect(tourIdForPath("/dashboard/accounts/abc-123")).toBeNull();
    expect(tourIdForPath("/login")).toBeNull();
    expect(tourIdForPath("/")).toBeNull();
  });
  it("every tour has at least one step", () => {
    (Object.keys(tours) as (keyof typeof tours)[]).forEach((id) => {
      expect(tours[id].length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npm run test`

- [ ] **Step 3: Implement** — `lib/tour/registry.ts`

```ts
export type TourStep = { key: string | null; title: string; body: string };

export type TourId =
  | "overview"
  | "accounts"
  | "beneficiaries"
  | "transfers"
  | "transactions"
  | "cards"
  | "settings";

export const tours: Record<TourId, TourStep[]> = {
  overview: [
    { key: "dashboard", title: "Your dashboard", body: "See your balances, spending, recent activity, and notifications at a glance." },
    { key: "accounts", title: "Accounts", body: "Open any account to view its balance history and transactions." },
    { key: "beneficiaries", title: "Beneficiaries", body: "Save the people and businesses you want to pay." },
    { key: "transfers", title: "Transfers", body: "Move money between your own accounts or send to a beneficiary." },
    { key: "transactions", title: "Transactions", body: "Search, filter, and export your full transaction history." },
    { key: "cards", title: "Cards", body: "View your cards, freeze or unfreeze them, or request a virtual card." },
    { key: "settings", title: "Settings", body: "Update your profile and avatar, change your password, and set notification preferences." },
  ],
  accounts: [
    { key: null, title: "Your accounts", body: "Every account you hold, with its balance." },
    { key: "accounts-grid", title: "Open an account", body: "Select a card to see its balance history and transactions." },
  ],
  beneficiaries: [
    { key: "beneficiaries-add", title: "Add a beneficiary", body: "Save the people and businesses you want to pay." },
    { key: "beneficiaries-list", title: "Manage beneficiaries", body: "Edit or remove saved beneficiaries here." },
  ],
  transfers: [
    { key: "transfers-mode", title: "Pick a transfer type", body: "Move money between your own accounts, or send to a beneficiary." },
    { key: "transfers-from", title: "Choose the source", body: "Select the account the money comes from." },
    { key: "transfers-amount", title: "Enter an amount", body: "It must be at or below the source account's balance." },
    { key: "transfers-send", title: "Send it", body: "Transfers post instantly and update your balances." },
  ],
  transactions: [
    { key: "transactions-filters", title: "Filter & search", body: "Narrow by account, type, category, date, or text." },
    { key: "transactions-export", title: "Export", body: "Download the filtered results as a CSV." },
    { key: "transactions-table", title: "Your history", body: "Transactions, newest first — use the pager to move through pages." },
  ],
  cards: [
    { key: "cards-request", title: "Request a card", body: "Create a virtual card for any account." },
    { key: "cards-manage", title: "Manage cards", body: "Freeze or unfreeze a card anytime." },
  ],
  settings: [
    { key: "settings-profile", title: "Profile", body: "Update your name, contact details, and photo." },
    { key: "settings-security", title: "Security", body: "Change your password here." },
    { key: "settings-notifications", title: "Notifications", body: "Choose what we notify you about." },
  ],
};

const PATH_TO_TOUR: Record<string, TourId> = {
  "/dashboard": "overview",
  "/dashboard/accounts": "accounts",
  "/dashboard/beneficiaries": "beneficiaries",
  "/dashboard/transfers": "transfers",
  "/dashboard/transactions": "transactions",
  "/dashboard/cards": "cards",
  "/dashboard/settings": "settings",
};

export function tourIdForPath(pathname: string): TourId | null {
  return PATH_TO_TOUR[pathname] ?? null;
}
```

- [ ] **Step 4: Run — expect PASS.** `npm run test`

- [ ] **Step 5: Commit**

```bash
git add lib/tour/registry.ts lib/tour/__tests__/registry.test.ts
git commit -m "feat(tour): tour registry + tourIdForPath (route -> tour mapping)"
```

---

## Phase 2 — Make the engine multi-tour & route-aware

### Task 2: Storage keys + provider + overlay refactor; remove `steps.ts`

**Files:**
- Modify: `lib/tour/storage.ts`, `components/dashboard/tour/tour-provider.tsx`, `components/dashboard/tour/tour-overlay.tsx`
- Delete: `lib/tour/steps.ts`

- [ ] **Step 1: Replace `lib/tour/storage.ts`** (keyed per tour; overview keeps the old key)

```ts
import type { TourId } from "@/lib/tour/registry";

export function seenKey(tourId: TourId): string {
  return tourId === "overview" ? "crest_tour_seen" : `crest_tour_${tourId}_seen`;
}

export function hasSeenTour(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markTourSeen(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* ignore (private mode / storage disabled) */
  }
}
```

- [ ] **Step 2: Replace `components/dashboard/tour/tour-provider.tsx`** (route-aware)

```tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { tours, tourIdForPath, type TourId } from "@/lib/tour/registry";
import { hasSeenTour, markTourSeen, seenKey } from "@/lib/tour/storage";
import { TourOverlay } from "@/components/dashboard/tour/tour-overlay";

type TourContextValue = { start: (tourId?: TourId) => void };

const TourContext = React.createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = React.useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeTourId, setActiveTourId] = React.useState<TourId | null>(null);
  const [stepIndex, setStepIndex] = React.useState(0);
  const autoStartedPath = React.useRef<string | null>(null);

  const start = React.useCallback(
    (tourId?: TourId) => {
      const id = tourId ?? tourIdForPath(pathname) ?? "overview";
      setStepIndex(0);
      setActiveTourId(id);
    },
    [pathname]
  );

  const end = React.useCallback(() => {
    setActiveTourId((current) => {
      if (current) markTourSeen(seenKey(current));
      return null;
    });
  }, []);

  // Auto-start the current route's tour once per navigation, if unseen.
  React.useEffect(() => {
    if (autoStartedPath.current === pathname) return;
    autoStartedPath.current = pathname;
    setActiveTourId(null); // cancel any active tour when navigating
    const id = tourIdForPath(pathname);
    if (!id || hasSeenTour(seenKey(id))) return;
    const t = setTimeout(() => {
      setStepIndex(0);
      setActiveTourId(id);
    }, 400);
    return () => clearTimeout(t);
  }, [pathname]);

  const steps = activeTourId ? tours[activeTourId] : null;

  return (
    <TourContext.Provider value={{ start }}>
      {children}
      {activeTourId && steps && (
        <TourOverlay
          steps={steps}
          stepIndex={stepIndex}
          onNext={() => setStepIndex((i) => Math.min(i + 1, steps.length - 1))}
          onBack={() => setStepIndex((i) => Math.max(i - 1, 0))}
          onClose={end}
        />
      )}
    </TourContext.Provider>
  );
}
```

- [ ] **Step 3: Replace `components/dashboard/tour/tour-overlay.tsx`** (takes `steps` prop; null-key → centered)

```tsx
"use client";

import * as React from "react";
import { X } from "lucide-react";
import { computeSpotlightLayout, type Rect, type SpotlightLayout } from "@/lib/tour/position";
import type { TourStep } from "@/lib/tour/registry";
import { Button } from "@/components/ui/button";

const TOOLTIP = { width: 320, height: 210 };

function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function TourOverlay({
  steps,
  stepIndex,
  onNext,
  onBack,
  onClose,
}: {
  steps: TourStep[];
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const step = steps[stepIndex];
  const total = steps.length;
  const isLast = stepIndex === total - 1;
  const isFirst = stepIndex === 0;

  const [layout, setLayout] = React.useState<SpotlightLayout | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const maskId = React.useId();

  const measure = React.useCallback(() => {
    const el = step.key ? document.querySelector(`[data-tour="${step.key}"]`) : null;
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
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx="12" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(8,21,43,0.6)" mask={`url(#${maskId})`} />
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
        aria-live="polite"
        aria-atomic="true"
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

- [ ] **Step 4: Delete the obsolete file**

```bash
git rm lib/tour/steps.ts
```
(`tour-launcher.tsx` is unchanged — `start()` with no arg now resolves to the current route's tour.)

- [ ] **Step 5: Verify** — Run `npx tsc --noEmit` (0 errors — confirms nothing still imports `@/lib/tour/steps`), `npm run lint` (0), `npm run test` (registry + position pass).

- [ ] **Step 6: Commit**

```bash
git add lib/tour/storage.ts components/dashboard/tour/tour-provider.tsx components/dashboard/tour/tour-overlay.tsx
git commit -m "feat(tour): route-aware provider + steps-prop overlay + per-tour storage keys"
```

---

## Phase 3 — Tag in-page targets

### Task 3: Add `data-tour` attributes

**Files (modify):** `app/dashboard/accounts/page.tsx`, `app/dashboard/beneficiaries/page.tsx`, `components/dashboard/transfer-form.tsx`, `components/dashboard/transactions-filters.tsx`, `app/dashboard/transactions/page.tsx`, `components/dashboard/cards-grid.tsx`, `app/dashboard/settings/page.tsx`

- [ ] **Step 1: Accounts grid** — in `app/dashboard/accounts/page.tsx`, add `data-tour="accounts-grid"` to the accounts grid div:
```tsx
        <div data-tour="accounts-grid" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
```

- [ ] **Step 2: Beneficiaries add + list** — in `app/dashboard/beneficiaries/page.tsx`:
  - Wrap the `<BeneficiaryForm trigger={...} />` in the header with a span:
```tsx
        <span data-tour="beneficiaries-add">
          <BeneficiaryForm
            trigger={
              <Button>
                <Plus className="mr-1.5 h-4 w-4" /> Add beneficiary
              </Button>
            }
          />
        </span>
```
  - Wrap the list render:
```tsx
      ) : (
        <div data-tour="beneficiaries-list">
          <BeneficiaryList beneficiaries={beneficiaries} />
        </div>
      )}
```

- [ ] **Step 3: Transfer form** — in `components/dashboard/transfer-form.tsx`:
  - Mode toggle div: `<div data-tour="transfers-mode" className="inline-flex rounded-xl border bg-muted p-1">`.
  - From-account wrapper `<div>` (the one whose label is "From account"): add `data-tour="transfers-from"`.
  - Amount wrapper `<div>` (label "Amount"): add `data-tour="transfers-amount"`.
  - The submit `<Button type="submit" ...>`: add `data-tour="transfers-send"`.

- [ ] **Step 4: Transactions filters** — in `components/dashboard/transactions-filters.tsx`, on the root returned `<div className="flex flex-wrap items-end gap-3">` add `data-tour="transactions-filters"`.

- [ ] **Step 5: Transactions export + table** — in `app/dashboard/transactions/page.tsx`:
  - Export link: add `data-tour="transactions-export"` to the `<a href={...}>` inside the Export button.
  - Wrap the table:
```tsx
          <div data-tour="transactions-table">
            <TransactionsTable rows={rows} />
          </div>
```

- [ ] **Step 6: Cards request + manage** — in `components/dashboard/cards-grid.tsx`:
  - Request `<Card>` (the one containing the account select + "Request virtual card"): add `data-tour="cards-request"`.
  - The cards grid `<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">`: add `data-tour="cards-manage"`.

- [ ] **Step 7: Settings sections** — in `app/dashboard/settings/page.tsx`, add to the three section `<Card>`s: `data-tour="settings-profile"` (Profile), `data-tour="settings-security"` (Security), `data-tour="settings-notifications"` (Notifications).

- [ ] **Step 8: Verify** — `npx tsc --noEmit` (0), `npm run lint` (0).

- [ ] **Step 9: Commit**

```bash
git add app/dashboard/accounts/page.tsx app/dashboard/beneficiaries/page.tsx components/dashboard/transfer-form.tsx components/dashboard/transactions-filters.tsx app/dashboard/transactions/page.tsx components/dashboard/cards-grid.tsx app/dashboard/settings/page.tsx
git commit -m "feat(tour): data-tour targets for per-page tutorials"
```

---

## Phase 4 — Docs & final verification

### Task 4: README + final gate

**Files:** Modify `README.md`

- [ ] **Step 1: Update the "Onboarding tour" note** to mention per-page tutorials: each dashboard
  page (accounts, beneficiaries, transfers, transactions, cards, settings) auto-runs its own
  spotlight tour on first visit, remembered separately (`crest_tour_<page>_seen`); the overview
  keeps the sidebar welcome tour; "Take the tour" replays the current page's tour.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: note per-page tutorials"
```

- [ ] **Step 3: Final gate** — Run `npm run test` (all pass), `npx tsc --noEmit` (0), `npm run lint` (0), `npm run build` (succeeds; dashboard routes compile). Retry build once on a fonts socket error; `dangerouslyDisableSandbox: true` if sandbox blocks npm.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore(tour): per-page verification fixes"
```

---

## Self-Review Notes (coverage vs spec)

- §2/§3 registry (`tours` + `tourIdForPath`) → Task 1. ✓
- §4 storage keys (per-tour, overview back-compat) → Task 2. ✓
- §5 route-aware provider (auto-start once per nav, cancel-on-navigate, context start) → Task 2. ✓
- §6 overlay steps-prop + null-key centered → Task 2. ✓
- §7 data-tour targets (all 6 pages) → Task 3. ✓
- §8 edge cases (empty/mobile centered via existing fallback; SSR guards) → Tasks 1–3. ✓
- §10 testing (`tourIdForPath` unit; manual) → Tasks 1,4. ✓
- §11 acceptance criteria → Task 4 gate + manual. ✓

**Type consistency:** `TourId`/`TourStep`/`tours`/`tourIdForPath` from `registry.ts` (Task 1) consumed by storage `seenKey` (Task 2), provider, and overlay (`TourStep` import) (Task 2). Provider passes `steps={tours[activeTourId]}` to overlay whose prop is `steps: TourStep[]` (Task 2). `start(tourId?: TourId)` is back-compatible with the launcher's `start()` call (unchanged). `seenKey(tourId)` returns the overview's legacy `crest_tour_seen`. `data-tour` keys in Task 3 exactly match the non-null `key`s in `tours` (Task 1): `accounts-grid`, `beneficiaries-add/-list`, `transfers-mode/-from/-amount/-send`, `transactions-filters/-export/-table`, `cards-request/-manage`, `settings-profile/-security/-notifications`. `steps.ts` deletion (Task 2) is safe — only the overlay/provider imported it, both rewritten.
