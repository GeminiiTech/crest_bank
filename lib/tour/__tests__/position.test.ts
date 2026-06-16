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
    expect(l.tooltip.top).toBe(152);
    expect(l.tooltip.left).toBe(50);
    expect(l.hole).toEqual({ top: 92, left: 42, width: 216, height: 56 });
  });

  it("flips above when there is no room below", () => {
    const target: Rect = { top: 700, left: 50, width: 200, height: 40 };
    const l = computeSpotlightLayout(target, tooltip, viewport, { gap: 12 });
    expect(l.placement).toBe("above");
    expect(l.tooltip.top).toBe(538);
  });

  it("clamps the tooltip horizontally within the viewport", () => {
    const target: Rect = { top: 100, left: 950, width: 40, height: 40 };
    const l = computeSpotlightLayout(target, tooltip, viewport, { margin: 8 });
    expect(l.tooltip.left).toBe(692);
  });
});
