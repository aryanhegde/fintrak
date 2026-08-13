import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import transactionsApi from "@/app/api/[[...route]]/transactions";

import {
  accountNameSchema,
  apiValidator,
  boundedIdsSchema,
  categoryNameSchema,
  notesSchema,
  parseDateRange,
  payeeSchema,
} from "@/lib/api-validation";

vi.mock("@/db/drizzle", () => ({ db: {} }));

describe("parseDateRange", () => {
  const now = new Date(2026, 7, 12, 15, 30);

  it("parses an explicit calendar date range", () => {
    expect(
      parseDateRange({ from: "2026-08-01", to: "2026-08-31" }, now)
    ).toEqual({
        startDate: new Date(2026, 7, 1),
        endDate: new Date(2026, 7, 31, 23, 59, 59, 999),
      });
  });

  it("defaults to the previous 30 days", () => {
    expect(parseDateRange({}, now)).toEqual({
      startDate: new Date(2026, 6, 13, 0, 0),
      endDate: now,
    });
  });

  it("rejects a future from date when to is omitted", () => {
    expect(() => parseDateRange({ from: "2026-08-13" }, now)).toThrow(
      "Invalid date range"
    );
  });

  it("rejects a to date older than the default start", () => {
    expect(() => parseDateRange({ to: "2026-07-12" }, now)).toThrow(
      "Invalid date range"
    );
  });

  it("uses the end of the explicit to day with a default midnight start", () => {
    expect(parseDateRange({ to: "2026-07-13" }, now)).toEqual({
      startDate: new Date(2026, 6, 13, 0, 0),
      endDate: new Date(2026, 6, 13, 23, 59, 59, 999),
    });
  });

  it("rejects an invalid calendar date", () => {
    expect(() =>
      parseDateRange({ from: "2026-02-30", to: "2026-03-01" }, now)
    ).toThrow("Invalid date range");
  });

  it("rejects an inverted date range", () => {
    expect(() =>
      parseDateRange({ from: "2026-08-31", to: "2026-08-01" }, now)
    ).toThrow("Invalid date range");
  });
});

describe("bounded field schemas", () => {
  it("requires between 1 and 500 ids", () => {
    expect(boundedIdsSchema.safeParse([]).success).toBe(false);
    expect(boundedIdsSchema.safeParse(Array(501).fill("id")).success).toBe(false);
  });

  it("trims names and rejects a blank category", () => {
    expect(accountNameSchema.parse("  Cash  ")).toBe("Cash");
    expect(categoryNameSchema.safeParse(" ").success).toBe(false);
  });

  it("bounds payees and notes", () => {
    expect(payeeSchema.safeParse("x".repeat(121)).success).toBe(false);
    expect(notesSchema.safeParse("x".repeat(501)).success).toBe(false);
  });
});

describe("apiValidator", () => {
  it("returns the shared structured 400 payload", async () => {
    const app = new Hono().post(
      "/",
      apiValidator("json", z.object({ name: accountNameSchema })),
      (c) => c.json({ ok: true })
    );

    const response = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: " " }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid request",
      issues: [
        {
          path: "name",
          message: "String must contain at least 1 character(s)",
        },
      ],
    });
  });

  it("returns the shared structured 400 from the transactions route", async () => {
    const response = await transactionsApi.request("/?from=2999-01-01");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid request",
      issues: [
        {
          path: "from",
          message: "Must be on or before today",
        },
      ],
    });
  });
});
