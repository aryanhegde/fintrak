import type { ErrorHandler } from "hono";

export const safeApiErrorHandler: ErrorHandler = (_error, context) =>
  context.json({ error: "Internal server error" }, 500);

export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;

  const message =
    typeof payload?.error === "string"
      ? payload.error
      : `Request failed (${response.status})`;

  throw new Error(message);
}
