import { describe, it, expect } from "vitest";
import { parseTransactionQuery } from "@/lib/transactions/filters";

describe("parseTransactionQuery", () => {
  it("applies defaults", () => {
    expect(parseTransactionQuery({})).toMatchObject({ page: 1, pageSize: 20 });
  });
  it("clamps pageSize to 100 and page to >= 1", () => {
    expect(parseTransactionQuery({ page: "0", pageSize: "999" })).toMatchObject({ page: 1, pageSize: 100 });
  });
  it("parses valid type, ignores invalid", () => {
    expect(parseTransactionQuery({ type: "debit" }).type).toBe("debit");
    expect(parseTransactionQuery({ type: "weird" }).type).toBeUndefined();
  });
  it("trims search and validates dates", () => {
    const q = parseTransactionQuery({ search: "  coffee  ", from: "2026-06-01", to: "bad" });
    expect(q.search).toBe("coffee");
    expect(q.from).toBe("2026-06-01");
    expect(q.to).toBeUndefined();
  });
});
