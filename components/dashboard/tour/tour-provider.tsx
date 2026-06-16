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
