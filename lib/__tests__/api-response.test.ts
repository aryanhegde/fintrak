import { Hono, type ErrorHandler } from "hono";
import { describe, expect, it } from "vitest";

import * as apiResponse from "@/lib/api-response";

const { parseApiResponse } = apiResponse;

describe("parseApiResponse", () => {
  it.each([403, 404, 500])("throws for HTTP %s", async (status) => {
    const response = new Response(JSON.stringify({ error: "Denied" }), {
      status,
      headers: { "content-type": "application/json" },
    });

    await expect(parseApiResponse(response)).rejects.toThrow("Denied");
  });

  it("falls back when an error response is not JSON", async () => {
    await expect(
      parseApiResponse(new Response("bad gateway", { status: 502 }))
    ).rejects.toThrow("Request failed (502)");
  });

  it("returns JSON for a successful response", async () => {
    const payload = { id: "account-1", name: "Cash" };

    await expect(
      parseApiResponse<typeof payload>(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    ).resolves.toEqual(payload);
  });

  it("rejects a malformed successful response body", async () => {
    await expect(
      parseApiResponse(new Response("not json", { status: 200 }))
    ).rejects.toThrow();
  });

  it("rejects an empty no-content response body", async () => {
    await expect(
      parseApiResponse(new Response(null, { status: 204 }))
    ).rejects.toThrow();
  });
});

describe("safeApiErrorHandler", () => {
  it("returns safe JSON for thrown errors without overriding handled responses", async () => {
    const handler = Reflect.get(apiResponse, "safeApiErrorHandler");

    expect(handler).toBeTypeOf("function");
    if (typeof handler !== "function") return;

    const app = new Hono();
    app.onError(handler as ErrorHandler);
    app.get("/throws", () => {
      throw new Error("postgres://user:password@example.test/fintrak");
    });
    app.get("/handled", (context) =>
      context.json({ error: "Invalid request" }, 400)
    );

    const failed = await app.request("/throws");
    expect(failed.status).toBe(500);
    expect(failed.headers.get("content-type")).toContain("application/json");
    expect(await failed.json()).toEqual({ error: "Internal server error" });

    const handled = await app.request("/handled");
    expect(handled.status).toBe(400);
    expect(await handled.json()).toEqual({ error: "Invalid request" });
  });
});
