import { Hono } from "hono";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { and, desc, eq, gte, lt, lte, sql, sum } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { accounts, categories, transactions } from "@/db/schema";
import { calculatePercentageChange, fillMissingDays } from "@/lib/utils";
import { previousRange } from "@/lib/month";
import { runSummaryReads, topCategoryBuckets } from "@/lib/summary";
import {
  apiValidator,
  dateRangeQuerySchema,
} from "@/lib/api-validation";

const app = new Hono().get(
  "/",
  clerkMiddleware(),
  apiValidator("query", dateRangeQuerySchema),
  async (c) => {
    const auth = getAuth(c);
    const { accountId, startDate, endDate } = c.req.valid("query");

    if (!auth?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = auth.userId;
    const previous = previousRange(startDate, endDate);

    async function fetchFinancialData(
      userId: string,
      startDate: Date,
      endDate: Date
    ) {
      return await db
        .select({
          income:
            sql`SUM(CASE WHEN ${transactions.amount} >= 0 THEN ${transactions.amount} ELSE 0 END)`.mapWith(
              Number
            ),
          expenses:
            sql`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`.mapWith(
              Number
            ),
          remaining: sum(transactions.amount).mapWith(Number),
        })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .where(
          and(
            accountId ? eq(transactions.accountId, accountId) : undefined,
            eq(accounts.userId, userId),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate)
          )
        );
    }

    async function fetchSpendingByCategory(
      userId: string,
      startDate: Date,
      endDate: Date
    ) {
      return await db
        .select({
          name: categories.name,
          value: sql`SUM(ABS(${transactions.amount}))`.mapWith(Number),
        })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .innerJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
          and(
            accountId ? eq(transactions.accountId, accountId) : undefined,
            eq(accounts.userId, userId),
            lt(transactions.amount, 0),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate)
          )
        )
        .groupBy(categories.name)
        .orderBy(desc(sql`SUM(ABS(${transactions.amount}))`));
    }

    async function fetchActiveDays() {
      return await db
        .select({
          date: transactions.date,
          income:
            sql`SUM(CASE WHEN ${transactions.amount} >= 0 THEN ${transactions.amount} ELSE 0 END)`.mapWith(
              Number
            ),
          expenses:
            sql`SUM(CASE WHEN ${transactions.amount} < 0 THEN ABS(${transactions.amount}) ELSE 0 END)`.mapWith(
              Number
            ),
        })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .where(
          and(
            accountId ? eq(transactions.accountId, accountId) : undefined,
            eq(accounts.userId, userId),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate)
          )
        )
        .groupBy(transactions.date)
        .orderBy(transactions.date);
    }

    const databaseStartedAt = performance.now();
    const {
      currentTotals,
      previousTotals,
      currentCategories,
      previousCategories,
      activeDays,
    } = await runSummaryReads({
      currentTotals: () =>
        fetchFinancialData(userId, startDate, endDate),
      previousTotals: () =>
        fetchFinancialData(userId, previous.start, previous.end),
      currentCategories: () =>
        fetchSpendingByCategory(userId, startDate, endDate),
      previousCategories: () =>
        fetchSpendingByCategory(userId, previous.start, previous.end),
      activeDays: fetchActiveDays,
    });
    c.header(
      "Server-Timing",
      `summary-db;dur=${(performance.now() - databaseStartedAt).toFixed(1)}`
    );

    const currentResult = currentTotals[0];
    const previousResult = previousTotals[0];
    const currentPeriod = {
      income: currentResult?.income ?? 0,
      expenses: currentResult?.expenses ?? 0,
      remaining: currentResult?.remaining ?? 0,
    };
    const lastPeriod = {
      income: previousResult?.income ?? 0,
      expenses: previousResult?.expenses ?? 0,
      remaining: previousResult?.remaining ?? 0,
    };

    const incomeChange = calculatePercentageChange(
      currentPeriod.income,
      lastPeriod.income
    );
    const expensesChange = calculatePercentageChange(
      currentPeriod.expenses,
      lastPeriod.expenses
    );
    const remainingChange = calculatePercentageChange(
      currentPeriod.remaining,
      lastPeriod.remaining
    );

    const finalCategories = topCategoryBuckets(currentCategories);
    const days = fillMissingDays(activeDays, startDate, endDate);

    return c.json({
      data: {
        remainingAmount: currentPeriod.remaining,
        remainingChange,
        incomeAmount: currentPeriod.income,
        incomeChange,
        expensesAmount: currentPeriod.expenses,
        expensesChange,
        categories: finalCategories,
        allCategories: currentCategories,
        previousCategories,
        days,
      },
    });
  }
);

export default app;
