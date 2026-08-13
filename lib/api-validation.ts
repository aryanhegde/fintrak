import { zValidator } from "@hono/zod-validator";
import { endOfDay, format, isValid, parse, startOfDay, subDays } from "date-fns";
import { z } from "zod";

export {
  accountNameSchema,
  categoryNameSchema,
  notesSchema,
  payeeSchema,
} from "@/lib/validation";

export const isoDateSchema = z.string().refine((value) => {
  const date = parse(value, "yyyy-MM-dd", new Date(0));
  return isValid(date) && format(date, "yyyy-MM-dd") === value;
}, "Expected a valid yyyy-MM-dd date");

const rawDateRangeQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  accountId: z.string().trim().min(1).optional(),
});

type DateRangeQuery = z.infer<typeof rawDateRangeQuerySchema>;

function resolveDateRange(query: DateRangeQuery, now: Date) {
  return {
    startDate: query.from
      ? parse(query.from, "yyyy-MM-dd", now)
      : startOfDay(subDays(now, 30)),
    endDate: query.to
      ? endOfDay(parse(query.to, "yyyy-MM-dd", now))
      : now,
  };
}

function getDateRangeIssue(query: DateRangeQuery) {
  if (query.from && !query.to) {
    return { path: ["from"], message: "Must be on or before today" };
  }

  if (!query.from && query.to) {
    return {
      path: ["to"],
      message: "Must be on or after the default start",
    };
  }

  return { path: ["to"], message: "Must be on or after from" };
}

export const dateRangeQuerySchema = rawDateRangeQuerySchema.transform(
  (query, context) => {
    const range = resolveDateRange(query, new Date());
    if (range.startDate > range.endDate) {
      context.addIssue({
        code: "custom",
        ...getDateRangeIssue(query),
      });
      return z.NEVER;
    }

    return { ...query, ...range };
  }
);

export const boundedIdsSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .max(500);
export function parseDateRange(
  query: { from?: string; to?: string },
  now = new Date()
) {
  const result = rawDateRangeQuerySchema.safeParse(query);
  if (!result.success) {
    throw new Error("Invalid date range");
  }

  const range = resolveDateRange(result.data, now);
  if (range.startDate > range.endDate) {
    throw new Error("Invalid date range");
  }

  return range;
}

export const apiValidator = <
  Schema extends z.ZodTypeAny,
  Target extends "json" | "query" | "param"
>(target: Target, schema: Schema) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: "Invalid request",
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      );
    }
  });
