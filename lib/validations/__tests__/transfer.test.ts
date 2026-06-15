import { describe, it, expect } from "vitest";
import { transferSchema } from "@/lib/validations/transfer";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

describe("transferSchema", () => {
  it("accepts a valid internal transfer", () => {
    const r = transferSchema.safeParse({ mode: "internal", fromAccountId: A, toAccountId: B, amount: "100.50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(100.5);
  });
  it("rejects internal transfer to the same account", () => {
    expect(transferSchema.safeParse({ mode: "internal", fromAccountId: A, toAccountId: A, amount: "10" }).success).toBe(false);
  });
  it("accepts a valid external transfer", () => {
    expect(transferSchema.safeParse({ mode: "external", fromAccountId: A, beneficiaryId: B, amount: "25" }).success).toBe(true);
  });
  it("rejects a non-positive amount", () => {
    expect(transferSchema.safeParse({ mode: "internal", fromAccountId: A, toAccountId: B, amount: "0" }).success).toBe(false);
  });
  it("rejects a non-numeric amount", () => {
    expect(transferSchema.safeParse({ mode: "internal", fromAccountId: A, toAccountId: B, amount: "abc" }).success).toBe(false);
  });
  it("rejects external transfer without beneficiary", () => {
    expect(transferSchema.safeParse({ mode: "external", fromAccountId: A, amount: "25" }).success).toBe(false);
  });
});
