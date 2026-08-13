import type { MiddlewareHandler } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCategoriesApp,
  DEFAULT_CATEGORY_NAMES,
  type CategoriesDependencies,
  type CategoriesRepository,
} from "@/app/api/[[...route]]/categories";

vi.mock("@/db/drizzle", () => ({ db: {} }));

function createRepository(): CategoriesRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockResolvedValue({ id: "category-a", name: "Food" }),
    create: vi.fn().mockImplementation(async (_userId, values) => ({
      id: "category-a",
      plaidId: null,
      userId: "user-a",
      ...values,
    })),
    update: vi.fn().mockImplementation(async (_userId, id, values) => ({
      id,
      plaidId: null,
      userId: "user-a",
      ...values,
    })),
    remove: vi.fn().mockResolvedValue({ id: "category-a" }),
    removeMany: vi.fn().mockResolvedValue([]),
    bootstrap: vi.fn().mockResolvedValue([]),
    hasAny: vi.fn().mockResolvedValue(false),
  };
}

function createTestApp(input: {
  userId?: string | null;
  repository?: CategoriesRepository;
} = {}) {
  const repository = input.repository ?? createRepository();
  const authMiddleware = vi.fn<MiddlewareHandler>(async (_context, next) =>
    next()
  );
  const dependencies = {
    authMiddleware,
    getUserId: vi.fn(() =>
      Object.prototype.hasOwnProperty.call(input, "userId")
        ? input.userId
        : "user-a"
    ),
    repository,
  } satisfies CategoriesDependencies;

  return {
    app: createCategoriesApp(dependencies),
    dependencies,
    repository,
  };
}

function jsonRequest(method: "POST" | "PATCH", body: unknown) {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function expectStructured400(response: Response, path: string) {
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "Invalid request",
    issues: [
      {
        path,
        message: expect.any(String),
      },
    ],
  });
}

