# Crest Bank — New-User Onboarding Tour — Design Spec

**Date:** 2026-06-16
**Status:** Approved for spec review
**Author:** Engineering (with Kene)
**Builds on:** the completed M1–M5 dashboard.

---

## 1. Goal

Help first-time users learn the app with a **spotlight coachmark tour** of the dashboard
sidebar. It auto-starts on a new user's first dashboard visit, can be **skipped** at any time,
remembers that it's been seen, and can be **replayed** from a "Take the tour" button.

### Confirmed decisions
- **Style:** spotlight coachmarks — dim the screen, highlight one real sidebar item at a time
  with a tooltip card.
- **Where/when:** auto-start on the first dashboard load only.
- **Persistence:** a `localStorage` flag (`crest_tour_seen`). No DB, no migration.
- **Replay:** a "Take the tour" button in the dashboard topbar re-opens it anytime.
- **Skip:** a Skip control (and Esc) ends and marks it seen.

### Out of scope
- A tour of the public marketing pages.
- Server/cross-device persistence (localStorage is per-device by design).
- KYC/role-specific tours.

---

## 2. Architecture

```
lib/tour/steps.ts            # step list: { key, title, body } (key matches a data-tour attr)
lib/tour/position.ts         # PURE: computeSpotlightLayout(target, tooltip, viewport) -> layout
components/dashboard/tour/
  tour-provider.tsx          # client context: start()/active state; auto-start via localStorage; renders overlay
  tour-overlay.tsx           # client: dimmer + spotlight hole + tooltip + controls; rect tracking
  tour-launcher.tsx          # client: "Take the tour" button -> useTour().start()
app/dashboard/layout.tsx     # wrap the shell in <TourProvider>
components/dashboard/sidebar.tsx   # add data-tour="<key>" to each nav link
components/dashboard/topbar.tsx    # render <TourLauncher/>
lib/tour/storage.ts          # tiny helpers: hasSeenTour()/markTourSeen() (localStorage, SSR-safe)
```

### Boundaries
- **Pure layer** (`steps.ts` data, `position.ts`): no DOM/I/O; `position.ts` is unit-tested.
- **Storage** (`storage.ts`): SSR-safe `localStorage` access (guards `typeof window`).
- **Provider** (`tour-provider.tsx`): owns tour state (`active`, `stepIndex`), exposes
  `start()`/`next()`/`back()`/`skip()`/`finish()` via context; auto-starts on mount if unseen.
- **Overlay** (`tour-overlay.tsx`): pure presentation of the current step — reads the target
  element by `data-tour`, computes layout via `computeSpotlightLayout`, renders dimmer + hole +
  tooltip. Re-measures on resize/scroll and when the step changes.
- **Launcher** (`tour-launcher.tsx`): a button that calls `start()`.

---

## 3. Pure logic (`lib/tour/position.ts`)

```
type Rect = { top: number; left: number; width: number; height: number };
type Size = { width: number; height: number };
type Viewport = { width: number; height: number };
type Layout = {
  hole: Rect | null;              // null => no spotlight (target missing/hidden) -> centered tooltip
  tooltip: { top: number; left: number };
  placement: "below" | "above" | "center";
};

computeSpotlightLayout(target: Rect | null, tooltip: Size, viewport: Viewport, opts?: { gap?: number; pad?: number }): Layout
```

Rules (pure, deterministic):
- **No/zero-size target** (`!target || width===0 || height===0`) → `placement: "center"`, `hole: null`,
  tooltip centered in the viewport.
- Else `hole` = target expanded by `pad` (default 8) on each side.
- Prefer **below** the target (`top = target.bottom + gap`); if it would overflow the viewport
  bottom, place **above** (`top = target.top - gap - tooltip.height`).
- Horizontally align the tooltip's left to the target's left, then **clamp** to
  `[8, viewport.width - tooltip.width - 8]`. Vertically clamp top to `[8, viewport.height - tooltip.height - 8]`.

Unit-tested: centered fallback on null/zero target; below vs above flip near the bottom edge;
horizontal/vertical clamping at edges.

---

## 4. Steps (`lib/tour/steps.ts`)

Ordered steps, each `{ key, title, body }` where `key` matches a sidebar link's `data-tour`:
- `dashboard` — "Your dashboard" — overview of balances, spending, and recent activity.
- `accounts` — "Accounts" — view each account and its balance history.
- `beneficiaries` — "Beneficiaries" — save people/businesses to pay.
- `transfers` — "Transfers" — move money between your accounts or to a beneficiary.
- `transactions` — "Transactions" — search, filter, and export your history.
- `cards` — "Cards" — view, freeze, or request virtual cards.
- `settings` — "Settings" — profile, security, and notification preferences.

