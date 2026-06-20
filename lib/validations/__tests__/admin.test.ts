import { describe, it, expect } from "vitest";
import { adminProfileSchema, adminBalanceSchema, adminTransactionSchema } from "@/lib/validations/admin";

describe("adminProfileSchema", () => {
  it("accepts a valid profile", () => {
    expect(adminProfileSchema.safeParse({ full_name: "Ada", kyc_status: "verified" }).success).toBe(true);
  });
  it("rejects a bad kyc status", () => {
    expect(adminProfileSchema.safeParse({ full_name: "Ada", kyc_status: "nope" }).success).toBe(false);
  });
});

describe("adminBalanceSchema", () => {
  it("coerces a numeric string and rejects negatives", () => {
    const r = adminBalanceSchema.safeParse({ balance: "250.50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.balance).toBe(250.5);
    expect(adminBalanceSchema.safeParse({ balance: "-1" }).success).toBe(false);
  });
});

describe("adminTransactionSchema", () => {
  it("accepts a valid transaction", () => {
    expect(adminTransactionSchema.safeParse({ type: "credit", category: "Adjustment", amount: "10" }).success).toBe(true);
  });
  it("rejects amount <= 0 and bad type", () => {
    expect(adminTransactionSchema.safeParse({ type: "credit", category: "x", amount: "0" }).success).toBe(false);
    expect(adminTransactionSchema.safeParse({ type: "weird", category: "x", amount: "5" }).success).toBe(false);
  });
});
