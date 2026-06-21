import { describe, it, expect } from "vitest";
import { toCreatedAtISO } from "@/lib/admin/dates";

describe("toCreatedAtISO", () => {
  it("converts a valid date to midnight UTC ISO", () => {
    expect(toCreatedAtISO("2026-06-21")).toBe("2026-06-21T00:00:00.000Z");
  });
  it("rejects a bad format", () => {
    expect(toCreatedAtISO("06/21/2026")).toBeNull();
    expect(toCreatedAtISO("2026-6-1")).toBeNull();
    expect(toCreatedAtISO("")).toBeNull();
  });
  it("rejects impossible dates (no silent rollover)", () => {
    expect(toCreatedAtISO("2026-13-40")).toBeNull();
    expect(toCreatedAtISO("2026-02-30")).toBeNull();
  });
});
