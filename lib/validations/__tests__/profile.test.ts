import { describe, it, expect } from "vitest";
import { profileSchema, passwordSchema, notificationPrefsSchema } from "@/lib/validations/profile";

describe("profileSchema", () => {
  it("accepts a full name with optional phone/country", () => {
    expect(profileSchema.safeParse({ full_name: "Ada Lovelace", phone: "+1 555", country: "US" }).success).toBe(true);
    expect(profileSchema.safeParse({ full_name: "Ada Lovelace" }).success).toBe(true);
  });
  it("rejects a short name", () => {
    expect(profileSchema.safeParse({ full_name: "A" }).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts matching passwords of 8+ chars", () => {
    expect(passwordSchema.safeParse({ password: "password1", confirmPassword: "password1" }).success).toBe(true);
  });
  it("rejects short or mismatched passwords", () => {
    expect(passwordSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: "password1", confirmPassword: "password2" }).success).toBe(false);
  });
});

describe("notificationPrefsSchema", () => {
  it("requires the three booleans", () => {
    expect(notificationPrefsSchema.safeParse({ product: true, security: false, transfers: true }).success).toBe(true);
    expect(notificationPrefsSchema.safeParse({ product: true, security: false }).success).toBe(false);
  });
});
