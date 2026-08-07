# Dashboard Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the dashboard tab — slim blue header, bento-grid layout, restyled stat cards and charts, plus three new insight cards (health score, recurring transactions, top categories) backed by a new `/insights` endpoint.

**Architecture:** Pure insight logic (recurring detection, health score, bullets) lives in `lib/insights.ts` and is unit-tested with vitest. A new Hono route `app/api/[[...route]]/insights.ts` runs the DB queries and calls those functions. A React Query hook feeds three new card components rendered as row 3 of the dashboard grid. Existing components are restyled in place.

**Tech Stack:** Next.js 14 (app router, edge runtime for API), Hono + Clerk auth, Drizzle ORM (Postgres/Neon), TanStack Query, Recharts, Tailwind + shadcn/ui, vitest (new, logic tests only).

**Spec:** `docs/superpowers/specs/2026-08-07-dashboard-refresh-design.md`

## Global Constraints

- Amounts are stored as **miliunits** (integer, `amount / 1000` = display value). API returns miliunits; client hooks convert via `convertAmountFromMiliunits`.
- Negative amount = expense, positive = income.
- Currency formatting is `formatCurrency` in `lib/utils.ts` (INR).
- The API route file must work on **edge runtime** (`export const runtime = "edge"` in `route.ts`) — no Node-only APIs.
- Card baseline style everywhere: `rounded-2xl border border-slate-200/60 bg-white shadow-sm` (replaces `border-none drop-shadow-sm`).
- Accent palette: blue-600/blue-700 primary, rose-500 for expenses, emerald for positive change, slate neutrals.
- Package manager: npm. Type check with `npx tsc --noEmit`.
- Existing client API hooks live in `features/summary/api/`; follow that pattern.

---

