import { describe, expect, it } from "vitest";
import {
  currentMonth,
  monthLabel,
  monthRange,
  nextMonth,
  prevMonth,
  previousRange,
} from "@/lib/month";

describe("monthRange", () => {
  it("returns first and last day of a 31-day month", () => {
    expect(monthRange("2026-08")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("handles February in a leap year", () => {
    expect(monthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("handles February in a non-leap year", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("prevMonth / nextMonth", () => {
  it("rolls back over a year boundary", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
  });

  it("rolls forward over a year boundary", () => {
    expect(nextMonth("2025-12")).toBe("2026-01");
  });

  it("moves within a year", () => {
    expect(prevMonth("2026-08")).toBe("2026-07");
    expect(nextMonth("2026-08")).toBe("2026-09");
  });
});

describe("monthLabel", () => {
  it("formats a human-readable label", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
  });
});

describe("currentMonth", () => {
  it("formats the given date as yyyy-MM", () => {
    expect(currentMonth(new Date("2026-08-10"))).toBe("2026-08");
  });
});

describe("previousRange", () => {
  it("returns the previous full calendar month for a calendar month range", () => {
    const result = previousRange(new Date(2026, 8, 1), new Date(2026, 8, 30));
    expect(result.start).toEqual(new Date(2026, 7, 1));
    expect(result.end).toEqual(new Date(2026, 7, 31, 23, 59, 59, 999));
  });

  it("handles a shorter previous month", () => {
    const result = previousRange(new Date(2026, 2, 1), new Date(2026, 2, 31));
    expect(result.start).toEqual(new Date(2026, 1, 1));
    expect(result.end).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999));
  });

  it("handles a year rollover", () => {
    const result = previousRange(new Date(2026, 0, 1), new Date(2026, 0, 31));
    expect(result.start).toEqual(new Date(2025, 11, 1));
    expect(result.end).toEqual(new Date(2025, 11, 31, 23, 59, 59, 999));
  });

  it("keeps shifted-window behavior for an arbitrary non-calendar-month range", () => {
    const result = previousRange(new Date(2026, 7, 5), new Date(2026, 7, 11));
    expect(result.start).toEqual(new Date(2026, 6, 29));
    expect(result.end).toEqual(new Date(2026, 7, 4));
  });
});
