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

  React.useEffect(() => {
    if (autoStartedPath.current === pathname) return;
    autoStartedPath.current = pathname;
    setActiveTourId(null);
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
