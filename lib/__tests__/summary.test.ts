import { describe, expect, it } from "vitest";

import { runSummaryReads, topCategoryBuckets } from "@/lib/summary";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("runSummaryReads", () => {
  it("starts all five reads before any of them resolves", async () => {
    const names = [
      "currentTotals",
      "previousTotals",
      "currentCategories",
      "previousCategories",
      "activeDays",
    ] as const;
    const started: string[] = [];
    const pending = {
      currentTotals: deferred<string>(),
      previousTotals: deferred<string>(),
      currentCategories: deferred<string>(),
      previousCategories: deferred<string>(),
      activeDays: deferred<string>(),
    };
    const reads = {
      currentTotals: () => {
        started.push("currentTotals");
        return pending.currentTotals.promise;
      },
      previousTotals: () => {
        started.push("previousTotals");
        return pending.previousTotals.promise;
      },
      currentCategories: () => {
        started.push("currentCategories");
        return pending.currentCategories.promise;
      },
      previousCategories: () => {
        started.push("previousCategories");
        return pending.previousCategories.promise;
      },
      activeDays: () => {
        started.push("activeDays");
        return pending.activeDays.promise;
      },
    };

    const resultPromise = runSummaryReads(reads);

    expect(started).toEqual(names);

    pending.currentTotals.resolve("current-totals");
    pending.previousTotals.resolve("previous-totals");
    pending.currentCategories.resolve("current-categories");
    pending.previousCategories.resolve("previous-categories");
    pending.activeDays.resolve("active-days");

    await expect(resultPromise).resolves.toEqual({
      currentTotals: "current-totals",
      previousTotals: "previous-totals",
      currentCategories: "current-categories",
      previousCategories: "previous-categories",
      activeDays: "active-days",
    });
  });

  it("rejects the combined result when any read fails", async () => {
    const failure = new Error("database unavailable");
    const reads = {
      currentTotals: () => Promise.resolve("current-totals"),
      previousTotals: () => Promise.reject(failure),
      currentCategories: () => Promise.resolve("current-categories"),
      previousCategories: () => Promise.resolve("previous-categories"),
      activeDays: () => Promise.resolve("active-days"),
    };

    await expect(runSummaryReads(reads)).rejects.toBe(failure);
  });
});

describe("topCategoryBuckets", () => {
  it("keeps a real Other category separate from the synthetic remainder", () => {
    expect(
      topCategoryBuckets([
        { name: "Other", value: 40 },
        { name: "Food", value: 30 },
        { name: "Travel", value: 20 },
        { name: "Tea", value: 10 },
      ])
    ).toEqual([
      { name: "Other", value: 40 },
      { name: "Food", value: 30 },
      { name: "Travel", value: 20 },
      { name: "Everything else", value: 10 },
    ]);
  });

  it("does not mutate the source categories", () => {
    const categories = Object.freeze([
      Object.freeze({ name: "Food", value: 30 }),
      Object.freeze({ name: "Travel", value: 20 }),
      Object.freeze({ name: "Tea", value: 10 }),
      Object.freeze({ name: "Coffee", value: 5 }),
    ]);

    const result = topCategoryBuckets(categories);

    expect(categories).toEqual([
      { name: "Food", value: 30 },
      { name: "Travel", value: 20 },
      { name: "Tea", value: 10 },
      { name: "Coffee", value: 5 },
    ]);
    expect(result).toEqual([
      { name: "Food", value: 30 },
      { name: "Travel", value: 20 },
      { name: "Tea", value: 10 },
      { name: "Everything else", value: 5 },
    ]);
  });

  it("omits the synthetic bucket when there is no remainder", () => {
    expect(
      topCategoryBuckets([
        { name: "Food", value: 30 },
        { name: "Travel", value: 20 },
        { name: "Tea", value: 10 },
      ])
    ).toEqual([
      { name: "Food", value: 30 },
      { name: "Travel", value: 20 },
      { name: "Tea", value: 10 },
    ]);
  });
});