### Task 1: Vitest setup + recurring detection logic

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/insights.ts`
- Test: `lib/__tests__/insights.test.ts`
- Modify: `package.json` (add `test` script, vitest devDependency)

**Interfaces:**
- Consumes: nothing (pure logic).
- Produces:
  - `type RecurringInput = { payee: string; amount: number; date: Date }`
  - `type RecurringPayment = { payee: string; amount: number; cadence: "weekly" | "monthly"; nextDate: string }`
  - `detectRecurring(txns: RecurringInput[]): RecurringPayment[]`

- [ ] **Step 1: Install vitest and add config**

```bash
npm install -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["**/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write failing tests for `detectRecurring`**

Create `lib/__tests__/insights.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectRecurring } from "../insights";

const d = (s: string) => new Date(`${s}T00:00:00`);

describe("detectRecurring", () => {
  it("detects a monthly subscription with identical amounts", () => {
    const result = detectRecurring([
      { payee: "Netflix", amount: -15990, date: d("2026-05-15") },
      { payee: "Netflix", amount: -15990, date: d("2026-06-15") },
      { payee: "Netflix", amount: -15990, date: d("2026-07-15") },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      payee: "Netflix",
      amount: -15990,
      cadence: "monthly",
      nextDate: "2026-08-15",
    });
  });

  it("detects weekly payments", () => {
    const result = detectRecurring([
      { payee: "Gym", amount: -5000, date: d("2026-07-01") },
      { payee: "Gym", amount: -5000, date: d("2026-07-08") },
      { payee: "Gym", amount: -5000, date: d("2026-07-15") },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].cadence).toBe("weekly");
    expect(result[0].nextDate).toBe("2026-07-22");
  });

  it("groups payees case-insensitively and tolerates ±10% amount drift", () => {
    const result = detectRecurring([
      { payee: "Spotify", amount: -11900, date: d("2026-06-03") },
      { payee: "spotify ", amount: -12500, date: d("2026-07-03") },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].payee).toBe("spotify");
  });

  it("ignores single occurrences", () => {
    expect(
      detectRecurring([{ payee: "Amazon", amount: -4300, date: d("2026-07-01") }])
    ).toHaveLength(0);
  });

  it("ignores irregular intervals", () => {
    expect(
      detectRecurring([
        { payee: "Cafe", amount: -300, date: d("2026-06-01") },
        { payee: "Cafe", amount: -300, date: d("2026-06-04") },
        { payee: "Cafe", amount: -310, date: d("2026-06-20") },
      ])
    ).toHaveLength(0);
  });

  it("does not merge different amounts for the same payee into one cluster", () => {
    // Rent (big) and a small misc payment to the same payee
    const result = detectRecurring([
      { payee: "Landlord", amount: -1500000, date: d("2026-05-01") },
      { payee: "Landlord", amount: -1500000, date: d("2026-06-01") },
      { payee: "Landlord", amount: -1500000, date: d("2026-07-01") },
      { payee: "Landlord", amount: -20000, date: d("2026-06-12") },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-1500000);
  });

  it("sorts results by nextDate ascending", () => {
    const result = detectRecurring([
      { payee: "B-Sub", amount: -1000, date: d("2026-06-20") },
      { payee: "B-Sub", amount: -1000, date: d("2026-07-20") },
      { payee: "A-Sub", amount: -1000, date: d("2026-06-05") },
      { payee: "A-Sub", amount: -1000, date: d("2026-07-05") },
    ]);
    expect(result.map((r) => r.payee)).toEqual(["A-Sub", "B-Sub"]);
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../insights`.

- [ ] **Step 4: Implement `detectRecurring` in `lib/insights.ts`**

```ts
import { addDays, differenceInCalendarDays, format } from "date-fns";

export type RecurringInput = {
  payee: string;
  amount: number; // miliunits, negative = expense
  date: Date;
};

export type RecurringPayment = {
  payee: string;
  amount: number; // miliunits, from the most recent occurrence
  cadence: "weekly" | "monthly";
  nextDate: string; // yyyy-MM-dd
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

export function detectRecurring(txns: RecurringInput[]): RecurringPayment[] {
  const groups = new Map<string, RecurringInput[]>();
  for (const txn of txns) {
    const key = txn.payee.trim().toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(txn);
    groups.set(key, group);
  }

  const results: RecurringPayment[] = [];

  for (const [key, group] of groups) {
    const sorted = [...group].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    // Cluster by amount: same sign, within ±10% of the cluster's first amount
    const clusters: RecurringInput[][] = [];
    for (const txn of sorted) {
      const cluster = clusters.find((c) => {
        const ref = c[0].amount;
        if (Math.sign(ref) !== Math.sign(txn.amount)) return false;
        const refAbs = Math.abs(ref);
        return refAbs > 0 && Math.abs(Math.abs(txn.amount) - refAbs) / refAbs <= 0.1;
      });
      if (cluster) cluster.push(txn);
      else clusters.push([txn]);
    }

    for (const cluster of clusters) {
      if (cluster.length < 2) continue;

      const gaps: number[] = [];
      for (let i = 1; i < cluster.length; i++) {
        gaps.push(differenceInCalendarDays(cluster[i].date, cluster[i - 1].date));
      }
      const medianGap = median(gaps);

      let cadence: RecurringPayment["cadence"] | null = null;
      let tolerance = 0;
      if (medianGap >= 6 && medianGap <= 8) {
        cadence = "weekly";
        tolerance = 2;
      } else if (medianGap >= 25 && medianGap <= 35) {
        cadence = "monthly";
        tolerance = 5;
      }
      if (!cadence) continue;

      const stable = gaps.every((g) => Math.abs(g - medianGap) <= tolerance);
      if (!stable) continue;

      const last = cluster[cluster.length - 1];
      results.push({
        payee: key,
        amount: last.amount,
        cadence,
        nextDate: format(addDays(last.date, Math.round(medianGap)), "yyyy-MM-dd"),
      });
    }
  }

  return results.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm test`
Expected: all `detectRecurring` tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/insights.ts lib/__tests__/insights.test.ts
git commit -m "feat: add recurring-payment detection with vitest setup"
```

---

### Task 2: Health score + insight bullets

**Files:**
- Modify: `lib/insights.ts`
- Test: `lib/__tests__/insights.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `computeHealthScore(income: number, remaining: number): number` — 0–100.
  - `buildInsights(params: { incomeChange: number; expensesChange: number; topCategoryName?: string; topCategoryShare?: number }): string[]` — 1–3 plain-English bullets. `topCategoryShare` is 0–100.

- [ ] **Step 1: Write failing tests (append to `lib/__tests__/insights.test.ts`)**

```ts
import { buildInsights, computeHealthScore } from "../insights";

describe("computeHealthScore", () => {
  it("returns the savings rate as a rounded percentage", () => {
    expect(computeHealthScore(100000, 72000)).toBe(72);
  });
  it("returns 0 when income is 0", () => {
    expect(computeHealthScore(0, 0)).toBe(0);
  });
  it("clamps to 0 when spending exceeds income", () => {
    expect(computeHealthScore(100000, -20000)).toBe(0);
  });
  it("clamps to 100 maximum", () => {
    expect(computeHealthScore(100000, 150000)).toBe(100);
  });
});

describe("buildInsights", () => {
  it("mentions income trend, expense trend, and top category", () => {
    const bullets = buildInsights({
      incomeChange: 12.4,
      expensesChange: -8.2,
      topCategoryName: "Food",
      topCategoryShare: 38.5,
    });
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toBe("Income is up 12% vs last period");
    expect(bullets[1]).toBe("Spending is down 8% vs last period");
    expect(bullets[2]).toBe("Food makes up 39% of your spending");
  });

  it("omits the category bullet when there is no top category", () => {
    const bullets = buildInsights({ incomeChange: 0, expensesChange: 0 });
    expect(bullets).toEqual([
      "Income is flat vs last period",
      "Spending is flat vs last period",
    ]);
  });
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npm test`
Expected: FAIL — `computeHealthScore` / `buildInsights` not exported.

- [ ] **Step 3: Implement (append to `lib/insights.ts`)**

```ts
export function computeHealthScore(income: number, remaining: number): number {
  if (income <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((remaining / income) * 100)));
}

const trendBullet = (label: string, change: number) => {
  const pct = Math.abs(Math.round(change));
  if (pct === 0) return `${label} is flat vs last period`;
  return `${label} is ${change > 0 ? "up" : "down"} ${pct}% vs last period`;
};

export function buildInsights(params: {
  incomeChange: number;
  expensesChange: number;
  topCategoryName?: string;
  topCategoryShare?: number;
}): string[] {
  const bullets = [
    trendBullet("Income", params.incomeChange),
    trendBullet("Spending", params.expensesChange),
  ];
  if (params.topCategoryName && params.topCategoryShare !== undefined) {
    bullets.push(
      `${params.topCategoryName} makes up ${Math.round(
        params.topCategoryShare
      )}% of your spending`
    );
  }
  return bullets;
}
```

Note: `expensesChange` from the summary-style queries is computed on negative
totals, so a positive change value means spending *decreased in magnitude*
only if the sign convention matches — Task 3 passes
`calculatePercentageChange(Math.abs(currentExpenses), Math.abs(lastExpenses))`
so that positive = spending up. Do not change this contract.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/insights.ts lib/__tests__/insights.test.ts
git commit -m "feat: add health score and insight bullet builders"
```

---

### Task 3: /insights API route + client hook

**Files:**
- Create: `app/api/[[...route]]/insights.ts`
- Modify: `app/api/[[...route]]/route.ts` (mount route)
- Create: `features/summary/api/use-get-insights.ts`

**Interfaces:**
- Consumes: `detectRecurring`, `computeHealthScore`, `buildInsights` from `@/lib/insights` (Task 1–2 signatures).
- Produces:
  - `GET /api/insights?from&to&accountId` → `{ data: { healthScore: number; insights: string[]; recurring: RecurringPayment[]; topCategories: { name: string; value: number }[] } }` (amounts/values in miliunits; `topCategories.value` positive).
  - `useGetInsights()` React Query hook returning that shape with amounts converted to display units (`recurring[].amount`, `topCategories[].value`).

- [ ] **Step 1: Create `app/api/[[...route]]/insights.ts`**

```ts
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

    async function fetchTotals(start: Date, end: Date) {
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
            eq(accounts.userId, auth!.userId),
            gte(transactions.date, start),
            lte(transactions.date, end)
          )
        );
      return row;
    }

    const [currentPeriod, lastPeriod] = await Promise.all([
      fetchTotals(startDate, endDate),
      fetchTotals(lastPeriodStart, lastPeriodEnd),
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
```

- [ ] **Step 2: Mount in `app/api/[[...route]]/route.ts`**

Add `import insights from "./insights";` and chain `.route("/insights", insights)` after `.route("/summary", summary)`.

- [ ] **Step 3: Create `features/summary/api/use-get-insights.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { client } from "@/lib/hono";
import { convertAmountFromMiliunits } from "@/lib/utils";

export const useGetInsights = () => {
  const params = useSearchParams();
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const accountId = params.get("accountId") || "";

  const query = useQuery({
    queryKey: ["insights", { from, to, accountId }],
    queryFn: async () => {
      const response = await client.api.insights.$get({
        query: { from, to, accountId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch insights");
      }

      const { data } = await response.json();
      return {
        ...data,
        recurring: data.recurring.map((r) => ({
          ...r,
          amount: convertAmountFromMiliunits(r.amount),
        })),
        topCategories: data.topCategories.map((cat) => ({
          ...cat,
          value: convertAmountFromMiliunits(cat.value),
        })),
      };
    },
  });

  return query;
};
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors. (If `client.api.insights` is not typed, verify the route was chained into the `routes` variable in `route.ts` — the `AppType` export drives the client types.)

- [ ] **Step 5: Commit**

```bash
git add "app/api/[[...route]]/insights.ts" "app/api/[[...route]]/route.ts" features/summary/api/use-get-insights.ts
git commit -m "feat: add /insights endpoint and client hook"
```

---

### Task 4: Slim header + page shell

**Files:**
- Modify: `components/header.tsx`
- Modify: `components/welcome-msg.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: page content no longer overlaps the header (`-mt-24` removed on ALL dashboard pages — accounts, categories, transactions, settings pages keep working because they use their own `-mt-24` containers; see Step 4).

- [ ] **Step 1: Rewrite `components/header.tsx`**

```tsx
import React from "react";
import { HeaderLogo } from "./header-logo";
import { Navigation } from "./navigation";
import { ClerkLoaded, ClerkLoading, UserButton } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { WelcomeMsg } from "./welcome-msg";
import { Filters } from "./filters";

const Header = () => {
  return (
    <header className="bg-gradient-to-b from-blue-700 to-blue-600 px-4 py-6 lg:px-14">
      <div className="max-w-screen-2xl mx-auto">
        <div className="w-full flex items-center justify-between mb-8">
          <div className="flex items-center lg:gap-x-16">
            <HeaderLogo />
            <Navigation />
          </div>
          <ClerkLoaded>
            <UserButton />
          </ClerkLoaded>
          <ClerkLoading>
            <Loader2 className="size-8 animate-spin text-slate-400" />
          </ClerkLoading>
        </div>
        <div className="flex flex-col gap-y-4 lg:flex-row lg:items-end lg:justify-between">
          <WelcomeMsg />
          <Filters />
        </div>
      </div>
    </header>
  );
};

export default Header;
```

- [ ] **Step 2: Shrink `components/welcome-msg.tsx` type scale**

Replace the two text elements' classes:

```tsx
<div className="space-y-1">
  <h2 className="text-xl lg:text-2xl font-semibold text-white">
    Welcome Back{isLoaded ? ", " : " "}
    {user?.firstName}
  </h2>
  <p className="text-sm text-blue-200">This is your financial overview</p>
</div>
```

(Keep `"use client"` and the `useUser` logic unchanged. Note: `welcome-msg.tsx` has uncommitted changes on this branch — read the current file first and apply the class changes to what is actually there.)

- [ ] **Step 3: Page background in `app/(dashboard)/layout.tsx`**

```tsx
const DashboardLayout = ({ children }: Props) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="px-3 lg:px-14">{children}</main>
    </div>
  );
};
```

(Keep the `force-dynamic` export and comment.)

- [ ] **Step 4: Fix page containers**

In `app/(dashboard)/page.tsx` change the wrapper to:

```tsx
<div className="max-w-screen-2xl mx-auto w-full py-8 pb-10">
```

The other dashboard pages (`accounts`, `categories`, `transactions`, `settings`) each have their own `-mt-24` wrapper that assumed the tall header. Update each page's top-level wrapper from `-mt-24` to `py-8` (search for `-mt-24` across `app/(dashboard)/`). Keep their `max-w-screen-2xl mx-auto w-full pb-10` classes.

- [ ] **Step 5: Verify visually**

Run the dev server via the launch config, open the dashboard, and confirm: slim blue band, welcome + filters on one row (desktop), no card overlap, soft gray page background, and the accounts/categories/transactions/settings pages have sane top spacing.

- [ ] **Step 6: Commit**

```bash
git add components/header.tsx components/welcome-msg.tsx "app/(dashboard)/"
git commit -m "feat: slim down header and move dashboard onto soft neutral shell"
```

---

### Task 5: Stat card restyle

**Files:**
- Modify: `components/data-card.tsx`

**Interfaces:**
- Consumes: same `DataCardProps` (unchanged — `data-grid.tsx` needs no edits).
- Produces: same exports `DataCard`, `DataCardLoading`.

- [ ] **Step 1: Restyle `DataCard`**

Replace the component body (keep the cva variants and props):

```tsx
export const DataCard = ({
  icon: Icon,
  title,
  value = 0,
  variant,
  dateRange,
  percentageChange = 0,
}: DataCardProps) => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-x-4 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </CardTitle>
          <CardDescription className="text-xs line-clamp-1">
            {dateRange}
          </CardDescription>
        </div>
        <div className={cn(boxVariant({ variant }))}>
          <Icon className={cn(iconVariant({ variant }))} />
        </div>
      </CardHeader>
      <CardContent>
        <h1 className="font-bold text-3xl tabular-nums mb-3 line-clamp-1 break-all">
          <CountUp
            preserveValue
            start={0}
            end={value}
            decimals={2}
            decimalPlaces={2}
            formattingFn={formatCurrency}
          />
        </h1>
        <div className="flex items-center gap-x-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              percentageChange > 0 && "bg-emerald-100 text-emerald-700",
              percentageChange < 0 && "bg-rose-100 text-rose-700",
              percentageChange === 0 && "bg-slate-100 text-slate-600"
            )}
          >
            {formatPercentage(percentageChange, { addPrefix: true })}
          </span>
          <span className="text-xs text-muted-foreground">vs last period</span>
        </div>
      </CardContent>
    </Card>
  );
};
```

Update the cva variants to smaller circular icon chips:

```ts
const boxVariant = cva("shrink-0 rounded-full p-2.5", {
  variants: {
    variant: {
      default: "bg-blue-500/15",
      success: "bg-emerald-500/15",
      danger: "bg-rose-500/15",
      warning: "bg-yellow-500/15",
    },
  },
  defaultVariants: { variant: "default" },
});

