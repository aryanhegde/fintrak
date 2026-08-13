import { Hono } from "hono";
import { handle } from "hono/vercel";

import { safeApiErrorHandler } from "@/lib/api-response";

import accounts from "./accounts";
import categories from "./categories";
import transactions from "./transactions";
import summary from "./summary";
import insights from "./insights";

export const runtime = "edge";

const app = new Hono().basePath("/api");

app.onError(safeApiErrorHandler);

const routes = app
  .route("/accounts", accounts)
  .route("/categories", categories)
  .route("/transactions", transactions)
  .route("/summary", summary)
  .route("/insights", insights);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;
