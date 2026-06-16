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
