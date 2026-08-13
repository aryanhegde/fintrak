import { describe, expect, it, vi } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  accounts,
  insertAccountSchema,
  insertCategorySchema,
  insertTransactionSchema,
  transactions,
} from "@/db/schema";

vi.mock("@hono/zod-validator", () => {
  throw new Error("db/schema.ts must not load the Hono validation adapter");
});

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

  it("rejects an overlong payee", () => {
    const result = insertTransactionSchema.safeParse({
      ...base,
      payee: "x".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it("rejects overlong notes", () => {
    const result = insertTransactionSchema.safeParse({
      ...base,
      notes: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("account and category insert schemas", () => {
  it.each([
    ["account", insertAccountSchema, { id: "acc_1", userId: "user_1" }],
    ["category", insertCategorySchema, { id: "cat_1", userId: "user_1" }],
  ])("rejects blank and overlong %s names", (_label, schema, base) => {
    expect(schema.safeParse({ ...base, name: " " }).success).toBe(false);
    expect(schema.safeParse({ ...base, name: "x".repeat(81) }).success).toBe(
      false
    );
  });
});

describe("query indexes", () => {
  const indexMetadata = (
    table: Parameters<typeof getTableConfig>[0]
  ) =>
    getTableConfig(table).indexes.map(({ config }) => ({
      name: config.name,
      columns: config.columns.map((column) =>
        "name" in column ? column.name : undefined
      ),
    }));

  it("indexes accounts by user ID", () => {
    expect(indexMetadata(accounts)).toContainEqual({
      name: "accounts_user_id_idx",
      columns: ["user_id"],
    });
  });

  it("indexes transactions by account ID and date", () => {
    expect(indexMetadata(transactions)).toContainEqual({
      name: "transactions_account_id_date_idx",
      columns: ["account_id", "date"],
    });
  });
});