const iconVariant = cva("size-5", {
  /* fills unchanged */
});
```

- [ ] **Step 2: Fix `DataCardLoading`**

Apply the same card baseline and fix the existing typos (`borer-none`, `jsutify-between`):

```tsx
<Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm h-[178px]">
  <CardHeader className="flex flex-row items-center justify-between gap-x-4">
    ...
```

(Skeleton children unchanged; icon skeleton becomes `size-10 rounded-full`.)

- [ ] **Step 3: Type check + visual check**

Run: `npx tsc --noEmit`, then check the three cards in the browser: pill badges tinted, tabular numbers, subtle border.

- [ ] **Step 4: Commit**

```bash
git add components/data-card.tsx
git commit -m "feat: restyle stat cards with pill change badges"
```

---

### Task 6: Cashflow chart restyle

**Files:**
- Modify: `components/chart.tsx`
- Modify: `components/area-variant.tsx`
- Modify: `components/line-variant.tsx`
- Modify: `components/bar-variant.tsx`
- Modify: `components/custom-tooltip.tsx`

**Interfaces:**
- Consumes: `data: { date: string; income: number; expenses: number }[]` (unchanged).
- Produces: same exports; `Chart` card title becomes "Cashflow".

- [ ] **Step 1: Card chrome in `chart.tsx`**

- `Card` className → `rounded-2xl border border-slate-200/60 bg-white shadow-sm`.
- `CardTitle` text → `Cashflow`, className → `text-lg font-semibold line-clamp-1`.
- Same changes in `ChartLoading`.

- [ ] **Step 2: Rewrite `area-variant.tsx`**

```tsx
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CustomTooltip } from "./custom-tooltip";

