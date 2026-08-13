import { describe, expect, it, vi } from "vitest";

import { validateTransactionReferences } from "@/lib/transaction-ownership";

function lookupReturning(input: {
  accounts: string[];
  categories: string[];
}) {
  return {
    ownedAccountIds: vi.fn().mockResolvedValue(input.accounts),
    ownedCategoryIds: vi.fn().mockResolvedValue(input.categories),
  };
}

describe("validateTransactionReferences", () => {
  it("rejects a create-shaped input with an unowned category", async () => {
    const lookup = lookupReturning({
      accounts: ["account-a"],
      categories: [],
    });

    await expect(
      validateTransactionReferences(
        {
          userId: "user-a",
          accountIds: ["account-a"],
          categoryIds: ["category-b"],
        },
        lookup
      )
    ).resolves.toEqual({ ok: false, resource: "category" });
  });

  it("deduplicates and removes null references from bulk-shaped input", async () => {
    const lookup = lookupReturning({
      accounts: ["account-a"],
      categories: ["category-a"],
    });

    await expect(
      validateTransactionReferences(
        {
          userId: "user-a",
          accountIds: ["account-a", "account-a"],
          categoryIds: [null, "category-a", "category-a"],
        },
        lookup
      )
    ).resolves.toEqual({ ok: true });

    expect(lookup.ownedAccountIds).toHaveBeenCalledOnce();
    expect(lookup.ownedAccountIds).toHaveBeenCalledWith("user-a", [
      "account-a",
    ]);
    expect(lookup.ownedCategoryIds).toHaveBeenCalledOnce();
    expect(lookup.ownedCategoryIds).toHaveBeenCalledWith("user-a", [
      "category-a",
    ]);
  });

  it("rejects an update-shaped input with an unowned account first", async () => {
    const lookup = lookupReturning({
      accounts: [],
      categories: ["category-a"],
    });

    await expect(
      validateTransactionReferences(
        {
          userId: "user-a",
          accountIds: ["account-b"],
          categoryIds: ["category-a"],
        },
        lookup
      )
    ).resolves.toEqual({ ok: false, resource: "account" });

    expect(lookup.ownedCategoryIds).not.toHaveBeenCalled();
  });

  it("skips the category lookup when no category is referenced", async () => {
    const lookup = lookupReturning({
      accounts: ["account-a"],
      categories: [],
    });

    await expect(
      validateTransactionReferences(
        {
          userId: "user-a",
          accountIds: ["account-a"],
          categoryIds: [null, undefined],
        },
        lookup
      )
    ).resolves.toEqual({ ok: true });

    expect(lookup.ownedCategoryIds).not.toHaveBeenCalled();
  });

  it("preserves empty strings for ownership validation", async () => {
    const lookup = lookupReturning({
      accounts: [],
      categories: [],
    });

    await expect(
      validateTransactionReferences(
        {
          userId: "user-a",
          accountIds: ["", null, undefined],
          categoryIds: [],
        },
        lookup
      )
    ).resolves.toEqual({ ok: false, resource: "account" });

    expect(lookup.ownedAccountIds).toHaveBeenCalledWith("user-a", [""]);
  });
});
