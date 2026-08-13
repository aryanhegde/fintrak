import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { accounts } from "@/db/schema";
import {
  accountNameSchema,
  apiValidator,
  boundedIdsSchema,
} from "@/lib/api-validation";

export type AccountRecord = typeof accounts.$inferSelect;
export type AccountListItem = Pick<AccountRecord, "id" | "name">;
export type AccountValues = Pick<AccountRecord, "name">;

export type AccountsRepository = {
  list: (userId: string) => Promise<AccountListItem[]>;
  find: (userId: string, id: string) => Promise<AccountListItem | undefined>;
  create: (userId: string, values: AccountValues) => Promise<AccountRecord>;
  update: (
    userId: string,
    id: string,
    values: AccountValues
  ) => Promise<AccountRecord | undefined>;
  remove: (userId: string, id: string) => Promise<{ id: string } | undefined>;
  removeMany: (userId: string, ids: string[]) => Promise<{ id: string }[]>;
};

export type AccountsDependencies = {
  authMiddleware: MiddlewareHandler;
  getUserId: (context: Context) => string | null | undefined;
  repository: AccountsRepository;
};

const accountIdParamSchema = z.object({
  id: z.string().optional(),
});

const accountValuesSchema = z.object({
  name: accountNameSchema,
});

const bulkDeleteAccountsSchema = z.object({
  ids: boundedIdsSchema,
});

export function createAccountsApp(dependencies: AccountsDependencies) {
  const app = new Hono();

  app.onError((_error, context) =>
    context.json({ error: "Internal server error" }, 500)
  );
  app.use("*", dependencies.authMiddleware);

  return app
    .get("/", async (context) => {
      const userId = dependencies.getUserId(context);
      if (!userId) {
        return context.json({ error: "Unauthorized" }, 401);
      }

      const data = await dependencies.repository.list(userId);
      return context.json({ data });
    })
    .get(
      "/:id",
      apiValidator("param", accountIdParamSchema),
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
      apiValidator("json", accountValuesSchema),
      async (context) => {
        const userId = dependencies.getUserId(context);
        const values = context.req.valid("json");

        if (!userId) {
          return context.json({ error: "Unauthorized" }, 401);
        }

        const data = await dependencies.repository.create(userId, values);
        return context.json({ data });
      }
    )
    .post(
      "/bulk-delete",
      apiValidator("json", bulkDeleteAccountsSchema),
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
      apiValidator("param", accountIdParamSchema),
      apiValidator("json", accountValuesSchema),
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

        const data = await dependencies.repository.update(userId, id, values);
        if (!data) {
          return context.json({ error: "Not found" }, 404);
        }

        return context.json({ data });
      }
    )
    .delete(
      "/:id",
      apiValidator("param", accountIdParamSchema),
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
          return context.json({ error: "Not found" }, 404);
        }

        return context.json({ data });
      }
    );
}

const drizzleAccountsRepository: AccountsRepository = {
  async list(userId) {
    return db
      .select({
        id: accounts.id,
        name: accounts.name,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId));
  },

  async find(userId, id) {
    const [data] = await db
      .select({
        id: accounts.id,
        name: accounts.name,
      })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, id)));

    return data;
  },

  async create(userId, values) {
    const [data] = await db
      .insert(accounts)
      .values({
        id: createId(),
        userId,
        ...values,
      })
      .returning();

    return data;
  },

  async update(userId, id, values) {
    const [data] = await db
      .update(accounts)
      .set(values)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
      .returning();

    return data;
  },

  async remove(userId, id) {
    const [data] = await db
      .delete(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
      .returning({ id: accounts.id });

    return data;
  },

  async removeMany(userId, ids) {
    return db
      .delete(accounts)
      .where(and(eq(accounts.userId, userId), inArray(accounts.id, ids)))
      .returning({ id: accounts.id });
  },
};

const productionDependencies: AccountsDependencies = {
  authMiddleware: clerkMiddleware(),
  getUserId: (context) => getAuth(context)?.userId,
  repository: drizzleAccountsRepository,
};

export default createAccountsApp(productionDependencies);
