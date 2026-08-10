import { describe, expect, it } from "vitest";
import { buildBreakdownRows } from "@/components/monthly-breakdown";

describe("buildBreakdownRows", () => {
  it("computes share of total and delta vs previous", () => {
    const rows = buildBreakdownRows(
      [
        { name: "Food", value: 1200 },
        { name: "Cigarettes", value: 800 },
      ],
      [{ name: "Food", value: 1000 }]
    );

    expect(rows).toEqual([
      { name: "Food", value: 1200, share: 0.6, delta: 200 },
      { name: "Cigarettes", value: 800, share: 0.4, delta: null },
    ]);
  });

  it("returns an empty array when there is no spending", () => {
    expect(buildBreakdownRows([], [{ name: "Tea", value: 50 }])).toEqual([]);
  });

  it("computes a negative delta when spending dropped", () => {
    const rows = buildBreakdownRows(
      [{ name: "Tea", value: 100 }],
      [{ name: "Tea", value: 300 }]
    );
    expect(rows[0].delta).toBe(-200);
    expect(rows[0].share).toBe(1);
  });
});