(7 steps — the enabled nav items. A trailing "You're all set" message shows on the last step's
Finish button copy rather than a separate empty step.)

---

## 5. Behavior / data flow

1. `TourProvider` mounts in the dashboard layout. In a `useEffect`, if `!hasSeenTour()`, it calls
   `start()` (after a short delay so the sidebar has painted).
2. `start()` sets `active = true`, `stepIndex = 0`. `TourOverlay` renders.
3. Overlay finds `document.querySelector('[data-tour="<key>"]')` for the current step, measures it,
   computes layout, and paints the dimmer + hole + tooltip. It scrolls the target into view first.
   It re-measures on `resize`/`scroll` (passive) and whenever `stepIndex` changes.
4. **Next** → `stepIndex++` (or **finish** on the last). **Back** → `stepIndex--` (disabled on first).
   **Skip ✕** / **Esc** → end immediately.
5. `finish()`/`skip()` set `active = false` and call `markTourSeen()` (localStorage).
6. **Take the tour** button calls `start()` regardless of the seen flag (does not clear it).

---

## 6. UI / UX

- **Dimmer:** a fixed full-screen layer at a high z-index (above the sidebar/topbar) using a
  4-rect "frame" around the hole (or a single layer with a transparent cutout); the hole shows a
  subtle ring in the brand azure. Clicking the dimmer does nothing destructive (no accidental
  dismiss); only Skip/Esc end it.
- **Tooltip card:** rounded card (existing tokens), step title, body, a "Step N of M" indicator,
  and Back / Next (or Finish) buttons + a Skip (✕) in the corner.
- **Launcher:** a ghost icon button (help/compass icon) in the topbar with an accessible label
  "Take the tour".
- **Reduced motion:** transitions disabled when `prefers-reduced-motion`.
- **Z-index:** above the topbar (which is `z-30`) and mobile sheet; e.g. `z-[60]`.

---

## 7. Error handling / edge cases

- **Target not found / hidden (mobile):** `computeSpotlightLayout` returns a centered, hole-less
  layout so the step still shows readable text.
- **localStorage unavailable** (privacy mode): `hasSeenTour()` returns `false` and
  `markTourSeen()` no-ops inside try/catch — the tour simply shows each session; never throws.
- **Window resize / sidebar collapse mid-tour:** re-measure keeps the spotlight aligned (or
  falls back to centered if the target becomes hidden).
- **SSR:** all `window`/`document`/`localStorage` access is inside effects or guarded; the
  provider renders nothing tour-related during SSR.

---

## 8. Security / performance

- No data access, no auth, no network — purely client-side UI. No security surface.
- Listeners are `passive` and removed on unmount/step change; measurement is cheap
  (`getBoundingClientRect`). No effect on the static marketing pages (tour lives only in the
  dashboard shell).

---

## 9. Testing

- **Unit (Vitest):** `computeSpotlightLayout` — centered fallback (null + zero-size), below→above
  flip near bottom edge, horizontal clamp at left/right edges, vertical clamp.
- **Manual:** fresh browser → first dashboard visit auto-starts the tour; Next/Back move the
  spotlight across sidebar items; Skip and Esc end it; reload → no auto-show; "Take the tour"
  replays; shrink to mobile width → tooltip centers gracefully; keyboard-only operation works.

---

## 10. Acceptance criteria

1. On a first dashboard visit (no `crest_tour_seen`), the spotlight tour auto-starts on step 1.
2. Next/Back navigate steps; the spotlight highlights the matching sidebar item; the counter is correct.
3. Skip (✕) and Esc end the tour immediately; Finish ends it on the last step.
4. After finishing/skipping, reloading the dashboard does **not** auto-show the tour.
5. "Take the tour" in the topbar re-opens it at any time.
6. On a narrow (mobile) viewport, steps still display (centered) without errors.
7. `npm run build`, `npm run lint`, `npx tsc --noEmit` pass; unit tests for `computeSpotlightLayout` pass.

---

## 11. Risks / open items

- **Spotlight is desktop-first** (sidebar hidden on mobile) — mitigated by the centered fallback;
  acceptable for this app.
- **localStorage is per-device** — re-shows in a new browser; this is the chosen, documented behavior.
- Positioning math is the main complexity — isolated in a pure, unit-tested function to keep the
  overlay component simple.