describe("categories API request contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when listing without a user", async () => {
    const { app, repository } = createTestApp({ userId: null });

    const response = await app.request("/");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("lists only the authenticated user's categories", async () => {
    const repository = createRepository();
    vi.mocked(repository.list).mockResolvedValue([
      { id: "category-a", name: "Food" },
    ]);
    const { app } = createTestApp({ repository });

    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(repository.list).toHaveBeenCalledWith("user-a");
    expect(await response.json()).toEqual({
      data: [{ id: "category-a", name: "Food" }],
    });
  });

  it("returns 404 when a category is not owned by the user or is missing", async () => {
    const repository = createRepository();
    vi.mocked(repository.find).mockResolvedValue(undefined);
    const { app } = createTestApp({ repository });

    const response = await app.request("/category-b");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(repository.find).toHaveBeenCalledWith("user-a", "category-b");
  });

  it("trims a category name before creating it", async () => {
    const { app, repository } = createTestApp();

    const response = await app.request(
      "/",
      jsonRequest("POST", { name: "  Food  " })
    );

    expect(response.status).toBe(200);
    expect(repository.create).toHaveBeenCalledWith("user-a", { name: "Food" });
    expect(await response.json()).toEqual({
      data: {
        id: "category-a",
        plaidId: null,
        userId: "user-a",
        name: "Food",
      },
    });
  });

  it.each([
    ["blank", "   "],
    ["over 80 characters", "a".repeat(81)],
  ])("returns a structured 400 for a %s category name", async (_label, name) => {
    const { app, repository } = createTestApp();

    const response = await app.request("/", jsonRequest("POST", { name }));

    await expectStructured400(response, "name");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("updates an owned category", async () => {
    const { app, repository } = createTestApp();

    const response = await app.request(
      "/category-a",
      jsonRequest("PATCH", { name: "Groceries" })
    );

    expect(response.status).toBe(200);
    expect(repository.update).toHaveBeenCalledWith("user-a", "category-a", {
      name: "Groceries",
    });
    expect(await response.json()).toEqual({
      data: {
        id: "category-a",
        plaidId: null,
        userId: "user-a",
        name: "Groceries",
      },
    });
  });

  it("returns 404 instead of updating an unowned or missing category", async () => {
    const repository = createRepository();
    vi.mocked(repository.update).mockResolvedValue(undefined);
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/category-b",
      jsonRequest("PATCH", { name: "Groceries" })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(repository.update).toHaveBeenCalledWith("user-a", "category-b", {
      name: "Groceries",
    });
  });

  it("deletes an owned category", async () => {
    const { app, repository } = createTestApp();

    const response = await app.request("/category-a", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(repository.remove).toHaveBeenCalledWith("user-a", "category-a");
    expect(await response.json()).toEqual({ data: { id: "category-a" } });
  });

  it("bulk deletes only IDs owned by the authenticated user", async () => {
    const repository = createRepository();
    vi.mocked(repository.removeMany).mockResolvedValue([{ id: "category-a" }]);
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/bulk-delete",
      jsonRequest("POST", { ids: ["category-a", "category-b"] })
    );

    expect(response.status).toBe(200);
    expect(repository.removeMany).toHaveBeenCalledWith("user-a", [
      "category-a",
      "category-b",
    ]);
    expect(await response.json()).toEqual({ data: [{ id: "category-a" }] });
  });

  it.each([
    ["zero", []],
    ["501", Array.from({ length: 501 }, (_, index) => `category-${index}`)],
  ])("returns a structured 400 for %s bulk-delete IDs", async (_label, ids) => {
    const { app, repository } = createTestApp();

    const response = await app.request(
      "/bulk-delete",
      jsonRequest("POST", { ids })
    );

    await expectStructured400(response, "ids");
    expect(repository.removeMany).not.toHaveBeenCalled();
  });

  it("does not insert defaults when the user already has a category", async () => {
    const repository = createRepository();
    vi.mocked(repository.hasAny).mockResolvedValue(true);
    const { app } = createTestApp({ repository });

    const response = await app.request("/bootstrap", { method: "POST" });

    expect(response.status).toBe(200);
    expect(repository.hasAny).toHaveBeenCalledWith("user-a");
    expect(repository.bootstrap).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ data: [] });
  });

  it("bootstraps the default names when the user has no categories", async () => {
    const repository = createRepository();
    vi.mocked(repository.bootstrap).mockResolvedValue([
      { id: "category-a", name: "Tea" },
    ]);
    const { app } = createTestApp({ repository });

    const response = await app.request("/bootstrap", { method: "POST" });

    expect(response.status).toBe(200);
    expect(repository.hasAny).toHaveBeenCalledWith("user-a");
    expect(repository.bootstrap).toHaveBeenCalledWith(
      "user-a",
      DEFAULT_CATEGORY_NAMES
    );
    expect(await response.json()).toEqual({
      data: [{ id: "category-a", name: "Tea" }],
    });
  });

  it("maps only PostgreSQL unique conflicts to a safe 409", async () => {
    const repository = createRepository();
    vi.mocked(repository.create).mockRejectedValue(
      Object.assign(new Error("duplicate key SQL detail"), { code: "23505" })
    );
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/",
      jsonRequest("POST", { name: "Food" })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Category name already exists",
    });
  });

  it("maps a unique name conflict on update to a safe 409", async () => {
    const repository = createRepository();
    vi.mocked(repository.update).mockRejectedValue(
      Object.assign(new Error("duplicate key SQL detail"), { code: "23505" })
    );
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/category-a",
      jsonRequest("PATCH", { name: "Food" })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Category name already exists",
    });
  });

  it("does not label a unique-code delete failure as a name conflict", async () => {
    const repository = createRepository();
    vi.mocked(repository.remove).mockRejectedValue(
      Object.assign(new Error("constraint SQL detail"), { code: "23505" })
    );
    const { app } = createTestApp({ repository });

    const response = await app.request("/category-a", { method: "DELETE" });

    expect(response.status).toBe(500);
    const responseBody = await response.text();
    expect(JSON.parse(responseBody)).toEqual({
      error: "Internal server error",
    });
    expect(responseBody).not.toContain("constraint SQL detail");
  });

  it.each([
    {
      label: "create",
      method: "POST" as const,
      path: "/",
      body: { name: "Food" },
      repositoryMethod: "create" as const,
    },
    {
      label: "update",
      method: "PATCH" as const,
      path: "/category-a",
      body: { name: "Food" },
      repositoryMethod: "update" as const,
    },
    {
      label: "delete",
      method: "DELETE" as const,
      path: "/category-a",
      repositoryMethod: "remove" as const,
    },
    {
      label: "bulk delete",
      method: "POST" as const,
      path: "/bulk-delete",
      body: { ids: ["category-a"] },
      repositoryMethod: "removeMany" as const,
    },
    {
      label: "bootstrap",
      method: "POST" as const,
      path: "/bootstrap",
      repositoryMethod: "bootstrap" as const,
    },
  ])(
    "returns a safe 500 when a category $label write fails",
    async ({ method, path, body, repositoryMethod }) => {
      const repository = createRepository();
      vi.mocked(repository[repositoryMethod]).mockRejectedValue(
        new Error("SQL failed with password=hunter2 and submitted data")
      );
      const { app } = createTestApp({ repository });

      const response = await app.request(
        path,
        body === undefined
          ? { method }
          : {
              method,
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }
      );

      expect(response.status).toBe(500);
      const responseBody = await response.text();
      expect(JSON.parse(responseBody)).toEqual({
        error: "Internal server error",
      });
      expect(responseBody).not.toContain("SQL");
      expect(responseBody).not.toContain("hunter2");
      expect(responseBody).not.toContain("submitted data");
    }
  );
});
