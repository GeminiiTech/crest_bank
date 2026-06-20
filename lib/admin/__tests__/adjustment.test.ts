import { describe, it, expect } from "vitest";
import { computeBalanceAdjustment, signedDelta } from "@/lib/admin/adjustment";

describe("computeBalanceAdjustment", () => {
  it("returns a credit when the balance increases", () => {
    expect(computeBalanceAdjustment(100, 150)).toEqual({ type: "credit", amount: 50 });
  });
  it("returns a debit when the balance decreases", () => {
    expect(computeBalanceAdjustment(150, 100)).toEqual({ type: "debit", amount: 50 });
  });
  it("returns null when unchanged", () => {
    expect(computeBalanceAdjustment(100, 100)).toBeNull();
  });
  it("handles fractional differences cleanly", () => {
    expect(computeBalanceAdjustment(100, 100.25)).toEqual({ type: "credit", amount: 0.25 });
  });
});

describe("signedDelta", () => {
  it("credit is positive, debit is negative", () => {
    expect(signedDelta("credit", 10)).toBe(10);
    expect(signedDelta("debit", 10)).toBe(-10);
  });
});
