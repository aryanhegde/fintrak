import { describe, expect, it } from "vitest";

import {
  effectiveRangeForPathname,
  effectiveMonthRange,
  effectiveRollingRange,
  shouldCanonicalizeMonthRange,
} from "@/lib/query-range";

const now = new Date(2026, 7, 12);

describe("effectiveMonthRange", () => {
  it("defaults to the current calendar month", () => {
    expect(effectiveMonthRange({}, now)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("preserves an explicit range", () => {
    expect(
      effectiveMonthRange(
        { from: "2026-07-01", to: "2026-07-31" },
        now
      )
    ).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("defaults the whole range when only from is present", () => {
    expect(effectiveMonthRange({ from: "2026-07-01" }, now)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("defaults the whole range when only to is present", () => {
    expect(effectiveMonthRange({ to: "2026-07-31" }, now)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("gives empty and canonical current-month URLs the same summary range", () => {
    const canonical = { from: "2026-08-01", to: "2026-08-31" };

    expect(effectiveMonthRange({}, now)).toEqual(
      effectiveMonthRange(canonical, now)
    );
    expect(effectiveMonthRange({ from: "2026-07-01" }, now)).toEqual(
      effectiveMonthRange(canonical, now)
    );
    expect(effectiveMonthRange({ to: "2026-07-31" }, now)).toEqual(
      effectiveMonthRange(canonical, now)
    );
  });
});

describe("effectiveRollingRange", () => {
  it("defaults to the rolling 30-day range", () => {
    expect(effectiveRollingRange({}, now)).toEqual({
      from: "2026-07-13",
      to: "2026-08-12",
    });
  });

  it("preserves an explicit range", () => {
    expect(
      effectiveRollingRange(
        { from: "2026-06-01", to: "2026-06-30" },
        now
      )
    ).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });

  it("defaults the whole range when only from is present", () => {
    expect(effectiveRollingRange({ from: "2026-06-01" }, now)).toEqual({
      from: "2026-07-13",
      to: "2026-08-12",
    });
  });

  it("defaults the whole range when only to is present", () => {
    expect(effectiveRollingRange({ to: "2026-06-30" }, now)).toEqual({
      from: "2026-07-13",
      to: "2026-08-12",
    });
  });
});

describe("shouldCanonicalizeMonthRange", () => {
  it("canonicalizes unless both endpoints are present", () => {
    expect(shouldCanonicalizeMonthRange({})).toBe(true);
    expect(shouldCanonicalizeMonthRange({ from: "2026-07-01" })).toBe(true);
    expect(shouldCanonicalizeMonthRange({ to: "2026-07-31" })).toBe(true);
    expect(
      shouldCanonicalizeMonthRange({
        from: "2026-07-01",
        to: "2026-07-31",
      })
    ).toBe(false);
  });
});

describe("effectiveRangeForPathname", () => {
  it("uses the calendar month range on the overview route", () => {
    expect(effectiveRangeForPathname("/", {}, now)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("uses the rolling range on other dashboard routes", () => {
    expect(effectiveRangeForPathname("/transactions", {}, now)).toEqual({
      from: "2026-07-13",
      to: "2026-08-12",
    });
  });

  it("preserves a complete explicit range on every dashboard route", () => {
    const params = { from: "2026-06-01", to: "2026-06-30" };

    expect(effectiveRangeForPathname("/", params, now)).toEqual(params);
    expect(
      effectiveRangeForPathname("/transactions", params, now)
    ).toEqual(params);
  });
});