type Props = {
  data?: {
    date: string;
    income: number;
    expenses: number;
  }[];
};

export const AreaVariant = ({ data }: Props) => {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="4 4"
          vertical={false}
          stroke="#e2e8f0"
        />
        <defs>
          <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
            <stop offset="2%" stopColor="#2563eb" stopOpacity={0.35} />
            <stop offset="98%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="2%" stopColor="#f43f5e" stopOpacity={0.3} />
            <stop offset="98%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          axisLine={false}
          tickLine={false}
          dataKey="date"
          tickFormatter={(value) => format(value, "dd MMM")}
          style={{ fontSize: "12px" }}
          tick={{ fill: "#94a3b8" }}
          tickMargin={16}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={40}
          style={{ fontSize: "12px" }}
          tick={{ fill: "#94a3b8" }}
          tickFormatter={(value) =>
            Intl.NumberFormat("en-US", { notation: "compact" }).format(value)
          }
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} />
        <Area
          type="monotone"
          dataKey="income"
          stackId="income"
          strokeWidth={2.5}
          stroke="#2563eb"
          fill="url(#income)"
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stackId="expenses"
          strokeWidth={2.5}
          stroke="#f43f5e"
          fill="url(#expenses)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
```

(Note: this also fixes an existing bug — the expenses stroke was blue.)

- [ ] **Step 3: Matching treatment in `line-variant.tsx` and `bar-variant.tsx`**

Read each file, then apply the same changes: `CartesianGrid` dashed horizontal-only with `stroke="#e2e8f0"`; XAxis (and add YAxis identical to Step 2); line/bar colors `#2563eb` (income) and `#f43f5e` (expenses); `strokeWidth={2.5}` on lines; bars get `radius={[4, 4, 0, 0]}` and the same gradient fills as Step 2 (`fill="url(#income)"` / `fill="url(#expenses)"` with the same `<defs>` block).

