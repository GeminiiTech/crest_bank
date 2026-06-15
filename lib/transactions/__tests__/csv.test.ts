import { describe, it, expect } from "vitest";
import { toCsv, type CsvRow } from "@/lib/transactions/csv";

const row: CsvRow = {
  created_at: "2026-06-12T10:00:00.000Z",
  description: "Coffee, large",
  category: "Dining",
  type: "debit",
  amount: 4.5,
  currency: "USD",
  status: "completed",
  counterparty: "Blue Bottle",
};

describe("toCsv", () => {
  it("returns only headers for an empty list", () => {
    expect(toCsv([])).toBe("Date,Description,Category,Type,Amount,Currency,Status");
  });
  it("escapes commas and quotes and signs debits negative", () => {
    const out = toCsv([row]).split("\n");
    expect(out[0]).toBe("Date,Description,Category,Type,Amount,Currency,Status");
    expect(out[1]).toContain('"Coffee, large"');
    expect(out[1]).toContain("-4.50");
  });
  it("escapes embedded quotes by doubling", () => {
    const out = toCsv([{ ...row, description: 'He said "hi"' }]).split("\n")[1];
    expect(out).toContain('"He said ""hi"""');
  });
});
