import { describe, expect, it } from "vitest";
import { insertTransactionSchema } from "@/db/schema";

describe("insertTransactionSchema", () => {
  const base = {
    id: "txn_1",
    amount: -10000,
    date: new Date("2026-08-10"),
    accountId: "acc_1",
  };

  it("accepts a transaction without payee", () => {
    const result = insertTransactionSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts an explicit null payee", () => {
    const result = insertTransactionSchema.safeParse({ ...base, payee: null });
    expect(result.success).toBe(true);
  });

  it("still accepts a payee string", () => {
    const result = insertTransactionSchema.safeParse({ ...base, payee: "Tea stall" });
    expect(result.success).toBe(true);
  });

  it("coerces ISO string dates", () => {
    const result = insertTransactionSchema.safeParse({
      ...base,
      date: "2026-08-10T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});
