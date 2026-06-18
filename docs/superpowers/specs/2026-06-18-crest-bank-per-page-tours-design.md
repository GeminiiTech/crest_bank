# Crest Bank — Per-Page Tutorials — Design Spec

**Date:** 2026-06-18
**Status:** Approved for spec review
**Author:** Engineering (with Kene)
**Builds on:** the onboarding tour (spotlight engine, `lib/tour/*`, `components/dashboard/tour/*`).

---

## 1. Goal

Give each dashboard page its own **first-visit spotlight tutorial** (Accounts, Beneficiaries,
Transfers, Transactions, Cards, Settings), reusing the existing tour engine. Each page tour
auto-runs once, is remembered separately, is skippable, and is replayable from the topbar
"Take the tour" button (which becomes context-aware). The Dashboard **overview keeps its
existing sidebar welcome tour** (no second tour fires there).

### Confirmed decisions
- **Pages with their own tour:** accounts, beneficiaries, transfers, transactions, cards,
  settings. (Overview = the existing sidebar tour; account detail = no tour.)
- **Style:** spotlight on real page controls (reusing `computeSpotlightLayout` + overlay).
- **Trigger:** auto-run on first visit to each page; per-page `localStorage` memory; skippable.
- **Replay:** the topbar button replays the **current page's** tour (overview → sidebar tour).

### Out of scope
- Tours for public marketing pages or the account-detail page.
- Server/cross-device persistence (localStorage stays, per-device).

---

## 2. Architecture (generalize the existing engine)

```
lib/tour/registry.ts   # NEW: TourStep type + `tours: Record<TourId, TourStep[]>` (overview + 6 pages)
                       #      + PURE `tourIdForPath(pathname): TourId | null`
lib/tour/steps.ts      # REMOVED — its overview steps move into registry as tours.overview
lib/tour/storage.ts    # generalize: hasSeenTour(key)/markTourSeen(key); add seenKey(tourId)
components/dashboard/tour/
  tour-provider.tsx    # route-aware via usePathname: auto-start the route's tour on first visit;
                       #   state { activeTourId, stepIndex }; start(tourId?) defaults to current route
  tour-overlay.tsx     # accept `steps: TourStep[]` as a prop (no longer imports a single global list)
  tour-launcher.tsx    # unchanged behavior (calls start()); now replays the current page's tour
```
Pages/components gain `data-tour` attributes on key elements (namespaced per page).

`computeSpotlightLayout` (pure, already unit-tested) and the overlay's dimmer/hole/tooltip
rendering are reused unchanged.

### Boundaries
- **Pure** (`registry.ts`): tour data + `tourIdForPath` (no DOM/I/O) — unit-tested.
- **Storage** (`storage.ts`): SSR-safe, per-key localStorage (unchanged guards).
- **Provider**: owns which tour is active and the step index; auto-starts on route change.
- **Overlay**: pure presentation of a given `steps` array + current index (unchanged logic).

---

## 3. Tour registry (`lib/tour/registry.ts`)

```ts
export type TourStep = { key: string | null; title: string; body: string };  // key=null => centered step
export type TourId = "overview" | "accounts" | "beneficiaries" | "transfers" | "transactions" | "cards" | "settings";
export const tours: Record<TourId, TourStep[]> = { ... };
export function tourIdForPath(pathname: string): TourId | null { ... }
```

`tourIdForPath` mapping (exact match):
- `/dashboard` → `overview`
- `/dashboard/accounts` → `accounts`
- `/dashboard/beneficiaries` → `beneficiaries`
- `/dashboard/transfers` → `transfers`
- `/dashboard/transactions` → `transactions`
- `/dashboard/cards` → `cards`
- `/dashboard/settings` → `settings`
- anything else (e.g. `/dashboard/accounts/<id>`) → `null`

> Note: `TourStep.key` becomes `string | null` (null = a centered, target-less step). The overlay
> already centers when a target is missing; `null` makes "no target" explicit for intro steps.

