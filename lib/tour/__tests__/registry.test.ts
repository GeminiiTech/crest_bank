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
