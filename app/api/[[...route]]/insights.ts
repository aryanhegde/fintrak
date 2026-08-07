import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { subDays, parse, differenceInDays } from "date-fns";
import { and, desc, eq, gte, lt, lte, sql, sum } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { accounts, categories, transactions } from "@/db/schema";
import { calculatePercentageChange } from "@/lib/utils";
import { buildInsights, computeHealthScore, detectRecurring } from "@/lib/insights";

const app = new Hono().get(
  "/",
  clerkMiddleware(),
  zValidator(
    "query",
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      accountId: z.string().optional(),
    })
  ),
  async (c) => {
    const auth = getAuth(c);
    const { from, to, accountId } = c.req.valid("query");

    if (!auth?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const defaultTo = new Date();
    const defaultFrom = subDays(defaultTo, 30);

    const startDate = from ? parse(from, "yyyy-MM-dd", new Date()) : defaultFrom;
    const endDate = to ? parse(to, "yyyy-MM-dd", new Date()) : defaultTo;

    const periodLength = differenceInDays(endDate, startDate) + 1;
    const lastPeriodStart = subDays(startDate, periodLength);
    const lastPeriodEnd = subDays(endDate, periodLength);

    async function fetchTotals(userId: string, start: Date, end: Date) {
      const [row] = await db
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
            gte(transactions.date, start),
            lte(transactions.date, end)
          )
        );
      return row;
    }

    const [currentPeriod, lastPeriod] = await Promise.all([
      fetchTotals(auth.userId, startDate, endDate),
      fetchTotals(auth.userId, lastPeriodStart, lastPeriodEnd),
    ]);

    const incomeChange = calculatePercentageChange(
      currentPeriod.income,
      lastPeriod.income
    );
    // Compare magnitudes so that positive = spending increased
    const expensesChange = calculatePercentageChange(
      Math.abs(currentPeriod.expenses),
      Math.abs(lastPeriod.expenses)
    );

    const categoryTotals = await db
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
          eq(accounts.userId, auth.userId),
          lt(transactions.amount, 0),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .groupBy(categories.name)
      .orderBy(desc(sql`SUM(ABS(${transactions.amount}))`));

    const topCategories = categoryTotals.slice(0, 5);
    const totalSpending = categoryTotals.reduce((acc, c) => acc + c.value, 0);

    // Recurring detection always scans the last 120 days, independent of the
    // date filter (accountId still applies).
    const recurringWindowStart = subDays(new Date(), 120);
    const recentTxns = await db
      .select({
        payee: transactions.payee,
        amount: transactions.amount,
        date: transactions.date,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          accountId ? eq(transactions.accountId, accountId) : undefined,
          eq(accounts.userId, auth.userId),
          gte(transactions.date, recurringWindowStart)
        )
      )
      .orderBy(transactions.date);

    const recurring = detectRecurring(recentTxns);

    const healthScore = computeHealthScore(
      currentPeriod.income,
      currentPeriod.remaining
    );
    const insights = buildInsights({
      incomeChange,
      expensesChange,
      topCategoryName: topCategories[0]?.name,
      topCategoryShare:
        totalSpending > 0 && topCategories[0]
          ? (topCategories[0].value / totalSpending) * 100
          : undefined,
    });

    return c.json({
      data: {
        healthScore,
        insights,
        recurring,
        topCategories,
      },
    });
  }
);

export default app;