### Steps per tour
- **overview** (existing 7 sidebar steps, unchanged: dashboard…settings keys).
- **accounts:**
  - `{ key: null, title: "Your accounts", body: "Every account you hold, with its balance." }`
  - `{ key: "accounts-grid", title: "Open an account", body: "Select a card to see its balance history and transactions." }`
- **beneficiaries:**
  - `{ key: "beneficiaries-add", title: "Add a beneficiary", body: "Save the people and businesses you want to pay." }`
  - `{ key: "beneficiaries-list", title: "Manage beneficiaries", body: "Edit or remove saved beneficiaries here." }`
- **transfers:**
  - `{ key: "transfers-mode", title: "Pick a transfer type", body: "Move money between your own accounts, or send to a beneficiary." }`
  - `{ key: "transfers-from", title: "Choose the source", body: "Select the account the money comes from." }`
  - `{ key: "transfers-amount", title: "Enter an amount", body: "It must be at or below the source account's balance." }`
  - `{ key: "transfers-send", title: "Send it", body: "Transfers post instantly and update your balances." }`
- **transactions:**
  - `{ key: "transactions-filters", title: "Filter & search", body: "Narrow by account, type, category, date, or text." }`
  - `{ key: "transactions-export", title: "Export", body: "Download the filtered results as a CSV." }`
  - `{ key: "transactions-table", title: "Your history", body: "Transactions, newest first — use the pager to move through pages." }`
- **cards:**
  - `{ key: "cards-request", title: "Request a card", body: "Create a virtual card for any account." }`
  - `{ key: "cards-manage", title: "Manage cards", body: "Freeze or unfreeze a card anytime." }`
- **settings:**
  - `{ key: "settings-profile", title: "Profile", body: "Update your name, contact details, and photo." }`
  - `{ key: "settings-security", title: "Security", body: "Change your password here." }`
  - `{ key: "settings-notifications", title: "Notifications", body: "Choose what we notify you about." }`

Page step keys are namespaced (`accounts-…`, `transfers-…`, etc.) so they never collide with the
sidebar nav's `data-tour` keys (`accounts`, `transfers`, …).

---

## 4. Storage (`lib/tour/storage.ts`)

