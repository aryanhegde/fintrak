import { describe, expect, it } from "vitest";
import { quickAddPayload } from "@/features/transactions/components/quick-add-sheet";

const now = new Date("2026-08-10T21:30:00");

describe("quickAddPayload", () => {
  it("converts a rupee amount to negative miliunits", () => {
    const payload = quickAddPayload({
      amount: "10",
      categoryId: "cat_tea",
      note: "",
      day: "today",
      now,
    });
    expect(payload).not.toBeNull();
    expect(payload!.amount).toBe(-10000);
    expect(payload!.categoryId).toBe("cat_tea");
    expect(payload!.notes).toBeNull();
  });

  it("stores the date at local midnight, not the current time", () => {
    const payload = quickAddPayload({
      amount: "60",
      categoryId: "cat_food",
      note: "",
      day: "today",
      now,
    });
    expect(payload!.date.getHours()).toBe(0);
    expect(payload!.date.getMinutes()).toBe(0);
    expect(payload!.date.getDate()).toBe(10);
  });

  it("yesterday toggle shifts the date back one day", () => {
    const payload = quickAddPayload({
      amount: "60",
      categoryId: "cat_food",
      note: "",
      day: "yesterday",
      now,
    });
    expect(payload!.date.getDate()).toBe(9);
    expect(payload!.date.getHours()).toBe(0);
  });

  it("keeps a non-empty note", () => {
    const payload = quickAddPayload({
      amount: "100",
      categoryId: "cat_travel",
      note: "auto to station",
      day: "today",
      now,
    });
    expect(payload!.notes).toBe("auto to station");
  });

  it("rejects zero, negative, and unparseable amounts", () => {
    const base = { categoryId: "cat_tea", note: "", day: "today" as const, now };
    expect(quickAddPayload({ ...base, amount: "0" })).toBeNull();
    expect(quickAddPayload({ ...base, amount: "-5" })).toBeNull();
    expect(quickAddPayload({ ...base, amount: "abc" })).toBeNull();
    expect(quickAddPayload({ ...base, amount: "" })).toBeNull();
  });

  it("accepts decimal amounts", () => {
    const payload = quickAddPayload({
      amount: "12.5",
      categoryId: "cat_snacks",
      note: "",
      day: "today",
      now,
    });
    expect(payload!.amount).toBe(-12500);
  });
});