- [ ] **Step 4: Restyle `custom-tooltip.tsx`**

```tsx
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;

  const date = payload[0].payload.date;
  const income = payload[0].value;
  const expenses = payload[1]?.value ?? 0;

  return (
    <div className="rounded-xl bg-white shadow-lg border border-slate-100 overflow-hidden min-w-[180px]">
      <div className="text-xs font-medium p-2 px-3 text-muted-foreground">
        {format(date, "dd MMM, yyyy")}
      </div>
      <div className="p-2 px-3 pt-0 space-y-1.5">
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex items-center gap-x-2">
            <div className="size-2 bg-blue-600 rounded-full" />
            <p className="text-sm text-muted-foreground">Income</p>
          </div>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(income)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex items-center gap-x-2">
            <div className="size-2 bg-rose-500 rounded-full" />
            <p className="text-sm text-muted-foreground">Expenses</p>
          </div>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(expenses * -1)}
          </p>
        </div>
      </div>
    </div>
  );
};
```

(The `Separator` import is dropped — remove it.)

- [ ] **Step 5: Type check + visual check**

Run: `npx tsc --noEmit`. In the browser, cycle through area/line/bar chart types; confirm gradient fills, dashed gridlines, compact Y axis, and the floating tooltip card.

- [ ] **Step 6: Commit**

