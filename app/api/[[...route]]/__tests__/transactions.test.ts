import type { MiddlewareHandler } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTransactionsApp,
  type TransactionRecord,
  type TransactionsDependencies,
} from "@/app/api/[[...route]]/transactions";

vi.mock("@/db/drizzle", () => ({ db: {} }));

const transaction = (overrides: Partial<TransactionRecord> = {}) => ({
  id: "transaction-a",
  amount: 1250,
  payee: "Cafe",
  notes: null,
  date: new Date(2026, 7, 15),
  accountId: "account-a",
  categoryId: "category-a",
  ...overrides,
});

function createRepository() {
  return {
    list: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockResolvedValue(transaction()),
    create: vi
      .fn()
      .mockImplementation(async (values) => transaction({ ...values })),
    createMany: vi
      .fn()
      .mockImplementation(async (values) =>
        values.map((value: TransactionRecord) => transaction({ ...value }))
      ),
    update: vi
      .fn()
      .mockImplementation(async (_userId, id, values) =>
        transaction({ id, ...values })
      ),
    remove: vi.fn().mockResolvedValue({ id: "transaction-a" }),
    removeMany: vi.fn().mockResolvedValue([]),
    ownedAccountIds: vi.fn().mockResolvedValue(["account-a"]),
    ownedCategoryIds: vi.fn().mockResolvedValue(["category-a"]),
  };
}

