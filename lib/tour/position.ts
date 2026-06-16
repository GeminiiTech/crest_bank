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