```bash
git add components/chart.tsx components/area-variant.tsx components/line-variant.tsx components/bar-variant.tsx components/custom-tooltip.tsx
git commit -m "feat: restyle cashflow chart with gradients and refined axes"
```

---

### Task 7: Categories donut restyle

**Files:**
- Modify: `components/spending-pie.tsx`
- Modify: `components/pie-variant.tsx`
- Modify: `components/category-tooltip.tsx`
- Modify: `components/radar-variant.tsx`
- Modify: `components/radial-variant.tsx`

**Interfaces:**
- Consumes: `data: { name: string; value: number }[]` (unchanged).
- Produces: same exports.

- [ ] **Step 1: Card chrome in `spending-pie.tsx`**

`Card` className → `rounded-2xl border border-slate-200/60 bg-white shadow-sm`; `CardTitle` → `text-lg font-semibold line-clamp-1`. Same in `SpendingPieLoading`.

- [ ] **Step 2: Rewrite `pie-variant.tsx` as a segmented donut with pill labels**

```tsx
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { CategoryTooltip } from "./category-tooltip";

const COLORS = ["#2563eb", "#60a5fa", "#93c5fd", "#cbd5e1", "#e2e8f0"];

const RADIAN = Math.PI / 180;

const renderPillLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  if (percent < 0.05) return null;
  const radius = (innerRadius + outerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const label = `${Math.round(percent * 100)}%`;
  const width = label.length * 7 + 14;

  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={x - width / 2}
        y={y - 11}
        width={width}
        height={22}
        rx={11}
        fill="#ffffff"
        stroke="#e2e8f0"
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={600}
        fill="#0f172a"
      >
        {label}
      </text>
    </g>
  );
};

type Props = {
  data: {
    name: string;
    value: number;
  }[];
};

export const PieVariant = ({ data }: Props) => {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          iconType="circle"
          content={({ payload }: any) => {
            return (
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-4">
                {payload.map((entry: any, index: number) => (
                  <li
                    key={`item-${index}`}
                    className="flex items-center gap-x-2"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {entry.value}
                    </span>
                  </li>
                ))}
              </ul>
            );
          }}
        />
        <Tooltip content={<CategoryTooltip />} />
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={65}
          paddingAngle={4}
          cornerRadius={6}
          dataKey="value"
          labelLine={false}
          label={renderPillLabel}
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};
```

