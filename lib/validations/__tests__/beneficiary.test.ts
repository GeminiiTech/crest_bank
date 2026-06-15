import { describe, it, expect } from "vitest";
import { beneficiarySchema } from "@/lib/validations/beneficiary";

const base = { name: "Jane Doe", type: "external", account_number: "12345678" };

describe("beneficiarySchema", () => {
  it("accepts a minimal valid beneficiary", () => {
    expect(beneficiarySchema.safeParse(base).success).toBe(true);
  });
  it("accepts optional bank/routing/iban", () => {
    expect(beneficiarySchema.safeParse({ ...base, bank_name: "Acme", routing_number: "021", iban: "GB00" }).success).toBe(true);
  });
  it("rejects a short name", () => {
    expect(beneficiarySchema.safeParse({ ...base, name: "J" }).success).toBe(false);
  });
  it("rejects a short account number", () => {
    expect(beneficiarySchema.safeParse({ ...base, account_number: "12" }).success).toBe(false);
  });
  it("rejects an invalid type", () => {
    expect(beneficiarySchema.safeParse({ ...base, type: "crypto" }).success).toBe(false);
  });
});
