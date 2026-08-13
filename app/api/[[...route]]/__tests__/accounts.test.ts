import type { MiddlewareHandler } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAccountsApp,
  type AccountsDependencies,
  type AccountsRepository,
} from "@/app/api/[[...route]]/accounts";

vi.mock("@/db/drizzle", () => ({ db: {} }));

function createRepository(): AccountsRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockResolvedValue({ id: "account-a", name: "Cash" }),
    create: vi.fn().mockImplementation(async (_userId, values) => ({
      id: "account-a",
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
    remove: vi.fn().mockResolvedValue({ id: "account-a" }),
    removeMany: vi.fn().mockResolvedValue([]),
  };
}

function createTestApp(input: {
  userId?: string | null;
  repository?: AccountsRepository;
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
  } satisfies AccountsDependencies;

  return {
    app: createAccountsApp(dependencies),
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

describe("accounts API request contracts", () => {
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

  it("lists only the authenticated user's accounts", async () => {
    const repository = createRepository();
    vi.mocked(repository.list).mockResolvedValue([
      { id: "account-a", name: "Cash" },
    ]);
    const { app } = createTestApp({ repository });

    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(repository.list).toHaveBeenCalledWith("user-a");
    expect(await response.json()).toEqual({
      data: [{ id: "account-a", name: "Cash" }],
    });
  });

  it("returns 404 when an account is not owned by the user or is missing", async () => {
    const repository = createRepository();
    vi.mocked(repository.find).mockResolvedValue(undefined);
    const { app } = createTestApp({ repository });

    const response = await app.request("/account-b");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(repository.find).toHaveBeenCalledWith("user-a", "account-b");
  });

  it("trims an account name before creating it", async () => {
    const { app, repository } = createTestApp();

    const response = await app.request(
      "/",
      jsonRequest("POST", { name: "  Cash  " })
    );

    expect(response.status).toBe(200);
    expect(repository.create).toHaveBeenCalledWith("user-a", { name: "Cash" });
    expect(await response.json()).toEqual({
      data: {
        id: "account-a",
        plaidId: null,
        userId: "user-a",
        name: "Cash",
      },
    });
  });

  it.each([
    ["blank", "   "],
    ["over 80 characters", "a".repeat(81)],
  ])("returns a structured 400 for a %s account name", async (_label, name) => {
    const { app, repository } = createTestApp();

    const response = await app.request("/", jsonRequest("POST", { name }));

    await expectStructured400(response, "name");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("updates an owned account", async () => {
    const { app, repository } = createTestApp();

    const response = await app.request(
      "/account-a",
      jsonRequest("PATCH", { name: "Savings" })
    );

    expect(response.status).toBe(200);
    expect(repository.update).toHaveBeenCalledWith("user-a", "account-a", {
      name: "Savings",
    });
    expect(await response.json()).toEqual({
      data: {
        id: "account-a",
        plaidId: null,
        userId: "user-a",
        name: "Savings",
      },
    });
  });

  it("returns 404 instead of updating an unowned or missing account", async () => {
    const repository = createRepository();
    vi.mocked(repository.update).mockResolvedValue(undefined);
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/account-b",
      jsonRequest("PATCH", { name: "Savings" })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(repository.update).toHaveBeenCalledWith("user-a", "account-b", {
      name: "Savings",
    });
  });

  it("deletes an owned account", async () => {
    const { app, repository } = createTestApp();

    const response = await app.request("/account-a", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(repository.remove).toHaveBeenCalledWith("user-a", "account-a");
    expect(await response.json()).toEqual({ data: { id: "account-a" } });
  });

  it("bulk deletes only IDs owned by the authenticated user", async () => {
    const repository = createRepository();
    vi.mocked(repository.removeMany).mockResolvedValue([{ id: "account-a" }]);
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/bulk-delete",
      jsonRequest("POST", { ids: ["account-a", "account-b"] })
    );

    expect(response.status).toBe(200);
    expect(repository.removeMany).toHaveBeenCalledWith("user-a", [
      "account-a",
      "account-b",
    ]);
    expect(await response.json()).toEqual({ data: [{ id: "account-a" }] });
  });

  it.each([
    ["zero", []],
    ["501", Array.from({ length: 501 }, (_, index) => `account-${index}`)],
  ])("returns a structured 400 for %s bulk-delete IDs", async (_label, ids) => {
    const { app, repository } = createTestApp();

    const response = await app.request(
      "/bulk-delete",
      jsonRequest("POST", { ids })
    );

    await expectStructured400(response, "ids");
    expect(repository.removeMany).not.toHaveBeenCalled();
  });

  it("returns a safe 500 when an account write fails", async () => {
    const repository = createRepository();
    vi.mocked(repository.create).mockRejectedValue(
      new Error("SQL failed for secret account payload")
    );
    const { app } = createTestApp({ repository });

    const response = await app.request(
      "/",
      jsonRequest("POST", { name: "Cash" })
    );

    expect(response.status).toBe(500);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ error: "Internal server error" });
    expect(body).not.toContain("SQL");
    expect(body).not.toContain("secret account payload");
  });
});