(`formatPercentage` import is no longer used — remove it.)

- [ ] **Step 3: Restyle `category-tooltip.tsx`**

Read the file; apply the same visual language as `custom-tooltip.tsx` Step 4 of Task 6: `rounded-xl bg-white shadow-lg border border-slate-100`, date/title line as small muted text, amount as `text-sm font-semibold tabular-nums`.

- [ ] **Step 4: Update `radar-variant.tsx` and `radial-variant.tsx` colors**

Read each file; replace any hardcoded fill/stroke colors with the new palette (`#2563eb` primary, and for radial rings use the `COLORS` array values from Step 2). Layout/props otherwise unchanged.

- [ ] **Step 5: Type check + visual check**

Run: `npx tsc --noEmit`. In the browser: donut has visible gaps between rounded segments, white pill percentage badges on slices, centered wrapped legend below; radar/radial variants use the new colors.

- [ ] **Step 6: Commit**

```bash
git add components/spending-pie.tsx components/pie-variant.tsx components/category-tooltip.tsx components/radar-variant.tsx components/radial-variant.tsx
git commit -m "feat: restyle categories chart as segmented donut with pill labels"
```

---

### Task 8: New insight cards + page wiring

**Files:**
- Create: `components/health-score-card.tsx`
- Create: `components/recurring-card.tsx`
- Create: `components/top-categories-card.tsx`
- Create: `components/data-insights.tsx`
- Modify: `app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `useGetInsights()` from Task 3 (display-unit amounts), `formatCurrency` from `@/lib/utils`.
- Produces: `DataInsights` client component rendering row 3.

- [ ] **Step 1: Create `components/health-score-card.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

const TICKS = 40;

