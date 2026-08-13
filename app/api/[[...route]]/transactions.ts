import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { z } from "zod";

import { db } from "@/db/drizzle";
import {
  accounts,
  categories,
  insertTransactionSchema,
  transactions,
} from "@/db/schema";
import {
  apiValidator,
  boundedIdsSchema,
  dateRangeQuerySchema,
} from "@/lib/api-validation";
import { safeApiErrorHandler } from "@/lib/api-response";
import { ensureDefaultAccount } from "@/lib/default-account";
import { validateTransactionReferences } from "@/lib/transaction-ownership";

export type TransactionRecord = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionUpdate = Omit<NewTransaction, "id">;

export type TransactionListInput = {
  userId: string;
  accountId?: string;
  startDate: Date;
  endDate: Date;
};

export type TransactionListItem = {
  id: string;
  date: Date;
  category: string | null;
  categoryId: string | null;
  payee: string | null;
  amount: number;
  notes: string | null;
  account: string;
  accountId: string;
};

export type TransactionsDependencies = {
  authMiddleware: MiddlewareHandler;
  getUserId: (context: Context) => string | null | undefined;
  ensureDefaultAccount: (userId: string) => Promise<{ id: string }>;
  repository: {
    list: (input: TransactionListInput) => Promise<TransactionListItem[]>;
    find: (
      userId: string,
      id: string
    ) => Promise<TransactionRecord | undefined>;
    create: (values: NewTransaction) => Promise<TransactionRecord>;
    createMany: (values: NewTransaction[]) => Promise<TransactionRecord[]>;
    update: (
      userId: string,
      id: string,
      values: TransactionUpdate
    ) => Promise<TransactionRecord | undefined>;
    remove: (
      userId: string,
      id: string
    ) => Promise<{ id: string } | undefined>;
    removeMany: (userId: string, ids: string[]) => Promise<{ id: string }[]>;
    ownedAccountIds: (userId: string, ids: string[]) => Promise<string[]>;
    ownedCategoryIds: (userId: string, ids: string[]) => Promise<string[]>;
  };
};

function ownershipError(resource: "account" | "category") {
  const label = resource === "account" ? "Account" : "Category";
  return { error: `${label} not found` };
}

const transactionIdParamSchema = z.object({
  id: z.string().optional(),
});

const referenceIdSchema = z.string().trim().min(1);

const createTransactionSchema = insertTransactionSchema
  .omit({
    id: true,
    accountId: true,
  })
  .extend({
    accountId: referenceIdSchema.optional(),
    categoryId: referenceIdSchema.nullable().optional(),
  });

const bulkCreateTransactionsSchema = z
  .array(
    insertTransactionSchema
      .omit({
        id: true,
      })
      .extend({
        accountId: referenceIdSchema,
        categoryId: referenceIdSchema.nullable().optional(),
      })
  )
  .min(1)
  .max(500);

const bulkDeleteTransactionsSchema = z.object({
  ids: boundedIdsSchema,
});

const updateTransactionSchema = insertTransactionSchema
  .omit({
    id: true,
  })
  .extend({
    accountId: referenceIdSchema,
    categoryId: referenceIdSchema.nullable().optional(),
  });

