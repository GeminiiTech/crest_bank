import { describe, it, expect } from "vitest";
import { resolveAuthRedirect, sanitizeNext } from "@/lib/auth/redirects";

describe("sanitizeNext", () => {
  it("defaults to /dashboard when missing", () => {
    expect(sanitizeNext(null)).toBe("/dashboard");
    expect(sanitizeNext(undefined)).toBe("/dashboard");
  });
  it("rejects external/protocol-relative urls", () => {
    expect(sanitizeNext("//evil.com")).toBe("/dashboard");
    expect(sanitizeNext("https://evil.com")).toBe("/dashboard");
  });
  it("passes through safe internal paths", () => {
    expect(sanitizeNext("/dashboard/cards")).toBe("/dashboard/cards");
  });
});

describe("resolveAuthRedirect", () => {
  it("sends logged-out users from protected paths to /login with next", () => {
    expect(resolveAuthRedirect("/dashboard", false)).toBe("/login?next=%2Fdashboard");
    expect(resolveAuthRedirect("/dashboard/cards", false)).toBe("/login?next=%2Fdashboard%2Fcards");
  });
  it("sends logged-in users away from auth pages", () => {
    expect(resolveAuthRedirect("/login", true)).toBe("/dashboard");
    expect(resolveAuthRedirect("/register", true)).toBe("/dashboard");
  });
  it("returns null for public paths", () => {
    expect(resolveAuthRedirect("/", false)).toBeNull();
    expect(resolveAuthRedirect("/", true)).toBeNull();
    expect(resolveAuthRedirect("/dashboard", true)).toBeNull();
    expect(resolveAuthRedirect("/login", false)).toBeNull();
  });
});
