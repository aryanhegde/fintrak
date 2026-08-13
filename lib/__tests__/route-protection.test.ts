import { describe, expect, it } from "vitest";

import { isProtectedPath } from "@/lib/route-protection";

describe("isProtectedPath", () => {
  it.each([
    "/",
    "/transactions",
    "/transactions/1",
    "/accounts",
    "/accounts/1",
    "/categories",
    "/categories/1",
    "/settings",
    "/settings/profile",
    "/api",
    "/api/categories",
  ])("protects %s", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each([
    "/sign-in",
    "/sign-up",
    "/logo.svg",
    "/favicon.ico",
    "/_next/static/a.js",
    "/transactionss",
    "/apiary",
  ])("leaves %s public", (path) => {
    expect(isProtectedPath(path)).toBe(false);
  });
});
