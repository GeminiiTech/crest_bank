import { describe, it, expect } from "vitest";
import { buildCard, nextCardStatus } from "@/lib/cards";

const now = new Date("2026-06-13T00:00:00.000Z");

describe("buildCard", () => {
  it("derives a 4-digit last4 and valid expiry from the seed", () => {
    const c = buildCard(1234, { now });
    expect(c.last4).toBe("1234");
    expect(c.exp_month).toBeGreaterThanOrEqual(1);
    expect(c.exp_month).toBeLessThanOrEqual(12);
    expect(c.exp_year).toBe(2029);
    expect(c.type).toBe("debit");
    expect(c.is_virtual).toBe(false);
    expect(c.status).toBe("active");
    expect(c.brand).toBe("Visa");
  });
  it("pads short last4 and honors options", () => {
    const c = buildCard(5, { type: "credit", isVirtual: true, now });
    expect(c.last4).toBe("0005");
    expect(c.type).toBe("credit");
    expect(c.is_virtual).toBe(true);
  });
});

describe("nextCardStatus", () => {
  it("toggles active/frozen and recovers from cancelled", () => {
    expect(nextCardStatus("active")).toBe("frozen");
    expect(nextCardStatus("frozen")).toBe("active");
    expect(nextCardStatus("cancelled")).toBe("active");
  });
});
