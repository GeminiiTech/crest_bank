import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
  it("rejects invalid email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
  it("rejects empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = {
    fullName: "Ada Lovelace",
    email: "ada@b.com",
    password: "password1",
    confirmPassword: "password1",
    terms: true,
  };
  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });
  it("rejects password shorter than 8", () => {
    expect(registerSchema.safeParse({ ...base, password: "short", confirmPassword: "short" }).success).toBe(false);
  });
  it("rejects mismatched passwords", () => {
    expect(registerSchema.safeParse({ ...base, confirmPassword: "different1" }).success).toBe(false);
  });
  it("rejects when terms not accepted", () => {
    expect(registerSchema.safeParse({ ...base, terms: false }).success).toBe(false);
  });
  it("rejects a one-character name", () => {
    expect(registerSchema.safeParse({ ...base, fullName: "A" }).success).toBe(false);
  });
});
