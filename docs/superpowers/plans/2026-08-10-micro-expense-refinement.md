# Micro-Expense Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn fintrak into a friction-free micro-expense tracker: 3-second quick-add on mobile, monthly per-category breakdown as the home screen, accounts hidden behind a default, payee optional.

**Architecture:** Next.js 15 App Router + Hono RPC API (`app/api/[[...route]]/`) + Drizzle/Neon + Clerk + React Query + zustand sheet stores. Feature folders under `features/<name>/{api,components,hooks}`. Amounts are integer **miliunits** (₹10 = 10000); **expenses are negative**, income positive. Spec: `docs/superpowers/specs/2026-08-10-micro-expense-refinement-design.md`.

**Tech Stack:** bun, drizzle-kit migrations, vitest (pure unit tests only, pattern `**/__tests__/**/*.test.ts`), zod + drizzle-zod, hono RPC client (`@/lib/hono`), sonner toasts, tailwind + shadcn/ui.

## Global Constraints

- Currency formatting only via `formatCurrency` from `@/lib/utils` (INR).
- Miliunits conversion only via `convertAmountToMiliunits` / `convertAmountFromMiliunits` (`×1000` / `÷1000`).
- Visual language (from `docs/superpowers/specs/2026-08-08-transactions-redesign-design.md`): card shell `rounded-2xl border border-slate-200/60 bg-white shadow-sm`, hairlines `border-slate-100`, micro-labels `text-[11px] font-semibold uppercase tracking-wider text-slate-400`, accent `blue-600`, `tabular-nums` for numeric columns.
- Do NOT touch `components/data-table.tsx` (still serves accounts/categories pages).
- Transaction dates are stored at **local midnight** (`startOfDay`) — quick-add must follow this convention or month-boundary queries will drop late-evening entries.
- Verification commands: `bun run test` (vitest), `bunx tsc --noEmit`, `bun run lint`.
- Migrations: `bun run db:generate` then `bun run db:migrate`.
- The working tree already has uncommitted changes in `components/navigation.tsx`, `lib/hono.ts`, `middleware.ts` (unrelated in-flight work). Do not revert them. When a task modifies `components/navigation.tsx`, the pending 2-line change rides along in that commit — that is acceptable.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Make `payee` nullable (schema + migration)

**Files:**
- Modify: `db/schema.ts:31`
- Create: `db/__tests__/schema.test.ts`
- Generated: `drizzle/0001_*.sql` (via drizzle-kit)

**Interfaces:**
- Produces: `transactions.payee` column nullable; `insertTransactionSchema` accepts objects without `payee`. All later tasks rely on payee being optional in `insertTransactionSchema`.

- [ ] **Step 1: Write the failing test**

Create `db/__tests__/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { insertTransactionSchema } from "@/db/schema";

describe("insertTransactionSchema", () => {
  const base = {
    id: "txn_1",
    amount: -10000,
    date: new Date("2026-08-10"),
    accountId: "acc_1",
  };

  it("accepts a transaction without payee", () => {
    const result = insertTransactionSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts an explicit null payee", () => {
    const result = insertTransactionSchema.safeParse({ ...base, payee: null });
    expect(result.success).toBe(true);
  });

  it("still accepts a payee string", () => {
    const result = insertTransactionSchema.safeParse({ ...base, payee: "Tea stall" });
    expect(result.success).toBe(true);
  });

  it("coerces ISO string dates", () => {
    const result = insertTransactionSchema.safeParse({
      ...base,
      date: "2026-08-10T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test db/__tests__/schema.test.ts`
Expected: FAIL — "accepts a transaction without payee" and "accepts an explicit null payee" fail because `payee` is `.notNull()`.

- [ ] **Step 3: Make payee nullable in the schema**

In `db/schema.ts`, change line 31 from:

```ts
  payee: text("payee").notNull(),
```

to:

```ts
  payee: text("payee"),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test db/__tests__/schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Generate and run the migration**

```bash
bun run db:generate
bun run db:migrate
```

Expected: a new file `drizzle/0001_*.sql` containing `ALTER TABLE "transactions" ALTER COLUMN "payee" DROP NOT NULL;`, and the migrate script exits 0. If `db:migrate` fails because no database is reachable, stop and report — do not fake success.

- [ ] **Step 6: Full check + commit**

```bash
bun run test && bunx tsc --noEmit
git add db/schema.ts db/__tests__/schema.test.ts drizzle/
git commit -m "feat(db): make transaction payee nullable

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Month-range utilities

**Files:**
- Create: `lib/month.ts`
- Create: `lib/__tests__/month.test.ts`