Generalized to a key parameter:
```ts
export function hasSeenTour(key: string): boolean
export function markTourSeen(key: string): void
export function seenKey(tourId: TourId): string  // "crest_tour_seen" for overview; else `crest_tour_${id}_seen`
```
- **Overview keeps `crest_tour_seen`** (back-compat: anyone who dismissed the original tour isn't re-shown).
- SSR guard + try/catch unchanged (returns `true` on SSR; never throws).

---

## 5. Provider behavior (`tour-provider.tsx`)

- State: `activeTourId: TourId | null`, `stepIndex: number`.
- `usePathname()` drives auto-start. An effect keyed on `pathname`:
  - compute `id = tourIdForPath(pathname)`; if `id` and `!hasSeenTour(seenKey(id))`, start it
    (after ~400 ms so the page has painted). If a tour is currently active, navigating cancels it
    first (set inactive) before evaluating the new route.
- `start(tourId?)`: starts `tourId ?? tourIdForPath(pathname) ?? "overview"` at step 0.
- `end()`: clears `activeTourId` and calls `markTourSeen(seenKey(endedId))`.
- Renders `<TourOverlay steps={tours[activeTourId]} stepIndex … onNext/onBack/onClose />` when active.
- Context exposes `start`. Provider lives at the dashboard layout root (already wired).

Guard against double auto-start (e.g. effect re-runs): track the last auto-started path in a ref
so we don't restart the same page's tour on every render — only when the path actually changes.

---

## 6. Overlay change (`tour-overlay.tsx`)

- Accept `steps: TourStep[]` as a prop; derive `step = steps[stepIndex]`, `total = steps.length`.
- `measure()` only queries a target when `step.key` is non-null; for `key === null` it passes
  `null` to `computeSpotlightLayout` → centered, hole-less (intro step). Everything else
  (dimmer, ring, controls, Esc, aria-live, resize/scroll re-measure) unchanged.

---

## 7. `data-tour` targets to add (in-page)

| Page / file | element | `data-tour` |
|---|---|---|
| `app/dashboard/accounts/page.tsx` | the accounts grid container | `accounts-grid` |
| `app/dashboard/beneficiaries/page.tsx` | the "Add beneficiary" button wrapper | `beneficiaries-add` |
| `components/dashboard/beneficiary-list.tsx` (or page list wrapper) | the list grid | `beneficiaries-list` |
| `components/dashboard/transfer-form.tsx` | mode toggle, from-select, amount input, submit | `transfers-mode`, `transfers-from`, `transfers-amount`, `transfers-send` |
| `components/dashboard/transactions-filters.tsx` | the filter bar root | `transactions-filters` |
| `app/dashboard/transactions/page.tsx` | the Export CSV button, the table card | `transactions-export`, `transactions-table` |
| `components/dashboard/cards-grid.tsx` | the request-card card, the first card's controls | `cards-request`, `cards-manage` |
| `app/dashboard/settings/page.tsx` | the three section `Card`s | `settings-profile`, `settings-security`, `settings-notifications` |

Attributes are plain DOM attributes (fine on server components). Where the natural target is a
shared component used in multiple spots, the attribute goes on the page-level wrapper to keep it
unambiguous (single match for `querySelector`).

---

## 8. Edge cases / error handling

- **Empty states** (no accounts/cards/beneficiaries): the targeted element may be absent →
  the step centers gracefully (existing behavior). Tours still run and are marked seen.
- **Mobile:** in-page elements are present (pages are single-column), so spotlights work; any
  hidden target centers.
- **Rapid navigation:** the last-auto-started-path ref + cancel-on-navigate prevents overlapping
  tours; only one tour is active at a time.
- **localStorage unavailable:** `hasSeenTour` returns false (shows each session), never throws.
- **SSR:** unchanged guards; provider renders no overlay during SSR.

---

## 9. Security / performance

- No data, auth, or network — pure client UI. No new security surface.
- Listeners remain passive and cleaned up; one overlay at a time; negligible cost.

---

## 10. Testing

- **Unit (Vitest):** `tourIdForPath` — each of the 7 routes maps to the right id; unknown routes
  and `/dashboard/accounts/<id>` → `null`. (`computeSpotlightLayout` stays covered.)
- **Manual:** first visit to each of the 6 pages auto-runs its tour; Next/Back/Skip/Esc work;
  revisiting a page does not re-show; "Take the tour" replays the current page's tour; the
  overview still shows the sidebar tour (and only once); mobile centers gracefully.

---

## 11. Acceptance criteria

1. Visiting `/dashboard/cards`, `/dashboard/beneficiaries`, `/dashboard/transfers`,
   `/dashboard/transactions`, `/dashboard/accounts`, `/dashboard/settings` for the first time
   auto-runs that page's spotlight tour.
2. Each page's tour spotlights that page's real controls per the registry; Next/Back/Skip/Esc work.
3. Revisiting a page after finishing/skipping does not re-show its tour (per-page localStorage).
4. The topbar "Take the tour" replays the current page's tour; on the overview it replays the
   sidebar tour.
5. The overview's existing sidebar tour is unchanged and still only auto-shows once.
6. `npm run build`, `npm run lint`, `npx tsc --noEmit` pass; unit tests (`tourIdForPath`,
   `computeSpotlightLayout`) pass.

---

## 12. Risks / open items

- **Target stability:** page tours depend on `data-tour` attributes staying on the right
  elements; keep them on stable page-level wrappers. Centering fallback prevents breakage if a
  target is missing.
- **`steps.ts` removal:** the overlay/provider must switch to the registry; a quick grep ensures
  no remaining import of the old `tourSteps`.
- Per-device persistence and the no-tour account-detail page are intentional.