const TickDial = ({ score }: { score: number }) => {
  const filledCount = Math.round((score / 100) * TICKS);
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        {Array.from({ length: TICKS }).map((_, i) => {
          const angle = (i / TICKS) * 2 * Math.PI;
          const x1 = 60 + 44 * Math.cos(angle);
          const y1 = 60 + 44 * Math.sin(angle);
          const x2 = 60 + 56 * Math.cos(angle);
          const y2 = 60 + 56 * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={i < filledCount ? "#2563eb" : "#e2e8f0"}
              strokeWidth={3.5}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{score}%</span>
        <span className="text-xs text-muted-foreground">Saved</span>
      </div>
    </div>
  );
};

type Props = {
  score: number;
  insights: string[];
};

export const HealthScoreCard = ({ score, insights }: Props) => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold line-clamp-1">
          Financial Health
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-x-6">
        <TickDial score={score} />
        <ul className="space-y-2.5">
          {insights.map((insight) => (
            <li key={insight} className="flex items-start gap-x-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-600" />
              <span className="text-sm text-slate-600">{insight}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export const HealthScoreCardLoading = () => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="flex items-center gap-x-6">
        <Skeleton className="size-36 rounded-full shrink-0" />
        <div className="w-full space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 2: Create `components/recurring-card.tsx`**

```tsx
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { formatCurrency } from "@/lib/utils";

type Props = {
  recurring: {
    payee: string;
    amount: number; // display units, negative = expense
    cadence: "weekly" | "monthly";
    nextDate: string;
  }[];
};

export const RecurringCard = ({ recurring }: Props) => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold line-clamp-1">
          Recurring Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recurring.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No recurring payments detected yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {recurring.slice(0, 5).map((item) => (
              <li
                key={`${item.payee}-${item.amount}`}
                className="flex items-center gap-x-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-700 uppercase">
                  {item.payee.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize">
                    {item.payee}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Next: {format(new Date(item.nextDate), "MMM d")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(Math.abs(item.amount))}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {item.cadence}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export const RecurringCardLoading = () => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-x-3">
            <Skeleton className="size-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 3: Create `components/top-categories-card.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { formatCurrency } from "@/lib/utils";

type Props = {
  categories: {
    name: string;
    value: number; // display units, positive
  }[];
};

export const TopCategoriesCard = ({ categories }: Props) => {
  const max = categories[0]?.value ?? 0;

  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold line-clamp-1">
          Top Spending
        </CardTitle>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No spending in this period.
          </p>
        ) : (
          <ul className="space-y-4">
            {categories.map((category) => (
              <li key={category.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="truncate text-sm font-medium">
                    {category.name}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(category.value)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{
                      width: `${max > 0 ? (category.value / max) * 100 : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export const TopCategoriesCardLoading = () => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 4: Create `components/data-insights.tsx`**

```tsx
"use client";

import { useGetInsights } from "@/features/summary/api/use-get-insights";
import {
  HealthScoreCard,
  HealthScoreCardLoading,
} from "./health-score-card";
import { RecurringCard, RecurringCardLoading } from "./recurring-card";
import {
  TopCategoriesCard,
  TopCategoriesCardLoading,
} from "./top-categories-card";

export const DataInsights = () => {
  const { data, isLoading } = useGetInsights();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <HealthScoreCardLoading />
        <RecurringCardLoading />
        <TopCategoriesCardLoading />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
      <HealthScoreCard
        score={data?.healthScore ?? 0}
        insights={data?.insights ?? []}
      />
      <RecurringCard recurring={data?.recurring ?? []} />
      <TopCategoriesCard categories={data?.topCategories ?? []} />
    </div>
  );
};
```

- [ ] **Step 5: Wire into `app/(dashboard)/page.tsx`**

```tsx
import { DataCharts } from "@/components/data-charts";
import { DataGrid } from "@/components/data-grid";
import { DataInsights } from "@/components/data-insights";

export default function DashboardPage() {
  return (
    <div className="max-w-screen-2xl mx-auto w-full py-8 pb-10">
      <DataGrid />
      <DataCharts />
      <DataInsights />
    </div>
  );
}
```

- [ ] **Step 6: Type check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add components/health-score-card.tsx components/recurring-card.tsx components/top-categories-card.tsx components/data-insights.tsx "app/(dashboard)/page.tsx"
git commit -m "feat: add health score, recurring, and top spending insight cards"
```

---

### Task 9: Full verification

**Files:** none new.

- [ ] **Step 1: Run the full checks**

```bash
npm test && npx tsc --noEmit && npm run build
```

Expected: tests pass, no type errors, production build succeeds.

- [ ] **Step 2: Browser verification**

Start the dev server via the launch config. Verify on the dashboard:
1. Slim header, no overlap, soft gray background.
2. Row 1: three restyled stat cards with pill badges.
3. Row 2: gradient cashflow chart (cycle area/line/bar) + segmented donut with pill labels (cycle pie/radar/radial).
4. Row 3: health dial with bullets, recurring list (or empty state), top spending bars.
5. Change the date filter and account filter — rows 1–3 update; recurring list stays stable (filter-independent).
6. Check accounts, categories, transactions, settings pages for sane top spacing.
7. Narrow the window to mobile width — cards stack in one column.

- [ ] **Step 3: Screenshot the refreshed dashboard for the user**

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: dashboard refresh polish from verification pass"
```

(Only if fixes were needed.)
