import { describe, it, expect } from "vitest";
import { formatCurrency, maskAccountNumber, formatTxnDate } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats USD with two decimals and grouping", () => {
    expect(formatCurrency(48250)).toBe("$48,250.00");
    expect(formatCurrency(12450.75)).toBe("$12,450.75");
  });
  it("formats negatives", () => {
    expect(formatCurrency(-129)).toBe("-$129.00");
  });
});

describe("maskAccountNumber", () => {
  it("shows only the last 4 digits", () => {
    expect(maskAccountNumber("100000004921")).toBe("•••• 4921");
  });
});

describe("formatTxnDate", () => {
  it("formats an ISO date as a short, UTC-stable string", () => {
    expect(formatTxnDate("2026-06-12T10:00:00.000Z")).toBe("Jun 12, 2026");
  });
});
