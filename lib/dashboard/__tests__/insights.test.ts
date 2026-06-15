import { describe, it, expect } from "vitest";
import { summarizeSpending, computeInsights, deriveBalanceHistory, type TxnLike } from "@/lib/dashboard/insights";

const now = new Date("2026-06-15T00:00:00.000Z");
const txns: TxnLike[] = [
  { type: "credit", category: "Salary", amount: 5000, created_at: "2026-06-01T00:00:00.000Z" },
  { type: "debit", category: "Groceries", amount: 200, created_at: "2026-06-05T00:00:00.000Z" },
  { type: "debit", category: "Groceries", amount: 100, created_at: "2026-06-10T00:00:00.000Z" },
  { type: "debit", category: "Dining", amount: 150, created_at: "2026-06-12T00:00:00.000Z" },
  { type: "debit", category: "Old", amount: 999, created_at: "2026-04-01T00:00:00.000Z" },
];

describe("summarizeSpending", () => {
  it("groups current-month debits by category, sorted desc", () => {
    expect(summarizeSpending(txns, { now })).toEqual([
      { category: "Groceries", total: 300 },
      { category: "Dining", total: 150 },
    ]);
  });
});

describe("computeInsights", () => {
  it("computes balances, income, spending, net, savings rate, top category", () => {
    const r = computeInsights([{ balance: 1000 }, { balance: 500 }], txns, { now });
    expect(r.totalBalance).toBe(1500);
    expect(r.monthIncome).toBe(5000);
    expect(r.monthSpending).toBe(450);
    expect(r.netCashFlow).toBe(4550);
    expect(r.savingsRate).toBeCloseTo(0.91, 2);
    expect(r.topCategory).toBe("Groceries");
  });
  it("handles zero income without dividing by zero", () => {
    const r = computeInsights([], [], { now });
    expect(r.savingsRate).toBe(0);
    expect(r.topCategory).toBeNull();
  });
});

describe("deriveBalanceHistory", () => {
  it("reconstructs ascending per-day balances ending at the current balance", () => {
    const series = deriveBalanceHistory(1000, [
      { type: "credit", category: "x", amount: 200, created_at: "2026-06-10T00:00:00.000Z" },
      { type: "debit", category: "y", amount: 50, created_at: "2026-06-12T00:00:00.000Z" },
    ]);
    expect(series).toEqual([
      { date: "2026-06-10", balance: 1050 },
      { date: "2026-06-12", balance: 1000 },
    ]);
  });
  it("returns a single current point when there are no transactions", () => {
    const series = deriveBalanceHistory(500, [], { now });
    expect(series).toEqual([{ date: "2026-06-15", balance: 500 }]);
  });
});