**Interfaces:**
- Produces (used by Tasks 6–7):
  - `monthRange(month: string): { from: string; to: string }` — `"2026-08"` → `{ from: "2026-08-01", to: "2026-08-31" }` (`yyyy-MM-dd`, matching the summary API's parse format)
  - `prevMonth(month: string): string` — `"2026-01"` → `"2025-12"`
  - `nextMonth(month: string): string` — `"2025-12"` → `"2026-01"`
  - `monthLabel(month: string): string` — `"2026-08"` → `"August 2026"`
  - `currentMonth(now?: Date): string` — `"yyyy-MM"` of `now` (defaults to `new Date()`)

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/month.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  currentMonth,
  monthLabel,
  monthRange,
  nextMonth,
  prevMonth,
} from "@/lib/month";

describe("monthRange", () => {
  it("returns first and last day of a 31-day month", () => {
    expect(monthRange("2026-08")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("handles February in a leap year", () => {
    expect(monthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("handles February in a non-leap year", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("prevMonth / nextMonth", () => {
  it("rolls back over a year boundary", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
  });

  it("rolls forward over a year boundary", () => {
    expect(nextMonth("2025-12")).toBe("2026-01");
  });

  it("moves within a year", () => {
    expect(prevMonth("2026-08")).toBe("2026-07");
    expect(nextMonth("2026-08")).toBe("2026-09");
  });
});

describe("monthLabel", () => {
  it("formats a human-readable label", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
  });
});

describe("currentMonth", () => {
  it("formats the given date as yyyy-MM", () => {
    expect(currentMonth(new Date("2026-08-10"))).toBe("2026-08");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test lib/__tests__/month.test.ts`
Expected: FAIL — module `@/lib/month` not found.

- [ ] **Step 3: Implement `lib/month.ts`**

```ts
import {
  addMonths,
  endOfMonth,
  format,
  parse,
  startOfMonth,
  subMonths,
} from "date-fns";

function parseMonth(month: string) {
  return parse(month, "yyyy-MM", new Date());
}

export function monthRange(month: string) {
  const date = parseMonth(month);
  return {
    from: format(startOfMonth(date), "yyyy-MM-dd"),
    to: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function prevMonth(month: string) {
  return format(subMonths(parseMonth(month), 1), "yyyy-MM");
}

export function nextMonth(month: string) {
  return format(addMonths(parseMonth(month), 1), "yyyy-MM");
}

export function monthLabel(month: string) {
  return format(parseMonth(month), "MMMM yyyy");
}

export function currentMonth(now: Date = new Date()) {
  return format(now, "yyyy-MM");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test lib/__tests__/month.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/month.ts lib/__tests__/month.test.ts
git commit -m "feat(lib): month range/navigation utilities

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Default account helper + accountId-optional transaction POST

**Files:**
- Create: `lib/default-account.ts`
- Modify: `app/api/[[...route]]/transactions.ts:116-141` (the POST `/` handler)

**Interfaces:**
- Consumes: nullable `payee` from Task 1 (`insertTransactionSchema` no longer requires it).
- Produces:
  - `ensureDefaultAccount(userId: string): Promise<{ id: string; name: string }>` — returns the user's first account, creating one named `"Cash"` if none exists. Server-side only (imports `@/db/drizzle`).
  - `POST /api/transactions` accepts a body **without** `accountId` and **without** `payee`; the handler fills `accountId` from `ensureDefaultAccount`. If a client *does* send `accountId`, the handler verifies it belongs to the user and returns 403 otherwise. Quick-add (Task 6) relies on this.

- [ ] **Step 1: Create `lib/default-account.ts`**

```ts
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

import { db } from "@/db/drizzle";
import { accounts } from "@/db/schema";

const DEFAULT_ACCOUNT_NAME = "Cash";

export async function ensureDefaultAccount(userId: string) {
  const [existing] = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(accounts)
    .values({ id: createId(), name: DEFAULT_ACCOUNT_NAME, userId })
    .returning({ id: accounts.id, name: accounts.name });

  return created;
}
```

(No unit test — this is a thin DB wrapper and the project has no DB test harness. It is exercised end-to-end in Task 6's verification.)

- [ ] **Step 2: Rework the POST `/` validator and handler in `app/api/[[...route]]/transactions.ts`**

Add the import at the top of the file:

```ts
import { ensureDefaultAccount } from "@/lib/default-account";
```

Replace the existing `.post("/", ...)` route (currently `insertTransactionSchema.omit({ id: true })` and a straight insert) with:

```ts
  .post(
    "/",
    clerkMiddleware(),
    zValidator(
      "json",
      insertTransactionSchema
        .omit({
          id: true,
          accountId: true,
        })
        .extend({
          accountId: z.string().optional(),
        })
    ),
    async (c) => {
      const auth = getAuth(c);
      const values = c.req.valid("json");

      if (!auth?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      let accountId = values.accountId;
      if (accountId) {
        const [owned] = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.id, accountId), eq(accounts.userId, auth.userId)));
        if (!owned) {
          return c.json({ error: "Account not found" }, 403);
        }
      } else {
        accountId = (await ensureDefaultAccount(auth.userId)).id;
      }

      const [data] = await db
        .insert(transactions)
        .values({
          id: createId(),
          ...values,
          accountId,
        })
        .returning();

      return c.json({ data });
    }
  )
```

Keep the rest of the handler chain (bulk-create, bulk-delete, PATCH, DELETE) untouched.

- [ ] **Step 3: Typecheck and test**

Run: `bunx tsc --noEmit && bun run test`
Expected: clean. (The hono RPC client types now mark `accountId` and `payee` optional in `POST /api/transactions` — existing callers pass both, which remains valid.)

- [ ] **Step 4: Commit**

```bash
git add lib/default-account.ts "app/api/[[...route]]/transactions.ts"
git commit -m "feat(api): default Cash account; accountId optional on transaction create

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Category bootstrap endpoint + client hook

**Files:**
- Modify: `app/api/[[...route]]/categories.ts` (add POST `/bootstrap` immediately after the `.get("/", ...)` route)
- Create: `features/categories/api/use-bootstrap-categories.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_CATEGORY_NAMES: string[]` exported from `app/api/[[...route]]/categories.ts` — `["Tea", "Cigarettes", "Food", "Snacks", "Travel", "Other"]`.
  - `POST /api/categories/bootstrap` — idempotent: creates the six defaults only when the user has zero categories; responds `{ data: { id, name }[] }` (empty array when nothing was created).
  - `useBootstrapCategories()` — React Query mutation, invalidates `["categories"]` on success. Task 6's quick-add sheet calls it when the category list loads empty.

- [ ] **Step 1: Add the bootstrap route**

In `app/api/[[...route]]/categories.ts`, add above the `const app = ...` chain:

```ts
export const DEFAULT_CATEGORY_NAMES = [
  "Tea",
  "Cigarettes",
  "Food",
  "Snacks",
  "Travel",
  "Other",
];
```

Then insert this route into the chain directly after the `.get("/", ...)` handler (before `.get("/:id", ...)`, so the literal path is registered ahead of the param route):

```ts
  .post("/bootstrap", clerkMiddleware(), async (c) => {
    const auth = getAuth(c);

    if (!auth?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.userId, auth.userId))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ data: [] });
    }

    const data = await db
      .insert(categories)
      .values(
        DEFAULT_CATEGORY_NAMES.map((name) => ({
          id: createId(),
          name,
          userId: auth.userId,
        }))
      )
      .returning({ id: categories.id, name: categories.name });

    return c.json({ data });
  })
```

- [ ] **Step 2: Create the client hook**

Create `features/categories/api/use-bootstrap-categories.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/hono";

export const useBootstrapCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await client.api.categories.bootstrap.$post();

      if (!response.ok) {
        throw new Error("Failed to seed categories");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};
```

- [ ] **Step 3: Typecheck and test**

Run: `bunx tsc --noEmit && bun run test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/api/[[...route]]/categories.ts" features/categories/api/use-bootstrap-categories.ts
git commit -m "feat(categories): idempotent default-category bootstrap

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Summary API returns all categories + previous-period categories

**Files:**
- Modify: `app/api/[[...route]]/summary.ts`
- Modify: `features/summary/api/use-get-summary.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: summary response gains two fields (existing fields unchanged — `categories` stays top-3+Other for the pie):
  - `allCategories: { name: string; value: number }[]` — every spending category in the current period, miliunits, descending.
  - `previousCategories: { name: string; value: number }[]` — same aggregation over the previous period (`lastPeriodStart`–`lastPeriodEnd`).
  - `getUserSummary()` converts both from miliunits. Task 7's breakdown consumes `allCategories` / `previousCategories` (rupee floats).

- [ ] **Step 1: Extract a reusable category aggregation in `app/api/[[...route]]/summary.ts`**

Inside the route handler (next to `fetchFinancialData`), add:

```ts
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
```

Replace the existing inline `const category = await db.select(...)` block (lines 96–114) with:

```ts
    const category = await fetchSpendingByCategory(auth.userId, startDate, endDate);
    const previousCategories = await fetchSpendingByCategory(
      auth.userId,
      lastPeriodStart,
      lastPeriodEnd
    );
```

The `topCategories` / `otherSum` / `finalCategories` logic below stays exactly as is — but note it does `topCategories.push(...)` via the `finalCategories` alias, which does not mutate `category` (`slice` copies). Then extend the response JSON:

```ts
    return c.json({
      data: {
        remainingAmount: currentPeriod.remaining,
        remainingChange,
        incomeAmount: currentPeriod.income,
        incomeChange,
        expensesAmount: currentPeriod.expenses,
        expensesChange,
        categories: finalCategories,
        allCategories: category,
        previousCategories,
        days,
      },
    });
```

- [ ] **Step 2: Convert the new fields in `features/summary/api/use-get-summary.ts`**

In the `return { ...data, ... }` block, add alongside the existing `categories` mapping:

```ts
        allCategories: data.allCategories.map((category) => ({
          ...category,
          value: convertAmountFromMiliunits(category.value),
        })),
        previousCategories: data.previousCategories.map((category) => ({
          ...category,
          value: convertAmountFromMiliunits(category.value),
        })),
```

- [ ] **Step 3: Typecheck and test**

Run: `bunx tsc --noEmit && bun run test`
Expected: clean. The hono client infers the new response fields automatically.

- [ ] **Step 4: Commit**

```bash
git add "app/api/[[...route]]/summary.ts" features/summary/api/use-get-summary.ts
git commit -m "feat(summary): full category breakdown + previous-period categories

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Quick-add sheet + store + entry points

**Files:**
- Create: `features/transactions/hooks/use-quick-add.ts`
- Create: `features/transactions/components/quick-add-sheet.tsx`
- Create: `components/quick-add-button.tsx`
- Modify: `providers/sheet-provider.tsx` (register the sheet)
- Modify: `app/(dashboard)/layout.tsx` (mount the floating button)
- Test: `features/transactions/__tests__/quick-add.test.ts`

**Interfaces:**
- Consumes: `useCreateTransaction` (existing; POST now works without `accountId`/`payee` — Task 3), `getUserCategories` (existing), `useBootstrapCategories` (Task 4), `convertAmountToMiliunits` (existing).
- Produces:
  - `useQuickAdd()` — zustand store `{ isOpen, onOpen, onClose }` (same shape as `useNewTransaction`).
  - `quickAddPayload(input: { amount: string; categoryId: string; note: string; day: "today" | "yesterday"; now?: Date }): { amount: number; categoryId: string; date: Date; notes: string | null } | null` — pure helper exported from `quick-add-sheet.tsx`; returns `null` for invalid/zero/negative amounts; amount is **negative miliunits** (expense); date is **local midnight** of today/yesterday.
  - `<QuickAddSheet />` registered in `SheetProvider`; `<QuickAddButton />` — floating `+` fixed bottom-right, opens the sheet.

- [ ] **Step 1: Write the failing tests for the payload helper**

Create `features/transactions/__tests__/quick-add.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { quickAddPayload } from "@/features/transactions/components/quick-add-sheet";

const now = new Date("2026-08-10T21:30:00");

describe("quickAddPayload", () => {
  it("converts a rupee amount to negative miliunits", () => {
    const payload = quickAddPayload({
      amount: "10",
      categoryId: "cat_tea",
      note: "",
      day: "today",
      now,
    });
    expect(payload).not.toBeNull();
    expect(payload!.amount).toBe(-10000);
    expect(payload!.categoryId).toBe("cat_tea");
    expect(payload!.notes).toBeNull();
  });

  it("stores the date at local midnight, not the current time", () => {
    const payload = quickAddPayload({
      amount: "60",
      categoryId: "cat_food",
      note: "",
      day: "today",
      now,
    });
    expect(payload!.date.getHours()).toBe(0);
    expect(payload!.date.getMinutes()).toBe(0);
    expect(payload!.date.getDate()).toBe(10);
  });

  it("yesterday toggle shifts the date back one day", () => {
    const payload = quickAddPayload({
      amount: "60",
      categoryId: "cat_food",
      note: "",
      day: "yesterday",
      now,
    });
    expect(payload!.date.getDate()).toBe(9);
    expect(payload!.date.getHours()).toBe(0);
  });

  it("keeps a non-empty note", () => {
    const payload = quickAddPayload({
      amount: "100",
      categoryId: "cat_travel",
      note: "auto to station",
      day: "today",
      now,
    });
    expect(payload!.notes).toBe("auto to station");
  });

  it("rejects zero, negative, and unparseable amounts", () => {
    const base = { categoryId: "cat_tea", note: "", day: "today" as const, now };
    expect(quickAddPayload({ ...base, amount: "0" })).toBeNull();
    expect(quickAddPayload({ ...base, amount: "-5" })).toBeNull();
    expect(quickAddPayload({ ...base, amount: "abc" })).toBeNull();
    expect(quickAddPayload({ ...base, amount: "" })).toBeNull();
  });

  it("accepts decimal amounts", () => {
    const payload = quickAddPayload({
      amount: "12.5",
      categoryId: "cat_snacks",
      note: "",
      day: "today",
      now,
    });
    expect(payload!.amount).toBe(-12500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test features/transactions/__tests__/quick-add.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the zustand store**

Create `features/transactions/hooks/use-quick-add.ts`:

```ts
import { create } from "zustand";

type QuickAddState = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export const useQuickAdd = create<QuickAddState>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
```

- [ ] **Step 4: Create the quick-add sheet**

Create `features/transactions/components/quick-add-sheet.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { startOfDay, subDays } from "date-fns";
import { Loader2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, convertAmountToMiliunits } from "@/lib/utils";
import { useCreateTransaction } from "../api/use-create-transaction";
import { useQuickAdd } from "../hooks/use-quick-add";
import { getUserCategories } from "@/features/categories/api/use-get-categories";
import { useBootstrapCategories } from "@/features/categories/api/use-bootstrap-categories";

type QuickAddInput = {
  amount: string;
  categoryId: string;
  note: string;
  day: "today" | "yesterday";
  now?: Date;
};

export function quickAddPayload(input: QuickAddInput) {
  const amount = parseFloat(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const now = input.now ?? new Date();
  const date =
    input.day === "yesterday"
      ? startOfDay(subDays(now, 1))
      : startOfDay(now);

  return {
    amount: convertAmountToMiliunits(-amount),
    categoryId: input.categoryId,
    date,
    notes: input.note.trim() === "" ? null : input.note.trim(),
  };
}

export const QuickAddSheet = () => {
  const { isOpen, onClose } = useQuickAdd();

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [day, setDay] = useState<"today" | "yesterday">("today");

  const createMutation = useCreateTransaction();
  const categoryQuery = getUserCategories();
  const bootstrapMutation = useBootstrapCategories();
  const bootstrapAttempted = useRef(false);

  const categories = categoryQuery.data ?? [];

  useEffect(() => {
    if (
      isOpen &&
      categoryQuery.isSuccess &&
      categories.length === 0 &&
      !bootstrapAttempted.current
    ) {
      bootstrapAttempted.current = true;
      bootstrapMutation.mutate();
    }
  }, [isOpen, categoryQuery.isSuccess, categories.length, bootstrapMutation]);

  const payload =
    categoryId === null
      ? null
      : quickAddPayload({ amount, categoryId, note, day });

  const onSave = () => {
    if (!payload) return;
    createMutation.mutate(payload, {
      onSuccess: () => {
        setAmount("");
        setNote("");
        setDay("today");
        // categoryId intentionally kept — repeat entries are often same category
      },
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Quick add</SheetTitle>
          <SheetDescription>Log a spend in seconds.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 pt-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {categoryQuery.isLoading || bootstrapMutation.isPending ? (
              <Loader2 className="size-4 animate-spin text-slate-400" />
            ) : (
              categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    categoryId === category.id
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  {category.name}
                </button>
              ))
            )}
          </div>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount in rupees"
            className="h-16 text-center text-4xl font-semibold tabular-nums"
            autoFocus
          />
          <div className="flex gap-2">
            {(["today", "yesterday"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDay(option)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition",
                  day === option
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-400"
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Note"
          />
          <Button
            className="w-full"
            size="lg"
            disabled={!payload || createMutation.isPending}
            onClick={onSave}
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
```

Notes for the implementer:
- `useCreateTransaction`'s existing `onSuccess` (toast + query invalidation) still runs; the per-call `onSuccess` here only resets local state. On error the existing hook toasts and the sheet **keeps all entered values** — that is the spec's no-silent-loss requirement.
- The sheet stays open after save on purpose.
- Payee is intentionally never sent (server stores null).

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test features/transactions/__tests__/quick-add.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Register the sheet and create the floating button**

In `providers/sheet-provider.tsx`, add the import and render `<QuickAddSheet />` alongside the existing sheets:

```tsx
import { QuickAddSheet } from "@/features/transactions/components/quick-add-sheet";
// ... inside the fragment:
      <QuickAddSheet />
```

Create `components/quick-add-button.tsx`:

```tsx
"use client";

import { Plus } from "lucide-react";

import { useQuickAdd } from "@/features/transactions/hooks/use-quick-add";
import { Button } from "@/components/ui/button";

export const QuickAddButton = () => {
  const { onOpen } = useQuickAdd();

  return (
    <Button
      onClick={onOpen}
      size="icon"
      aria-label="Quick add expense"
      className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-blue-600 shadow-lg hover:bg-blue-700"
    >
      <Plus className="size-6" />
    </Button>
  );
};
```

In `app/(dashboard)/layout.tsx`, render `<QuickAddButton />` after `{children}` (inside the returned JSX, adding the import at the top). Read the file first and preserve its existing structure.

- [ ] **Step 7: Typecheck, lint, full tests**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add features/transactions/hooks/use-quick-add.ts features/transactions/components/quick-add-sheet.tsx features/transactions/__tests__/quick-add.test.ts components/quick-add-button.tsx providers/sheet-provider.tsx "app/(dashboard)/layout.tsx"
git commit -m "feat(transactions): quick-add sheet with category chips and floating button

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Monthly review home screen

**Files:**
- Create: `components/month-picker.tsx`
- Create: `components/monthly-breakdown.tsx`
- Create: `components/__tests__/monthly-breakdown.test.ts`
- Modify: `app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `monthRange`, `prevMonth`, `nextMonth`, `monthLabel`, `currentMonth` (Task 2); `getUserSummary` with `allCategories` / `previousCategories` (Task 5); `formatCurrency` (existing).
- Produces:
  - `<MonthPicker />` — derives the selected month from the `from` URL param (or `currentMonth()`), renders `‹ August 2026 ›`, pushes `?from&to` (yyyy-MM-dd) on navigation so `getUserSummary` and the existing `DataCharts` follow automatically. Next-month chevron disabled at the current month. On first mount with no `from` param it `router.replace`s the current month's range.
  - `buildBreakdownRows(current: { name: string; value: number }[], previous: { name: string; value: number }[]): { name: string; value: number; share: number; delta: number | null }[]` — pure helper exported from `monthly-breakdown.tsx`. `share` is 0–1 of the current total; `delta` is `value - previousValue`, or `null` when the category didn't exist last period.
  - `<MonthlyBreakdown />` — card with total spent + one row per category (name, amount, share bar, delta).

- [ ] **Step 1: Write the failing tests for `buildBreakdownRows`**

Create `components/__tests__/monthly-breakdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildBreakdownRows } from "@/components/monthly-breakdown";

describe("buildBreakdownRows", () => {
  it("computes share of total and delta vs previous", () => {
    const rows = buildBreakdownRows(
      [
        { name: "Food", value: 1200 },
        { name: "Cigarettes", value: 800 },
      ],
      [{ name: "Food", value: 1000 }]
    );

    expect(rows).toEqual([
      { name: "Food", value: 1200, share: 0.6, delta: 200 },
      { name: "Cigarettes", value: 800, share: 0.4, delta: null },
    ]);
  });

  it("returns an empty array when there is no spending", () => {
    expect(buildBreakdownRows([], [{ name: "Tea", value: 50 }])).toEqual([]);
  });

  it("computes a negative delta when spending dropped", () => {
    const rows = buildBreakdownRows(
      [{ name: "Tea", value: 100 }],
      [{ name: "Tea", value: 300 }]
    );
    expect(rows[0].delta).toBe(-200);
    expect(rows[0].share).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test components/__tests__/monthly-breakdown.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/monthly-breakdown.tsx`**

```tsx
"use client";

import { getUserSummary } from "@/features/summary/api/use-get-summary";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type CategoryTotal = { name: string; value: number };

export function buildBreakdownRows(
  current: CategoryTotal[],
  previous: CategoryTotal[]
) {
  const total = current.reduce((sum, c) => sum + c.value, 0);
  if (total === 0) {
    return [];
  }
  const previousByName = new Map(previous.map((c) => [c.name, c.value]));

  return current.map((c) => {
    const prev = previousByName.get(c.name);
    return {
      name: c.name,
      value: c.value,
      share: c.value / total,
      delta: prev === undefined ? null : c.value - prev,
    };
  });
}

export const MonthlyBreakdown = () => {
  const { data, isLoading } = getUserSummary();

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  const rows = buildBreakdownRows(
    data?.allCategories ?? [],
    data?.previousCategories ?? []
  );
  const totalSpent = Math.abs(data?.expensesAmount ?? 0);

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Spent this month
        </p>
        <p className="pt-1 text-3xl font-semibold tabular-nums text-slate-900">
          {formatCurrency(totalSpent)}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-8 text-sm text-slate-400">
          No spending recorded this month yet.
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.name}
              className="border-b border-slate-100 px-6 py-4 last:border-b-0"
            >
              <div className="flex items-baseline justify-between gap-x-4">
                <span className="truncate text-sm font-medium text-slate-900">
                  {row.name}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {formatCurrency(row.value)}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${Math.round(row.share * 100)}%` }}
                />
              </div>
              <p className="pt-1 text-xs text-slate-400">
                {Math.round(row.share * 100)}% of spending
                {row.delta !== null && (
                  <>
                    {" · "}
                    {row.delta >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(row.delta))} vs last month
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

(If `components/ui/skeleton.tsx` does not exist, use `<div className="h-64 w-full animate-pulse rounded-2xl bg-slate-100" />` instead — check before importing.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test components/__tests__/monthly-breakdown.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create `components/month-picker.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import qs from "query-string";

import {
  currentMonth,
  monthLabel,
  monthRange,
  nextMonth,
  prevMonth,
} from "@/lib/month";
import { Button } from "@/components/ui/button";

export const MonthPicker = () => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const from = params.get("from");
  // Selected month is derived from the from param (yyyy-MM-dd → yyyy-MM).
  const month = from ? from.slice(0, 7) : currentMonth();

  const pushMonth = (target: string, replace = false) => {
    const range = monthRange(target);
    const url = qs.stringifyUrl(
      {
        url: pathname,
        query: {
          ...Object.fromEntries(params.entries()),
          from: range.from,
          to: range.to,
        },
      },
      { skipEmptyString: true, skipNull: true }
    );
    if (replace) {
      router.replace(url);
    } else {
      router.push(url);
    }
  };

  useEffect(() => {
    if (!from) {
      pushMonth(month, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atCurrentMonth = month >= currentMonth();

  return (
    <div className="flex items-center gap-x-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => pushMonth(prevMonth(month))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-semibold text-slate-900">
        {monthLabel(month)}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next month"
        disabled={atCurrentMonth}
        onClick={() => pushMonth(nextMonth(month))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
};
```

- [ ] **Step 6: Rework `app/(dashboard)/page.tsx`**

Replace the file contents with:

```tsx
import { Suspense } from "react";

import { DataCharts } from "@/components/data-charts";
import { MonthPicker } from "@/components/month-picker";
import { MonthlyBreakdown } from "@/components/monthly-breakdown";

export default function DashboardPage() {
  return (
    <div className="max-w-screen-2xl mx-auto w-full py-8 pb-10 space-y-6">
      <Suspense>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
          <MonthPicker />
        </div>
        <MonthlyBreakdown />
        <DataCharts />
      </Suspense>
    </div>
  );
}
```

(`DataGrid` and `DataInsights` leave the home page; `DataCharts` stays as secondary detail and follows the same `from`/`to` params the MonthPicker writes. The `Suspense` wrapper is required because `useSearchParams` is used in child client components.)

- [ ] **Step 7: Typecheck, lint, full tests**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add components/month-picker.tsx components/monthly-breakdown.tsx components/__tests__/monthly-breakdown.test.ts "app/(dashboard)/page.tsx"
git commit -m "feat(overview): monthly category breakdown home screen with month picker

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Transaction form cleanup + payee display fallback

**Files:**
- Modify: `features/transactions/components/transaction-form.tsx`
- Modify: `features/transactions/components/new-transaction-sheet.tsx`
- Modify: `features/transactions/components/edit-transaction-sheet.tsx`
- Modify: `app/(dashboard)/transactions/columns.tsx:89-106` (payee cell)
- Modify: `app/(dashboard)/transactions/lib.ts` (add `payeeDisplay`)
- Test: `app/(dashboard)/transactions/__tests__/lib.test.ts` (extend)

**Interfaces:**
- Consumes: optional `payee`/`accountId` on POST (Tasks 1, 3).
- Produces: `TransactionForm` props lose `accountOptions` and `onCreateAccount`; `formSchema.payee` becomes `z.string().optional()`; `formSchema.accountId` becomes `z.string().optional()`. `payeeDisplay(payee: string | null, category: string | null): string` in `app/(dashboard)/transactions/lib.ts` — payee, else category, else `"Cash"`; the payee table cell uses it.

- [ ] **Step 1: Simplify `transaction-form.tsx`**

- In `formSchema`, change `accountId: z.string()` → `accountId: z.string().optional()` and `payee: z.string()` → `payee: z.string().optional()`.
- Delete the entire `accountId` `<FormField>` block (lines 103–121) and remove `accountOptions` / `onCreateAccount` from `Props` and the destructured parameters.
- Change the payee field's label to `Payee (optional)` and pass `value={field.value ?? ""}` to its `<Input>`.
- In `handleSubmit`, submitted values still include `accountId` from `defaultValues` when editing (react-hook-form keeps unregistered defaults); for new transactions it is `undefined` and the server fills the default account.
- Remove the leftover `console.log("values: ", values);` line while in the file.

- [ ] **Step 2: Update `new-transaction-sheet.tsx`**

- Remove the `getUserAccounts` / `useCreateAccount` imports, the `accountQuery` / `accountMutation` / `onCreateAccount` / `accountOptions` code, and the props passed to `<TransactionForm>` for accounts.
- Remove `accountQuery.isLoading` from `isLoading` and `accountMutation.isPending` from `isPending`.
- Default values for the form: `{ date: new Date(), payee: "", amount: "", notes: "" }` (no accountId).

- [ ] **Step 3: Update `edit-transaction-sheet.tsx`**

- Same removals as Step 2 (account query/mutation/options props).
- Keep `accountId` in the form `defaultValues` built from the fetched transaction — it must round-trip through PATCH unchanged. Read the file and preserve its existing defaultValues mapping otherwise.

- [ ] **Step 4: Write the failing `payeeDisplay` test**

Append to the existing `describe` blocks in `app/(dashboard)/transactions/__tests__/lib.test.ts` (read the file first and match its import/style conventions):

```ts
describe("payeeDisplay", () => {
  it("prefers the payee when present", () => {
    expect(payeeDisplay("Tea stall", "Tea")).toBe("Tea stall");
  });

  it("falls back to the category name when payee is null", () => {
    expect(payeeDisplay(null, "Tea")).toBe("Tea");
  });

  it("falls back to Cash when both are null", () => {
    expect(payeeDisplay(null, null)).toBe("Cash");
  });

  it("treats an empty-string payee as missing", () => {
    expect(payeeDisplay("", "Snacks")).toBe("Snacks");
  });
});
```

Run: `bun run test "app/(dashboard)/transactions/__tests__/lib.test.ts"`
Expected: FAIL — `payeeDisplay` not exported.

- [ ] **Step 5: Implement `payeeDisplay` and use it in the cell**

Add to `app/(dashboard)/transactions/lib.ts`:

```ts
export function payeeDisplay(payee: string | null, category: string | null) {
  if (payee && payee.trim() !== "") {
    return payee;
  }
  if (category && category.trim() !== "") {
    return category;
  }
  return "Cash";
}
```

In the payee column cell in `app/(dashboard)/transactions/columns.tsx`, replace:

```tsx
      const payee = row.getValue("payee") as string;
```

with:

```tsx
      const payee = payeeDisplay(
        row.getValue("payee") as string | null,
        row.original.category as string | null
      );
```

(adding `payeeDisplay` to the existing `./lib` import; `row.original.category` is the joined category name already present in the row type; `monogramStyle` / `monogramInitials` then work on the fallback text unchanged.)

Run: `bun run test "app/(dashboard)/transactions/__tests__/lib.test.ts"`
Expected: PASS.

- [ ] **Step 6: Typecheck, lint, full tests**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: clean. If the CSV import flow (`import-card.tsx` / `page.tsx` import path) type-errors because it constructs POST bodies with required payee, fix by leaving its payee mapping as-is (it always supplies payee) — only type annotations should need adjusting, if anything.

- [ ] **Step 7: Commit**

```bash
git add features/transactions/components/transaction-form.tsx features/transactions/components/new-transaction-sheet.tsx features/transactions/components/edit-transaction-sheet.tsx "app/(dashboard)/transactions/columns.tsx" "app/(dashboard)/transactions/lib.ts" "app/(dashboard)/transactions/__tests__/lib.test.ts"
git commit -m "feat(transactions): optional payee, hidden account in forms, payee cell fallback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Navigation cleanup

**Files:**
- Modify: `components/navigation.tsx:11-32`

**Interfaces:**
- Consumes: nothing new. (The `/accounts` page keeps existing and working if visited directly; it just leaves the nav.)
- Produces: nav routes = Overview, Transactions, Categories, Settings.

- [ ] **Step 1: Remove the Accounts entry**

In `components/navigation.tsx`, delete the object `{ href: "/accounts", label: "Accounts" }` from the `routes` array. Note this file has an unrelated uncommitted 2-line change — leave it in place.

- [ ] **Step 2: Typecheck, lint, full tests**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/navigation.tsx
git commit -m "feat(nav): drop Accounts from navigation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: End-to-end verification in the browser

**Files:** none created — verification only.

Per `[[fintrak-dev-verification-quirks]]` memory: port 3000 may be another app — start the dev server via the preview tooling on whatever port it assigns, and use the fixture harness for auth (there is no preview auth). Never run `next build` while the dev server is running. Avoid scrolling the preview pane.

- [ ] **Step 1: Start the dev server and open the app**

Use the browser preview tools (`preview_start` with the project's launch config). Verify the server boots without errors in `preview_logs`.

- [ ] **Step 2: Verify the quick-add flow**

- Floating `+` button visible bottom-right → opens the quick-add sheet.
- Six category chips appear (seeded on first open if the fixture user has none).
- Enter `10`, tap **Tea**, tap **Save** → success toast, amount clears, sheet stays open.
- `read_network_requests`: POST `/api/transactions` body has negative miliunit amount, no payee, no accountId; response 200.
- Seeding idempotency: close and reopen the sheet — the category list is unchanged (still six, no duplicates), and no second bootstrap POST creates rows (`{ data: [] }` if it fires at all).

- [ ] **Step 3: Verify the monthly overview**

- Home shows month picker with the current month, total spent, and the new transaction's category row with amount + share bar.
- Navigate to the previous month via `‹` — URL gains `from`/`to`, breakdown and charts update; next-month chevron disabled on the current month.

- [ ] **Step 4: Verify the transactions page + edit form**

- New quick-add entry appears in the statement table with the category name (fallback) in the payee cell.
- Open the edit sheet: no account field, payee labelled optional; saving without payee works.

- [ ] **Step 5: Report**

Screenshot the overview and quick-add sheet for the user. Report any failures honestly; fix and re-verify before claiming completion.
