export type ReferenceValidation =
  | { ok: true }
  | { ok: false; resource: "account" | "category" };

export type TransactionReferenceInput = {
  userId: string;
  accountIds: Array<string | null | undefined>;
  categoryIds: Array<string | null | undefined>;
};

export type TransactionReferenceLookup = {
  ownedAccountIds: (userId: string, ids: string[]) => Promise<string[]>;
  ownedCategoryIds: (userId: string, ids: string[]) => Promise<string[]>;
};

export async function validateTransactionReferences(
  input: TransactionReferenceInput,
  lookup: TransactionReferenceLookup
): Promise<ReferenceValidation> {
  const accountIds = [
    ...new Set(
      input.accountIds.filter(
        (id): id is string => id !== null && id !== undefined
      )
    ),
  ];
  const categoryIds = [
    ...new Set(
      input.categoryIds.filter(
        (id): id is string => id !== null && id !== undefined
      )
    ),
  ];

  const ownedAccounts = new Set(
    await lookup.ownedAccountIds(input.userId, accountIds)
  );
  if (accountIds.some((id) => !ownedAccounts.has(id))) {
    return { ok: false, resource: "account" };
  }

  if (categoryIds.length === 0) {
    return { ok: true };
  }

  const ownedCategories = new Set(
    await lookup.ownedCategoryIds(input.userId, categoryIds)
  );
  if (categoryIds.some((id) => !ownedCategories.has(id))) {
    return { ok: false, resource: "category" };
  }

  return { ok: true };
}