export function createTransactionsApp(dependencies: TransactionsDependencies) {
  const app = new Hono();

  app.onError(safeApiErrorHandler);

  // Validate once before auth for structured 400s, then repeat the same shared
  // validators on the typed handlers so Hono's generated client keeps its inputs.
  app.get("/", apiValidator("query", dateRangeQuerySchema));
  app.get("/:id", apiValidator("param", transactionIdParamSchema));
  app.post("/", apiValidator("json", createTransactionSchema));
  app.post(
    "/bulk-create",
    apiValidator("json", bulkCreateTransactionsSchema)
  );
  app.post(
    "/bulk-delete",
    apiValidator("json", bulkDeleteTransactionsSchema)
  );
  app.patch(
    "/:id",
    apiValidator("param", transactionIdParamSchema),
    apiValidator("json", updateTransactionSchema)
  );
  app.delete("/:id", apiValidator("param", transactionIdParamSchema));

  app.use("*", dependencies.authMiddleware);

  return app
    .get(
      "/",
      apiValidator("query", dateRangeQuerySchema),
      async (context) => {
        const userId = dependencies.getUserId(context);
        const { accountId, startDate, endDate } = context.req.valid("query");

        if (!userId) {
          return context.json({ error: "Unauthorized" }, 401);
        }

        const data = await dependencies.repository.list({
          userId,
          accountId,
          startDate,
          endDate,
        });

        return context.json({ data });
      }
    )
    .get(
      "/:id",
      apiValidator("param", transactionIdParamSchema),
      async (context) => {
        const userId = dependencies.getUserId(context);
        const { id } = context.req.valid("param");

        if (!id) {
          return context.json({ error: "Missing id" }, 400);
        }
        if (!userId) {
          return context.json({ error: "Unauthorized" }, 401);
        }

        const data = await dependencies.repository.find(userId, id);
        if (!data) {
          return context.json({ error: "Not found" }, 404);
        }

        return context.json({ data });
      }
    )
    .post(
      "/",
      apiValidator("json", createTransactionSchema),
      async (context) => {
        const userId = dependencies.getUserId(context);
        const values = context.req.valid("json");

        if (!userId) {
          return context.json({ error: "Unauthorized" }, 401);
        }

        const accountId =
          values.accountId ??
          (await dependencies.ensureDefaultAccount(userId)).id;
        const ownership = await validateTransactionReferences(
          {
            userId,
            accountIds: [accountId],
            categoryIds: [values.categoryId],
          },
          dependencies.repository
        );
        if (!ownership.ok) {
          return context.json(ownershipError(ownership.resource), 403);
        }

        const data = await dependencies.repository.create({
          id: createId(),
          ...values,
          accountId,
        });

        return context.json({ data });
      }
    )
    .post(
      "/bulk-create",
      apiValidator("json", bulkCreateTransactionsSchema),
      async (context) => {
        const userId = dependencies.getUserId(context);
        const values = context.req.valid("json");

        if (!userId) {
          return context.json({ error: "Unauthorized" }, 401);
        }

        const ownership = await validateTransactionReferences(
          {
            userId,
            accountIds: values.map((value) => value.accountId),
            categoryIds: values.map((value) => value.categoryId),
          },
          dependencies.repository
        );
        if (!ownership.ok) {
          return context.json(ownershipError(ownership.resource), 403);
        }

        const data = await dependencies.repository.createMany(
          values.map((value) => ({
            id: createId(),
            ...value,
          }))
        );

        return context.json({ data });
      }
    )
    .post(
      "/bulk-delete",
      apiValidator("json", bulkDeleteTransactionsSchema),
      async (context) => {
        const userId = dependencies.getUserId(context);
        const values = context.req.valid("json");

        if (!userId) {
          return context.json({ error: "Unauthorized" }, 401);
        }

        const data = await dependencies.repository.removeMany(
          userId,
          values.ids
        );
        return context.json({ data });
      }
    )
    .patch(
      "/:id",
      apiValidator("param", transactionIdParamSchema),
      apiValidator("json", updateTransactionSchema),
      async (context) => {
        const userId = dependencies.getUserId(context);
        const { id } = context.req.valid("param");
        const values = context.req.valid("json");

        if (!id) {
          return context.json({ error: "Missing id" }, 400);
        }
        if (!userId) {
          return context.json({ error: "Unauthorized" }, 401);
        }

        const existing = await dependencies.repository.find(userId, id);
        if (!existing) {
          return context.json({ error: "Not Found" }, 404);
        }

        const ownership = await validateTransactionReferences(
          {
            userId,
            accountIds: [values.accountId],
            categoryIds: [values.categoryId],
          },
          dependencies.repository
        );
        if (!ownership.ok) {
          return context.json(ownershipError(ownership.resource), 403);
        }

        const data = await dependencies.repository.update(userId, id, values);
        if (!data) {
          return context.json({ error: "Not Found" }, 404);
        }

        return context.json({ data });
      }
    )
    .delete(
      "/:id",
      apiValidator("param", transactionIdParamSchema),
      async (context) => {
        const userId = dependencies.getUserId(context);
        const { id } = context.req.valid("param");

        if (!id) {
          return context.json({ error: "Missing id" }, 400);
        }
        if (!userId) {
          return context.json({ error: "Unauthorized" }, 401);
        }

        const data = await dependencies.repository.remove(userId, id);
        if (!data) {
          return context.json({ error: "Not Found" }, 404);
        }

        return context.json({ data });
      }
    );
}

