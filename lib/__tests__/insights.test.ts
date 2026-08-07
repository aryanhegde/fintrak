import { describe, expect, it } from "vitest";
import { buildInsights, computeHealthScore, detectRecurring } from "../insights";

const d = (s: string) => new Date(`${s}T00:00:00`);

describe("detectRecurring", () => {
  it("detects a monthly subscription with identical amounts", () => {
    const result = detectRecurring([
      { payee: "Netflix", amount: -15990, date: d("2026-05-15") },
      { payee: "Netflix", amount: -15990, date: d("2026-06-15") },
      { payee: "Netflix", amount: -15990, date: d("2026-07-15") },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      payee: "Netflix",
      amount: -15990,
      cadence: "monthly",
      nextDate: "2026-08-15",
    });
  });

  it("detects weekly payments", () => {
    const result = detectRecurring([
      { payee: "Gym", amount: -5000, date: d("2026-07-01") },
      { payee: "Gym", amount: -5000, date: d("2026-07-08") },
      { payee: "Gym", amount: -5000, date: d("2026-07-15") },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].cadence).toBe("weekly");
    expect(result[0].nextDate).toBe("2026-07-22");
  });

  it("groups payees case-insensitively and tolerates ±10% amount drift", () => {
    const result = detectRecurring([
      { payee: "Spotify", amount: -11900, date: d("2026-06-03") },
      { payee: "spotify ", amount: -12500, date: d("2026-07-03") },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].payee).toBe("spotify");
  });

  it("ignores single occurrences", () => {
    expect(
      detectRecurring([{ payee: "Amazon", amount: -4300, date: d("2026-07-01") }])
    ).toHaveLength(0);
  });

  it("ignores irregular intervals", () => {
    expect(
      detectRecurring([
        { payee: "Cafe", amount: -300, date: d("2026-06-01") },
        { payee: "Cafe", amount: -300, date: d("2026-06-04") },
        { payee: "Cafe", amount: -310, date: d("2026-06-20") },
      ])
    ).toHaveLength(0);
  });

  it("does not merge different amounts for the same payee into one cluster", () => {
    // Rent (big) and a small misc payment to the same payee
    const result = detectRecurring([
      { payee: "Landlord", amount: -1500000, date: d("2026-05-01") },
      { payee: "Landlord", amount: -1500000, date: d("2026-06-01") },
      { payee: "Landlord", amount: -1500000, date: d("2026-07-01") },
      { payee: "Landlord", amount: -20000, date: d("2026-06-12") },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-1500000);
  });

  it("sorts results by nextDate ascending", () => {
    const result = detectRecurring([
      { payee: "B-Sub", amount: -1000, date: d("2026-06-20") },
      { payee: "B-Sub", amount: -1000, date: d("2026-07-20") },
      { payee: "A-Sub", amount: -1000, date: d("2026-06-05") },
      { payee: "A-Sub", amount: -1000, date: d("2026-07-05") },
    ]);
    expect(result.map((r) => r.payee)).toEqual(["A-Sub", "B-Sub"]);
  });
});

describe("computeHealthScore", () => {
  it("returns the savings rate as a rounded percentage", () => {
    expect(computeHealthScore(100000, 72000)).toBe(72);
  });
  it("returns 0 when income is 0", () => {
    expect(computeHealthScore(0, 0)).toBe(0);
  });
  it("clamps to 0 when spending exceeds income", () => {
    expect(computeHealthScore(100000, -20000)).toBe(0);
  });
  it("clamps to 100 maximum", () => {
    expect(computeHealthScore(100000, 150000)).toBe(100);
  });
});

describe("buildInsights", () => {
  it("mentions income trend, expense trend, and top category", () => {
    const bullets = buildInsights({
      incomeChange: 12.4,
      expensesChange: -8.2,
      topCategoryName: "Food",
      topCategoryShare: 38.5,
    });
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toBe("Income is up 12% vs last period");
    expect(bullets[1]).toBe("Spending is down 8% vs last period");
    expect(bullets[2]).toBe("Food makes up 39% of your spending");
  });

  it("omits the category bullet when there is no top category", () => {
    const bullets = buildInsights({ incomeChange: 0, expensesChange: 0 });
    expect(bullets).toEqual([
      "Income is flat vs last period",
      "Spending is flat vs last period",
    ]);
  });

  it("treats non-finite changes (Infinity/NaN from empty periods) as flat", () => {
    const bullets = buildInsights({
      incomeChange: Infinity,
      expensesChange: NaN,
    });
    expect(bullets).toEqual([
      "Income is flat vs last period",
      "Spending is flat vs last period",
    ]);
  });
});
