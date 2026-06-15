import { describe, it, expect } from "vitest";
import { buildDemoAccounts, buildDemoTransactions, buildDemoNotifications } from "@/lib/demo/seed-data";

const now = new Date("2026-06-15T00:00:00.000Z");

describe("buildDemoAccounts", () => {
  it("returns a checking + savings account with positive balances and distinct numbers", () => {
    const accts = buildDemoAccounts(123);
    expect(accts).toHaveLength(2);
    expect(accts.map((a) => a.type).sort()).toEqual(["checking", "savings"]);
    expect(accts[0].account_number).not.toBe(accts[1].account_number);
    expect(accts.every((a) => a.balance > 0 && a.status === "active")).toBe(true);
  });
});

describe("buildDemoTransactions", () => {
  it("checking profile yields many dated debit+credit txns within 60 days", () => {
    const txns = buildDemoTransactions({ now, profile: "checking" });
    expect(txns.length).toBeGreaterThanOrEqual(20);
    expect(txns.some((t) => t.type === "credit")).toBe(true);
    expect(txns.some((t) => t.type === "debit")).toBe(true);
    const sixtyDaysAgo = now.getTime() - 60 * 24 * 60 * 60 * 1000;
    expect(txns.every((t) => new Date(t.created_at).getTime() >= sixtyDaysAgo)).toBe(true);
    expect(txns.every((t) => new Date(t.created_at).getTime() <= now.getTime())).toBe(true);
  });
  it("savings profile yields a smaller set", () => {
    const txns = buildDemoTransactions({ now, profile: "savings" });
    expect(txns.length).toBeGreaterThanOrEqual(3);
    expect(txns.length).toBeLessThan(12);
  });
});

describe("buildDemoNotifications", () => {
  it("returns notifications owned by the user", () => {
    const ns = buildDemoNotifications("user-1");
    expect(ns.length).toBeGreaterThanOrEqual(3);
    expect(ns.every((n) => n.user_id === "user-1" && n.title.length > 0)).toBe(true);
  });
});