function createTestApp(input: {
  userId?: string | null;
  repository?: ReturnType<typeof createRepository>;
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
    ensureDefaultAccount: vi.fn().mockResolvedValue({ id: "account-a" }),
    repository,
  } satisfies TransactionsDependencies;

  return {
    app: createTransactionsApp(dependencies),
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

describe("transactions API ownership boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects another user's category on create before inserting", async () => {
    const repository = createRepository();
    repository.ownedCategoryIds.mockResolvedValue([]);
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/",
      jsonRequest("POST", {
        amount: 1250,
        date: "2026-08-15",
        accountId: "account-a",
        categoryId: "category-b",
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Category not found" });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects another user's account on create before inserting", async () => {
    const repository = createRepository();
    repository.ownedAccountIds.mockResolvedValue([]);
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/",
      jsonRequest("POST", {
        amount: 1250,
        date: "2026-08-15",
        accountId: "account-b",
        categoryId: null,
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Account not found" });
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.ownedCategoryIds).not.toHaveBeenCalled();
  });

  it("rejects another user's category on bulk create before inserting", async () => {
    const repository = createRepository();
    repository.ownedCategoryIds.mockResolvedValue([]);
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/bulk-create",
      jsonRequest("POST", [
        {
          amount: 1250,
          date: "2026-08-15",
          accountId: "account-a",
          categoryId: "category-b",
        },
      ])
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Category not found" });
    expect(repository.createMany).not.toHaveBeenCalled();
  });

  it("rejects another user's category on patch before updating", async () => {
    const repository = createRepository();
    repository.ownedCategoryIds.mockResolvedValue([]);
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/transaction-a",
      jsonRequest("PATCH", {
        amount: 1250,
        date: "2026-08-15",
        accountId: "account-a",
        categoryId: "category-b",
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Category not found" });
    expect(repository.find).toHaveBeenCalledWith("user-a", "transaction-a");
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("does not validate replacement references for an unowned transaction", async () => {
    const repository = createRepository();
    repository.find.mockResolvedValue(undefined);
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/transaction-b",
      jsonRequest("PATCH", {
        amount: 1250,
        date: "2026-08-15",
        accountId: "account-a",
        categoryId: "category-a",
      })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not Found" });
    expect(repository.ownedAccountIds).not.toHaveBeenCalled();
    expect(repository.ownedCategoryIds).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("creates with a resolved default account and an owned category", async () => {
    const { app, dependencies, repository } = createTestApp();

    const response = await app.request(
      "/",
      jsonRequest("POST", {
        amount: 1250,
        date: "2026-08-15",
        categoryId: "category-a",
      })
    );

    expect(response.status).toBe(200);
    expect(dependencies.ensureDefaultAccount).toHaveBeenCalledWith("user-a");
    expect(repository.ownedAccountIds).toHaveBeenCalledWith("user-a", [
      "account-a",
    ]);
    expect(repository.ownedCategoryIds).toHaveBeenCalledWith("user-a", [
      "category-a",
    ]);
    expect(repository.create).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({
      data: {
        accountId: "account-a",
        categoryId: "category-a",
      },
    });
  });
});

describe("transactions API request handling", () => {
  it("returns safe JSON when the list repository rejects", async () => {
    const repository = createRepository();
    repository.list.mockRejectedValue(
      new Error("postgres://user:password@example.test/fintrak")
    );
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/?from=2026-08-01&to=2026-08-31"
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toBe(JSON.stringify({ error: "Internal server error" }));
    expect(body).not.toContain("password");
  });

  it.each([
    {
      label: "create accountId",
      path: "/",
      method: "POST" as const,
      body: {
        amount: 1250,
        date: "2026-08-15",
        accountId: "   ",
        categoryId: null,
      },
      issuePath: "accountId",
    },
    {
      label: "create categoryId",
      path: "/",
      method: "POST" as const,
      body: {
        amount: 1250,
        date: "2026-08-15",
        accountId: "account-a",
        categoryId: "   ",
      },
      issuePath: "categoryId",
    },
    {
      label: "bulk create accountId",
      path: "/bulk-create",
      method: "POST" as const,
      body: [
        {
          amount: 1250,
          date: "2026-08-15",
          accountId: "   ",
          categoryId: null,
        },
      ],
      issuePath: "0.accountId",
    },
    {
      label: "bulk create categoryId",
      path: "/bulk-create",
      method: "POST" as const,
      body: [
        {
          amount: 1250,
          date: "2026-08-15",
          accountId: "account-a",
          categoryId: "   ",
        },
      ],
      issuePath: "0.categoryId",
    },
    {
      label: "patch accountId",
      path: "/transaction-a",
      method: "PATCH" as const,
      body: {
        amount: 1250,
        date: "2026-08-15",
        accountId: "   ",
        categoryId: null,
      },
      issuePath: "accountId",
    },
    {
      label: "patch categoryId",
      path: "/transaction-a",
      method: "PATCH" as const,
      body: {
        amount: 1250,
        date: "2026-08-15",
        accountId: "account-a",
        categoryId: "   ",
      },
      issuePath: "categoryId",
    },
  ])(
    "returns a structured 400 for a blank $label before auth or repository access",
    async ({ path, method, body, issuePath }) => {
      const { app, dependencies, repository } = createTestApp();

      const response = await app.request(path, jsonRequest(method, body));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Invalid request",
        issues: [
          {
            path: issuePath,
            message: "String must contain at least 1 character(s)",
          },
        ],
      });
      expect(dependencies.authMiddleware).not.toHaveBeenCalled();
      for (const method of Object.values(repository)) {
        expect(method).not.toHaveBeenCalled();
      }
    }
  );

  it("passes the requested month's inclusive last-day boundary to the list repository", async () => {
    const { app, repository } = createTestApp();

    const response = await app.request(
      "/?from=2026-08-01&to=2026-08-31&accountId=account-a"
    );

    expect(response.status).toBe(200);
    expect(repository.list).toHaveBeenCalledWith({
      userId: "user-a",
      accountId: "account-a",
      startDate: new Date(2026, 7, 1),
      endDate: new Date(2026, 7, 31, 23, 59, 59, 999),
    });
  });

  it("returns 401 for an ordinary unauthenticated request", async () => {
    const { app, dependencies, repository } = createTestApp({ userId: null });

    const response = await app.request(
      "/?from=2026-08-01&to=2026-08-31"
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(dependencies.authMiddleware).toHaveBeenCalledOnce();
    expect(repository.list).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed", "/?from=2026-02-30&to=2026-03-01"],
    ["inverted", "/?from=2026-08-31&to=2026-08-01"],
  ])("returns a structured 400 for a %s date range", async (_label, path) => {
    const { app, dependencies, repository } = createTestApp({ userId: null });

    const response = await app.request(path);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid request",
      issues: expect.any(Array),
    });
    expect(dependencies.authMiddleware).not.toHaveBeenCalled();
    expect(repository.list).not.toHaveBeenCalled();
  });
});
