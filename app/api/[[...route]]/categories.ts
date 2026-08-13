import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { categories } from "@/db/schema";
import {
  apiValidator,
  boundedIdsSchema,
  categoryNameSchema,
} from "@/lib/api-validation";

export const DEFAULT_CATEGORY_NAMES = [
  "Tea",
  "Cigarettes",
  "Food",
  "Snacks",
  "Travel",
  "Other",
];

export type CategoryRecord = typeof categories.$inferSelect;
export type CategoryListItem = Pick<CategoryRecord, "id" | "name">;
export type CategoryValues = Pick<CategoryRecord, "name">;

export type CategoriesRepository = {
  list: (userId: string) => Promise<CategoryListItem[]>;
  find: (userId: string, id: string) => Promise<CategoryListItem | undefined>;
  create: (userId: string, values: CategoryValues) => Promise<CategoryRecord>;
  update: (
    userId: string,
    id: string,
    values: CategoryValues
  ) => Promise<CategoryRecord | undefined>;
  remove: (userId: string, id: string) => Promise<{ id: string } | undefined>;
  removeMany: (userId: string, ids: string[]) => Promise<{ id: string }[]>;
  bootstrap: (
    userId: string,
    names: string[]
  ) => Promise<CategoryListItem[]>;
  hasAny: (userId: string) => Promise<boolean>;
};

export type CategoriesDependencies = {
  authMiddleware: MiddlewareHandler;
  getUserId: (context: Context) => string | null | undefined;
  repository: CategoriesRepository;
};

const categoryIdParamSchema = z.object({
  id: z.string().optional(),
});

const categoryValuesSchema = z.object({
  name: categoryNameSchema,
});

const bulkDeleteCategoriesSchema = z.object({
  ids: boundedIdsSchema,
});

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export function createCategoriesApp(dependencies: CategoriesDependencies) {
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
    .post("/bootstrap", async (context) => {
      const userId = dependencies.getUserId(context);
      if (!userId) {
        return context.json({ error: "Unauthorized" }, 401);
      }

      if (await dependencies.repository.hasAny(userId)) {
        return context.json({ data: [] });
      }

      const data = await dependencies.repository.bootstrap(
        userId,
        DEFAULT_CATEGORY_NAMES
      );
      return context.json({ data });
    })
    .get(
      "/:id",
      apiValidator("param", categoryIdParamSchema),
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
      apiValidator("json", categoryValuesSchema),
      async (context) => {
        const userId = dependencies.getUserId(context);
        const values = context.req.valid("json");

        if (!userId) {
          return context.json({ error: "Unauthorized" }, 401);
        }

        try {
          const data = await dependencies.repository.create(userId, values);
          return context.json({ data });
        } catch (error) {
          if (isUniqueViolation(error)) {
            return context.json(
              { error: "Category name already exists" },
              409
            );
          }

          throw error;
        }
      }
    )
    .post(
      "/bulk-delete",
      apiValidator("json", bulkDeleteCategoriesSchema),
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
      apiValidator("param", categoryIdParamSchema),
      apiValidator("json", categoryValuesSchema),
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

        try {
          const data = await dependencies.repository.update(userId, id, values);
          if (!data) {
            return context.json({ error: "Not found" }, 404);
          }

          return context.json({ data });
        } catch (error) {
          if (isUniqueViolation(error)) {
            return context.json(
              { error: "Category name already exists" },
              409
            );
          }

          throw error;
        }
      }
    )
    .delete(
      "/:id",
      apiValidator("param", categoryIdParamSchema),
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

const drizzleCategoriesRepository: CategoriesRepository = {
  async list(userId) {
    return db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories)
      .where(eq(categories.userId, userId));
  },

  async find(userId, id) {
    const [data] = await db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.id, id)));

    return data;
  },

  async create(userId, values) {
    const [data] = await db
      .insert(categories)
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
      .update(categories)
      .set(values)
      .where(and(eq(categories.userId, userId), eq(categories.id, id)))
      .returning();

    return data;
  },

  async remove(userId, id) {
    const [data] = await db
      .delete(categories)
      .where(and(eq(categories.userId, userId), eq(categories.id, id)))
      .returning({ id: categories.id });

    return data;
  },

  async removeMany(userId, ids) {
    return db
      .delete(categories)
      .where(and(eq(categories.userId, userId), inArray(categories.id, ids)))
      .returning({ id: categories.id });
  },

  async bootstrap(userId, names) {
    return db
      .insert(categories)
      .values(
        names.map((name) => ({
          id: createId(),
          name,
          userId,
        }))
      )
      .onConflictDoNothing()
      .returning({ id: categories.id, name: categories.name });
  },

  async hasAny(userId) {
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.userId, userId))
      .limit(1);

    return existing.length > 0;
  },
};

const productionDependencies: CategoriesDependencies = {
  authMiddleware: clerkMiddleware(),
  getUserId: (context) => getAuth(context)?.userId,
  repository: drizzleCategoriesRepository,
};

export default createCategoriesApp(productionDependencies);
