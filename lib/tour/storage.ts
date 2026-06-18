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