const productionRepository: TransactionsDependencies["repository"] = {
  async list({ userId, accountId, startDate, endDate }) {
    return db
      .select({
        id: transactions.id,
        date: transactions.date,
        category: categories.name,
        categoryId: transactions.categoryId,
        payee: transactions.payee,
        amount: transactions.amount,
        notes: transactions.notes,
        account: accounts.name,
        accountId: transactions.accountId,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          accountId ? eq(transactions.accountId, accountId) : undefined,
          eq(accounts.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .orderBy(desc(transactions.date));
  },

  async find(userId, id) {
    const [data] = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        categoryId: transactions.categoryId,
        payee: transactions.payee,
        amount: transactions.amount,
        notes: transactions.notes,
        accountId: transactions.accountId,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(eq(transactions.id, id), eq(accounts.userId, userId)));

    return data;
  },

  async create(values) {
    const [data] = await db.insert(transactions).values(values).returning();
    return data;
  },

  async createMany(values) {
    return db.insert(transactions).values(values).returning();
  },

  async update(userId, id, values) {
    const transactionsToUpdate = db.$with("transactions_to_update").as(
      db
        .select({ id: transactions.id })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .where(and(eq(transactions.id, id), eq(accounts.userId, userId)))
    );

    const [data] = await db
      .with(transactionsToUpdate)
      .update(transactions)
      .set(values)
      .where(
        inArray(
          transactions.id,
          sql`(select id from ${transactionsToUpdate})`
        )
      )
      .returning();

    return data;
  },

  async remove(userId, id) {
    const transactionsToDelete = db.$with("transactions_to_delete").as(
      db
        .select({ id: transactions.id })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .where(and(eq(transactions.id, id), eq(accounts.userId, userId)))
    );

    const [data] = await db
      .with(transactionsToDelete)
      .delete(transactions)
      .where(
        inArray(
          transactions.id,
          sql`(select id from ${transactionsToDelete})`
        )
      )
      .returning({ id: transactions.id });

    return data;
  },

  async removeMany(userId, ids) {
    const transactionsToDelete = db.$with("transactions_to_delete").as(
      db
        .select({ id: transactions.id })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .where(
          and(
            inArray(transactions.id, ids),
            eq(accounts.userId, userId)
          )
        )
    );

    return db
      .with(transactionsToDelete)
      .delete(transactions)
      .where(
        inArray(
          transactions.id,
          sql`(select id from ${transactionsToDelete})`
        )
      )
      .returning({ id: transactions.id });
  },

  async ownedAccountIds(userId, ids) {
    if (ids.length === 0) {
      return [];
    }

    const rows = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(inArray(accounts.id, ids), eq(accounts.userId, userId)));
    return rows.map(({ id }) => id);
  },

  async ownedCategoryIds(userId, ids) {
    if (ids.length === 0) {
      return [];
    }

    const rows = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(inArray(categories.id, ids), eq(categories.userId, userId)));
    return rows.map(({ id }) => id);
  },
};

const productionDependencies: TransactionsDependencies = {
  authMiddleware: clerkMiddleware(),
  getUserId: (context) => getAuth(context)?.userId,
  ensureDefaultAccount,
  repository: productionRepository,
};

export default createTransactionsApp(productionDependencies);
