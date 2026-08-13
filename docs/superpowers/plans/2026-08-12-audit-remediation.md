# Fintrak Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every actionable correctness, security, performance, accessibility, dependency, validation, logging, and tooling finding in `audit.md` while preserving the current uncommitted dashboard UI work.

**Architecture:** Put reusable request validation, ownership checks, response parsing, and summary orchestration behind small typed modules, then wire the existing Hono routes and React Query hooks to them. Remove avoidable client requests at their source, keep authenticated providers under the dashboard layout, and generate—but never apply—the preventative database index migration.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Clerk, Hono, Drizzle ORM, Neon Postgres, TanStack React Query, Zod, Vitest, Radix/shadcn, Recharts.

## Global Constraints

- Preserve the pre-existing uncommitted edits in dashboard pages, `components/header.tsx`, `components/welcome-msg.tsx`, `lib/hono.ts`, and `middleware.ts`; layer changes on top and never discard them.
- Do not apply a migration to Neon. Only generate and inspect the SQL and Drizzle journal metadata.
- Do not commit implementation changes unless the user explicitly requests commits; several target files already contain user-owned edits.
- Use red-green-refactor for production behavior. Configuration, lockfile, and generated migration changes use command-level verification.
- Use these exact validation limits: names 1–80 trimmed characters, payees 0–120 trimmed characters, notes 0–500 trimmed characters, and bulk arrays 1–500 items.
- Return validation failures as `{ "error": "Invalid request", "issues": [{ "path": "field", "message": "..." }] }` with HTTP 400.
- Keep the real category name `Other`; label only the synthetic aggregation bucket `Everything else`.
- Mark an item complete in `audit.md` only after its focused verification passes.

---

### Task 1: Establish the canonical test boundary

**Files:**
- Rename: `vitest.config.ts` → `vitest.config.mts`
- Modify: `vitest.config.mts`
- Modify: `package.json`

**Interfaces:**
- Produces: Vitest discovery limited to this checkout's canonical `**/__tests__/**/*.test.{ts,tsx}` files.
- Produces: `npm run typecheck` as the canonical TypeScript verification command.

- [ ] **Step 1: Record the dirty-worktree baseline**

Run:

```bash
git status --short
git diff -- app/'(dashboard)' components/header.tsx components/welcome-msg.tsx lib/hono.ts middleware.ts
```

Expected: the current user-owned UI and routing edits are visible and remain unstaged.

- [ ] **Step 2: Rename the Vitest configuration to ESM and add explicit excludes**

Use `vitest.config.mts` with:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.claude/**",
      "**/.codex/**",
      "**/worktrees/**",
    ],
  },
});
```

- [ ] **Step 3: Add the type-check script**

Set these scripts in `package.json`:

```json
{
  "test": "vitest run",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 4: Verify the canonical baseline**

Run:

```bash
npm test
npm run typecheck
```

Expected: only canonical project tests execute; the Vitest CommonJS/ESM warning is absent; both commands exit 0 before behavior work starts.

---

### Task 2: Add shared request validation and date-range parsing

**Files:**
- Create: `lib/api-validation.ts`
- Create: `lib/__tests__/api-validation.test.ts`
- Modify: `db/schema.ts`
- Modify: `db/__tests__/schema.test.ts`
- Modify: `app/api/[[...route]]/transactions.ts`
- Modify: `app/api/[[...route]]/summary.ts`
- Modify: `app/api/[[...route]]/insights.ts`
- Modify: `app/api/[[...route]]/accounts.ts`
- Modify: `app/api/[[...route]]/categories.ts`

**Interfaces:**
- Produces: `dateRangeQuerySchema`, `parseDateRange(query, now)`, `boundedIdsSchema`, `accountNameSchema`, `categoryNameSchema`, `payeeSchema`, `notesSchema`, and `apiValidator(target, schema)`.
- `parseDateRange` returns `{ startDate: Date; endDate: Date }` and defaults to the previous 30 days when parameters are absent.
- `apiValidator` returns the global structured 400 payload.

- [ ] **Step 1: Write failing validation tests**

Add cases that assert:

```ts
expect(parseDateRange({ from: "2026-08-01", to: "2026-08-31" }, now))
  .toEqual({
    startDate: new Date(2026, 7, 1),
    endDate: new Date(2026, 7, 31),
  });

expect(() => parseDateRange({ from: "2026-02-30", to: "2026-03-01" }, now))
  .toThrow("Invalid date range");
expect(() => parseDateRange({ from: "2026-08-31", to: "2026-08-01" }, now))
  .toThrow("Invalid date range");
expect(boundedIdsSchema.safeParse([]).success).toBe(false);
expect(boundedIdsSchema.safeParse(Array(501).fill("id")).success).toBe(false);
expect(accountNameSchema.parse("  Cash  ")).toBe("Cash");
expect(categoryNameSchema.safeParse(" ").success).toBe(false);
expect(payeeSchema.safeParse("x".repeat(121)).success).toBe(false);
expect(notesSchema.safeParse("x".repeat(501)).success).toBe(false);
```

Extend the schema test to reject overlong and blank names/payees/notes.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npx vitest run lib/__tests__/api-validation.test.ts db/__tests__/schema.test.ts
```

Expected: FAIL because `lib/api-validation.ts` and the bounded schemas do not exist.

- [ ] **Step 3: Implement the validation primitives**

Use strict calendar-date validation rather than JavaScript's rollover behavior:

```ts
import { format, isValid, parse, subDays } from "date-fns";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

export const isoDateSchema = z.string().refine((value) => {
  const date = parse(value, "yyyy-MM-dd", new Date(0));
  return isValid(date) && format(date, "yyyy-MM-dd") === value;
}, "Expected a valid yyyy-MM-dd date");

export const dateRangeQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  accountId: z.string().trim().min(1).optional(),
}).superRefine(({ from, to }, context) => {
  if (from && to && from > to) {
    context.addIssue({ code: "custom", path: ["to"], message: "Must be on or after from" });
  }
});

export const boundedIdsSchema = z.array(z.string().trim().min(1)).min(1).max(500);
export const accountNameSchema = z.string().trim().min(1).max(80);
export const categoryNameSchema = z.string().trim().min(1).max(80);
export const payeeSchema = z.string().trim().max(120).nullable().optional();
export const notesSchema = z.string().trim().max(500).nullable().optional();

export function parseDateRange(query: { from?: string; to?: string }, now = new Date()) {
  const parsed = dateRangeQuerySchema.parse(query);
  return {
    startDate: parsed.from ? parse(parsed.from, "yyyy-MM-dd", now) : subDays(now, 30),
    endDate: parsed.to ? parse(parsed.to, "yyyy-MM-dd", now) : now,
  };
}

export const apiValidator = (target: "json" | "query" | "param", schema: z.ZodTypeAny) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: "Invalid request",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }, 400);
    }
  });
```

If Hono's generic inference requires overloads, implement one overload per target while preserving the call signature and response body above.

- [ ] **Step 4: Apply bounded schemas at the database/API boundary**

Extend `insertTransactionSchema` with `payeeSchema` and `notesSchema`. Use `accountNameSchema` and `categoryNameSchema` in account/category write validators. Replace every `z.array(z.string())` bulk-delete schema with `boundedIdsSchema`, and bound bulk transaction creation to 1–500 entries.

Replace ad hoc date parsing in transactions, summary, and insights with `dateRangeQuerySchema` plus `parseDateRange`. In the transactions list handler, remove the faulty expression:

```ts
const endDate = from ? parse(from, "yyyy-MM-dd", new Date()) : defaultTo;
```

and use the parsed `to` boundary returned by `parseDateRange`.

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
npx vitest run lib/__tests__/api-validation.test.ts db/__tests__/schema.test.ts lib/__tests__/month.test.ts
npm test
```

Expected: all tests pass, including the August 1–31 regression and invalid/inverted range cases.

---

### Task 3: Enforce transaction account and category ownership

**Files:**
- Create: `lib/transaction-ownership.ts`
- Create: `lib/__tests__/transaction-ownership.test.ts`
- Modify: `app/api/[[...route]]/transactions.ts`
- Create: `app/api/[[...route]]/__tests__/transactions.test.ts`

**Interfaces:**
- Produces: `validateTransactionReferences(input, lookup): Promise<ReferenceValidation>`.
- `ReferenceValidation` is `{ ok: true } | { ok: false; resource: "account" | "category" }`.
- `lookup` provides `ownedAccountIds(userId, ids)` and `ownedCategoryIds(userId, ids)`; route adapters implement both with Drizzle.
- Produces: `createTransactionsApp(dependencies)` with `authMiddleware`, `getUserId`, `ensureDefaultAccount`, and a transaction repository; the default export supplies Clerk/Drizzle implementations.

- [ ] **Step 1: Write failing ownership tests**

Cover single create, bulk create, and update-shaped inputs:

```ts
expect(await validateTransactionReferences(
  { userId: "user-a", accountIds: ["account-a"], categoryIds: ["category-b"] },
  lookupReturning({ accounts: ["account-a"], categories: [] })
)).toEqual({ ok: false, resource: "category" });

expect(await validateTransactionReferences(
  { userId: "user-a", accountIds: ["account-a", "account-a"], categoryIds: [null, "category-a"] },
  lookupReturning({ accounts: ["account-a"], categories: ["category-a"] })
)).toEqual({ ok: true });
```

Also assert that duplicate/null IDs are removed before lookup and that an unowned account fails before insertion.

- [ ] **Step 2: Run the ownership test and verify RED**

Run:

```bash
npx vitest run lib/__tests__/transaction-ownership.test.ts
```

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement the ownership service**

Implement it with set equality:

```ts
export async function validateTransactionReferences(input, lookup) {
  const accountIds = [...new Set(input.accountIds.filter(Boolean))] as string[];
  const categoryIds = [...new Set(input.categoryIds.filter(Boolean))] as string[];
  const ownedAccounts = new Set(await lookup.ownedAccountIds(input.userId, accountIds));
  if (accountIds.some((id) => !ownedAccounts.has(id))) {
    return { ok: false, resource: "account" } as const;
  }
  const ownedCategories = new Set(await lookup.ownedCategoryIds(input.userId, categoryIds));
  if (categoryIds.some((id) => !ownedCategories.has(id))) {
    return { ok: false, resource: "category" } as const;
  }
  return { ok: true } as const;
}
```

Skip the category query when the deduplicated list is empty.

- [ ] **Step 4: Wire every transaction write through the service**

For create, bulk-create, and patch, pass all account/category references to the service before any insert/update. Map failures consistently:

```ts
if (!ownership.ok) {
  const label = ownership.resource === "account" ? "Account" : "Category";
  return c.json({ error: `${label} not found` }, 403);
}
```

The single-create default account is resolved first, then the resolved account ID and supplied category ID are validated. Patch must validate the target transaction belongs to the user and the replacement references belong to the same user.

- [ ] **Step 5: Add Hono request-level regression coverage**

Export `createTransactionsApp(dependencies)` while retaining `export default createTransactionsApp(productionDependencies)`. Use this boundary so tests can call `app.request()` without live Clerk or Neon:

```ts
type TransactionsDependencies = {
  authMiddleware: MiddlewareHandler;
  getUserId: (context: Context) => string | null | undefined;
  ensureDefaultAccount: (userId: string) => Promise<{ id: string }>;
  repository: {
    list: (input: TransactionListInput) => Promise<TransactionListItem[]>;
    find: (userId: string, id: string) => Promise<TransactionRecord | undefined>;
    create: (values: NewTransaction) => Promise<TransactionRecord>;
    createMany: (values: NewTransaction[]) => Promise<TransactionRecord[]>;
    update: (userId: string, id: string, values: TransactionUpdate) => Promise<TransactionRecord | undefined>;
    remove: (userId: string, id: string) => Promise<{ id: string } | undefined>;
    removeMany: (userId: string, ids: string[]) => Promise<{ id: string }[]>;
    ownedAccountIds: (userId: string, ids: string[]) => Promise<string[]>;
    ownedCategoryIds: (userId: string, ids: string[]) => Promise<string[]>;
  };
};
```

The factory registers `dependencies.authMiddleware` once with `app.use("*", ...)`. Production dependencies use `clerkMiddleware()`, `getAuth(context)?.userId`, the existing default-account helper, and Drizzle queries. Test dependencies use a no-op middleware, a fixed user ID, and `vi.fn()` repository methods. Keep existing public paths and response shapes.

Request tests must assert:

```ts
expect(response.status).toBe(403);
expect(await response.json()).toEqual({ error: "Category not found" });
expect(repository.insert).not.toHaveBeenCalled();
```

Repeat for POST, bulk-create, and PATCH with another user's category; include a successful owned-category case, full-month GET boundaries, an unauthenticated 401, and malformed/inverted date 400 responses.

- [ ] **Step 6: Verify the transaction boundary**

Run:

```bash
npx vitest run lib/__tests__/transaction-ownership.test.ts 'app/api/[[...route]]/__tests__/transactions.test.ts'
npm test
```

Expected: all ownership and request-level cases pass; no write is attempted for an unowned reference.

---

### Task 4: Make all client mutations reject failed HTTP responses

**Files:**
- Create: `lib/api-response.ts`
- Create: `lib/__tests__/api-response.test.ts`
- Modify: all mutation hooks under `features/accounts/api/`, `features/categories/api/`, and `features/transactions/api/`

**Interfaces:**
- Produces: `parseApiResponse<T>(response: Response): Promise<T>`.
- The helper returns parsed JSON for 2xx responses and throws an `Error` for every non-2xx response, using a safe JSON `error` string when available.

- [ ] **Step 1: Write failing response-parser tests**

```ts
it.each([403, 404, 500])("throws for HTTP %s", async (status) => {
  const response = new Response(JSON.stringify({ error: "Denied" }), {
    status,
    headers: { "content-type": "application/json" },
  });
  await expect(parseApiResponse(response)).rejects.toThrow("Denied");
});

it("falls back when an error response is not JSON", async () => {
  await expect(parseApiResponse(new Response("bad gateway", { status: 502 })))
    .rejects.toThrow("Request failed (502)");
});
```

Include a 200 JSON success case.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run lib/__tests__/api-response.test.ts
```

Expected: FAIL because `parseApiResponse` does not exist.

- [ ] **Step 3: Implement the shared parser**

```ts
export async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}
```

- [ ] **Step 4: Replace direct mutation response parsing**

In every create/edit/delete/bulk/bootstrap mutation, replace:

```ts
return await response.json();
```

with:

```ts
return parseApiResponse<ResponseType>(response);
```

Remove all request URL, params, and body `console.log` calls from hooks and account/category API handlers. Preserve existing success toasts and cache invalidation; failed responses now reach `onError`, so form-level `onSuccess` callbacks cannot close a sheet after a failed write.

- [ ] **Step 5: Verify every mutation uses the helper**

Run:

```bash
rg -L "parseApiResponse" features/accounts/api/use-{bulk-delete,create,delete,edit}-account*.ts features/categories/api/use-{bootstrap,bulk-delete,create,delete,edit}-categor*.ts features/transactions/api/use-{bulk-create,bulk-delete,create,delete,edit}-transaction*.ts
rg -n "console\.(log|debug)|Request Body|Request Params" app features
npx vitest run lib/__tests__/api-response.test.ts
npm test
```

Expected: the first search prints no mutation file, the logging search prints no financial request logging, and tests pass.

---

### Task 5: Remove unnecessary client requests and stabilize date query keys

**Files:**
- Create: `lib/query-range.ts`
- Create: `lib/__tests__/query-range.test.ts`
- Modify: `components/account-filter.tsx`
- Modify: `components/month-picker.tsx`
- Modify: `features/summary/api/use-get-summary.ts`
- Modify: `features/transactions/api/use-get-transactions.ts`
- Modify: `features/categories/api/use-get-categories.ts`
- Modify: `features/transactions/components/new-transaction-sheet.tsx`
- Modify: `features/transactions/components/edit-transaction-sheet.tsx`
- Modify: `features/transactions/components/quick-add-sheet.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Produces: `effectiveMonthRange(params, now)` and `effectiveRollingRange(params, now)` returning stable `yyyy-MM-dd` strings.
- Changes: `getUserCategories(options?: { enabled?: boolean })`.

- [ ] **Step 1: Write failing query-range tests**

```ts
expect(effectiveMonthRange({}, new Date(2026, 7, 12)))
  .toEqual({ from: "2026-08-01", to: "2026-08-31" });
expect(effectiveMonthRange(
  { from: "2026-07-01", to: "2026-07-31" },
  new Date(2026, 7, 12)
)).toEqual({ from: "2026-07-01", to: "2026-07-31" });
expect(effectiveRollingRange({}, new Date(2026, 7, 12)))
  .toEqual({ from: "2026-07-13", to: "2026-08-12" });
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npx vitest run lib/__tests__/query-range.test.ts
```

Expected: FAIL because the range helpers do not exist.

- [ ] **Step 3: Implement and consume stable effective ranges**

Use `date-fns/format` plus existing `monthRange/currentMonth`. In `getUserSummary`, compute the current calendar-month fallback before forming both the query key and request. In `getUserTransactions`, compute the rolling 30-day fallback before the query key and request.

`MonthPicker` may keep `router.replace` to expose canonical URLs, but the summary query must have the same `{ from, to, accountId }` before and after replacement.

- [ ] **Step 4: Remove the summary subscription from the account filter**

Delete the summary import and call from `components/account-filter.tsx`, then change:

```tsx
disabled={isLoadingAccounts || isLoadingSummary}
```

to:

```tsx
disabled={isLoadingAccounts}
```

- [ ] **Step 5: Move sheets into the authenticated layout and gate category reads**

Remove `<SheetProvider />` and its import from `app/layout.tsx`. Render it in `app/(dashboard)/layout.tsx` alongside the existing header/main/quick-add UI.

Update the category hook:

```ts
export const getUserCategories = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({ queryKey: ["categories"], enabled, queryFn: fetchCategories });
```

Call it with `{ enabled: isOpen }` in new transaction, edit transaction, and quick-add sheets. Keep the categories page's no-argument call enabled.

- [ ] **Step 6: Add a hook-options regression test**

Mock `useQuery`, call `getUserCategories({ enabled: false })`, and assert the received configuration has `enabled: false`. Add a range-key unit test proving the empty URL and canonical current-month URL produce identical summary ranges.

- [ ] **Step 7: Verify request fan-out behavior**

Run:

```bash
npx vitest run lib/__tests__/query-range.test.ts features/categories/api/__tests__/use-get-categories.test.ts
npm test
npm run typecheck
```

Then run the app and inspect `/sign-in` in the browser network log. Expected: zero `/api/categories` and zero `/api/summary` requests on sign-in. When authenticated, open a non-overview dashboard route and confirm the header does not initiate `/api/summary`.

---

### Task 6: Parallelize summary reads and disambiguate the remainder category

**Files:**
- Create: `lib/summary.ts`
- Create: `lib/__tests__/summary.test.ts`
- Modify: `app/api/[[...route]]/summary.ts`

**Interfaces:**
- Produces: `runSummaryReads(reads)` returning all five query results.
- Produces: `topCategoryBuckets(categories, limit = 3)` using `Everything else` for the synthetic remainder.
- Produces: `/api/summary` response header `Server-Timing: summary-db;dur=<milliseconds>` for the five-read boundary.

- [ ] **Step 1: Write failing concurrency and aggregation tests**

Use deferred promises to prove every read starts before any resolves:

```ts
const started: string[] = [];
const reads = Object.fromEntries(names.map((name) => [name, () => {
  started.push(name);
  return deferred[name].promise;
}]));
const resultPromise = runSummaryReads(reads);
expect(started).toEqual(names);
```

Resolve all deferred promises and assert the keyed result. Also assert:

```ts
expect(topCategoryBuckets([
  { name: "Other", value: 40 },
  { name: "Food", value: 30 },
  { name: "Travel", value: 20 },
  { name: "Tea", value: 10 },
])).toEqual([
  { name: "Other", value: 40 },
  { name: "Food", value: 30 },
  { name: "Travel", value: 20 },
  { name: "Everything else", value: 10 },
]);
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npx vitest run lib/__tests__/summary.test.ts
```

Expected: FAIL because the summary helpers do not exist.

- [ ] **Step 3: Implement the pure summary helpers**

`runSummaryReads` must call the five functions in one `Promise.all` expression. `topCategoryBuckets` must avoid mutating the source array and must omit the synthetic row when there is no remainder.

- [ ] **Step 4: Wire the endpoint to one concurrent read boundary**

After computing current and previous ranges, create the five promises for current totals, previous totals, current categories, previous categories, and active days, then await them together. Perform percentage and bucket calculations afterward. Coalesce nullable aggregate values to zero before percentage calculations.

Measure only the database-read boundary and expose it without financial data:

```ts
const databaseStartedAt = performance.now();
const result = await runSummaryReads(reads);
c.header(
  "Server-Timing",
  `summary-db;dur=${(performance.now() - databaseStartedAt).toFixed(1)}`
);
```

- [ ] **Step 5: Verify correctness and timing structure**

Run:

```bash
npx vitest run lib/__tests__/summary.test.ts components/__tests__/monthly-breakdown.test.ts
npm test
```

Expected: tests pass and `summary.ts` contains one `Promise.all` for the five independent reads rather than five sequential top-level awaits.

---

### Task 7: Repair accessibility at the actual controls

**Files:**
- Create: `components/__tests__/accessibility.test.tsx`
- Modify: `components/navigation.tsx`
- Modify: `components/amount-input.tsx`
- Modify: `components/select.tsx`
- Modify: `components/date-picker.tsx`
- Modify: `features/transactions/components/transaction-form.tsx`
- Modify: `app/(dashboard)/accounts/actions.tsx`
- Modify: `app/(dashboard)/categories/actions.tsx`

**Interfaces:**
- Changes: `Select` accepts `inputId?: string` and `aria-label?: string` and forwards them as `inputId`/`aria-label` through `react-select`.
- Changes: `AmountInput` forwards `id`, `aria-describedby`, and `aria-invalid` to `CurrencyInput`.
- Changes: `DatePicker` forwards its form-control ID and ARIA attributes to its trigger button.

- [ ] **Step 1: Write failing markup tests**

Using `renderToStaticMarkup` with focused mocks for Next navigation and `react-use`, assert:

```ts
expect(mobileNavigationMarkup).toContain('aria-label="Open navigation menu"');
expect(mobileNavigationMarkup).not.toMatch(/<button[^>]*>\s*<button/);
expect(amountMarkup).toContain('aria-label="Toggle income or expense"');
expect(accountActionsMarkup).toContain('aria-label="Open account menu"');
expect(categoryActionsMarkup).toContain('aria-label="Open category menu"');
```

Add a `Select` test that verifies the rendered input receives the form ID or explicit accessible name.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run components/__tests__/accessibility.test.tsx
```

Expected: FAIL on missing names and the nested mobile trigger button.

- [ ] **Step 3: Fix navigation and row-action triggers**

Use:

```tsx
<SheetTrigger asChild>
  <Button aria-label="Open navigation menu" ...>
    <Menu aria-hidden="true" className="size-4" />
  </Button>
</SheetTrigger>
```

Add `aria-label="Open account menu"` and `aria-label="Open category menu"` to the corresponding action buttons.

- [ ] **Step 4: Fix form-control labeling**

Add `aria-label="Toggle income or expense"` to the sign toggle. Change `AmountInput`, `DatePicker`, and the custom `Select` to accept and forward the ID/ARIA props supplied by Radix `FormControl`. Add a visible `FormLabel` for the date field and keep `FormMessage` associated with invalid controls.

- [ ] **Step 5: Verify automated and browser accessibility**

Run:

```bash
npx vitest run components/__tests__/accessibility.test.tsx
npm test
npm run typecheck
```

In the browser, keyboard through mobile navigation, account/category row menus, date, category, amount, payee, and notes. Expected: one focus stop per trigger, visible focus, and a meaningful accessible name for each interactive control.

---

### Task 8: Replace deprecated authorization matching and fix static exclusions

**Files:**
- Create: `lib/route-protection.ts`
- Create: `lib/__tests__/route-protection.test.ts`
- Modify: `middleware.ts`

**Interfaces:**
- Produces: `isProtectedPath(pathname: string): boolean`.
- Protected paths: `/`, `/transactions/**`, `/accounts/**`, `/categories/**`, `/settings/**`, and `/api/**`.
- Public/static examples: `/sign-in`, `/sign-up`, `/logo.svg`, `/favicon.ico`, and `/_next/static/**`.

- [ ] **Step 1: Write failing route-protection tests**

```ts
it.each(["/", "/transactions", "/transactions/1", "/api/categories"])(
  "protects %s", (path) => expect(isProtectedPath(path)).toBe(true)
);
it.each(["/sign-in", "/sign-up", "/logo.svg", "/favicon.ico", "/_next/static/a.js"])(
  "leaves %s public", (path) => expect(isProtectedPath(path)).toBe(false)
);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run lib/__tests__/route-protection.test.ts
```

Expected: FAIL because `isProtectedPath` does not exist.

- [ ] **Step 3: Implement explicit path protection**

```ts
const dashboardRoots = ["/transactions", "/accounts", "/categories", "/settings"];

export function isProtectedPath(pathname: string) {
  return pathname === "/" ||
    pathname === "/api" || pathname.startsWith("/api/") ||
    dashboardRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}
```

In middleware, remove `createRouteMatcher`, call `isProtectedPath(request.nextUrl.pathname)`, and retain `await auth.protect()` for protected paths.

- [ ] **Step 4: Correct the Next/Clerk matcher**

Use the escaped matcher that skips Next internals and common static extensions while always running for API routes:

```ts
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 5: Verify tests and middleware compilation**

Run:

```bash
npx vitest run lib/__tests__/route-protection.test.ts
npm run typecheck
npm run build
```

Expected: tests and build pass, with no `createRouteMatcher` deprecation warning and no Clerk middleware requests for `/logo.svg` or `/favicon.ico` during the browser pass.

---

### Task 9: Lazy-load the charting path and record the bundle delta

**Files:**
- Create: `components/lazy-data-charts.tsx`
- Modify: `components/data-charts.tsx`
- Modify: `app/(dashboard)/page.tsx`

**Interfaces:**
- Produces: `LazyDataCharts`, a client component using `next/dynamic` with `ssr: false`.
- The loading fallback preserves the existing chart/spending-pie skeleton grid.

- [ ] **Step 1: Extract a reusable loading view**

Export `DataChartsLoading` from `components/data-charts.tsx` and use it both in the existing query-loading branch and dynamic import fallback. This is a behavior-preserving refactor.

- [ ] **Step 2: Verify the refactor before introducing the dynamic boundary**

Run:

```bash
npm test
npm run typecheck
```

Expected: both commands pass with the direct `DataCharts` import still present.

- [ ] **Step 3: Add the client-only lazy boundary**

```tsx
"use client";

import dynamic from "next/dynamic";
import { DataChartsLoading } from "@/components/data-charts";

export const LazyDataCharts = dynamic(
  () => import("@/components/data-charts").then((module) => module.DataCharts),
  { ssr: false, loading: () => <DataChartsLoading /> }
);
```

Replace the page's direct `DataCharts` import/render with `LazyDataCharts`.

- [ ] **Step 4: Build and compare route output**

Run:

```bash
npm run build
```

Expected: build exits 0 and the `/` initial route size is lower than the audited 287 kB first-load baseline, or the chart chunk is demonstrably deferred in the route manifests. Record the measured size in `audit.md`; if neither changes, revert only this dynamic-boundary change and leave the bundle item unchecked with the evidence.

---

### Task 10: Add preventative indexes and generate an unapplied migration

**Files:**
- Modify: `db/schema.ts`
- Modify: `db/__tests__/schema.test.ts`
- Create: next generated `drizzle/0003_*.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: next generated Drizzle snapshot under `drizzle/meta/`

**Interfaces:**
- Adds: `accounts_user_id_idx` on `accounts(user_id)`.
- Adds: `transactions_account_id_date_idx` on `transactions(account_id, date)`.

- [ ] **Step 1: Add failing schema metadata tests**

Use Drizzle table metadata helpers to assert both named indexes exist on the declared columns.

- [ ] **Step 2: Run the schema test and verify RED**

Run:

```bash
npx vitest run db/__tests__/schema.test.ts
```

Expected: FAIL because both indexes are absent.

- [ ] **Step 3: Declare the indexes**

Import `index` from `drizzle-orm/pg-core` and use table callbacks:

```ts
(table) => ({ userIdIdx: index("accounts_user_id_idx").on(table.userId) })
```

and:

```ts
(table) => ({
  accountIdDateIdx: index("transactions_account_id_date_idx")
    .on(table.accountId, table.date),
})
```

- [ ] **Step 4: Verify GREEN and generate SQL**

Run:

```bash
npx vitest run db/__tests__/schema.test.ts
npm run db:generate
```

Expected: schema tests pass and Drizzle creates migration 0003 with exactly two `CREATE INDEX` statements.

- [ ] **Step 5: Inspect without applying**

Run:

```bash
sed -n '1,200p' drizzle/0003_*.sql
git diff -- db/schema.ts drizzle
```

Expected: SQL contains only the two intended indexes plus generator-required separators/metadata. Do not run `npm run db:migrate`, `bun scripts/migrate.ts`, or any direct DDL against Neon.

---

### Task 11: Upgrade vulnerable dependencies and modernize linting

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.eslintrc.json` only if the upgraded Next.js patch requires a compatibility adjustment

**Interfaces:**
- Requires: resolved Next.js ≥15.5.21 and <16, Hono ≥4.12.34 and <5.
- Produces: `npm run lint` using the ESLint CLI with zero warnings allowed.

- [ ] **Step 1: Capture current resolved versions and audit**

Run:

```bash
npm ls next hono postcss sharp
npm audit --omit=dev
```

Expected: output reproduces the vulnerable baseline recorded in `audit.md`.

- [ ] **Step 2: Install patched versions and regenerate the lockfile**

Run:

```bash
npm install next@^15.5.21 eslint-config-next@^15.5.21 hono@^4.12.34
```

If the production audit still identifies vulnerable transitive PostCSS or Sharp releases, use `npm explain postcss sharp` to identify the parent and update that direct parent within its current major. Do not add blind `overrides` until the parent relationship is confirmed.

- [ ] **Step 3: Replace deprecated `next lint`**

Set:

```json
{
  "lint": "eslint . --ext .js,.mjs,.ts,.tsx --max-warnings 0 --ignore-pattern .next --ignore-pattern .claude --ignore-pattern .codex"
}
```

Keep the existing Next core-web-vitals rules unless the patch release requires the official flat-config migration.

- [ ] **Step 4: Verify the production dependency graph**

Run:

```bash
npm ls next hono postcss sharp
npm audit --omit=dev
```

Expected: no high or critical production vulnerabilities and none of the audited vulnerable versions remain resolved.

- [ ] **Step 5: Run the compatibility gate**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all four commands exit 0 with no application lint warnings.

---

### Task 12: Complete API coverage for account/category CRUD and error contracts

**Files:**
- Create: `app/api/[[...route]]/__tests__/accounts.test.ts`
- Create: `app/api/[[...route]]/__tests__/categories.test.ts`
- Modify: `app/api/[[...route]]/accounts.ts`
- Modify: `app/api/[[...route]]/categories.ts`

**Interfaces:**
- Produces: `createAccountsApp(dependencies)` and `createCategoriesApp(dependencies)` while preserving each module's production default export.
- Test dependencies provide `authMiddleware`, `getUserId(context)`, and repository functions; production dependencies wrap Clerk/Drizzle.
- `AccountsRepository` exposes `list(userId)`, `find(userId, id)`, `create(userId, values)`, `update(userId, id, values)`, `remove(userId, id)`, and `removeMany(userId, ids)`.
- `CategoriesRepository` exposes the same CRUD methods plus `bootstrap(userId, names)` and `hasAny(userId)`.

- [ ] **Step 1: Add failing account CRUD contract tests**

Create the factory with a fake repository and call `app.request()` for these exact contracts:

| Method and path | Case | Expected |
|---|---|---|
| `GET /` | no user | `401 { error: "Unauthorized" }` |
| `GET /` | authenticated | `200 { data: [...] }` scoped to the user |
| `GET /:id` | repository misses user/id pair | `404 { error: "Not found" }` |
| `POST /` | `{ name: "  Cash  " }` | repository receives `Cash`, response 200 |
| `POST /` | blank or 81-character name | structured 400, repository not called |
| `PATCH /:id` | owned row | 200 with updated row |
| `PATCH /:id` | another user's/missing row | 404 |
| `DELETE /:id` | owned row | 200 with deleted ID |
| `POST /bulk-delete` | 1–500 IDs | 200 with only user-owned deleted IDs |
| `POST /bulk-delete` | 0 or 501 IDs | structured 400, repository not called |

Use a dependency object shaped as:

```ts
const dependencies = {
  authMiddleware: async (_context, next) => next(),
  getUserId: vi.fn().mockReturnValue("user-a"),
  repository: {
    list: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeMany: vi.fn(),
  },
};
```

- [ ] **Step 2: Add failing category CRUD contract tests**

Repeat the account contracts for categories, then add:

| Method and path | Case | Expected |
|---|---|---|
| `POST /bootstrap` | user already has a category | `200 { data: [] }`, no insert |
| `POST /bootstrap` | no existing categories | repository receives `DEFAULT_CATEGORY_NAMES` |
| `POST /` | repository reports unique conflict | `409 { error: "Category name already exists" }` |
| any write | repository reports unknown failure | `500 { error: "Internal server error" }` without SQL/body data |

Represent known conflicts with a repository error carrying `code: "23505"`; the route maps only that PostgreSQL unique-violation code to 409.

- [ ] **Step 3: Run both suites and verify RED**

Run:

```bash
npx vitest run 'app/api/[[...route]]/__tests__/accounts.test.ts' 'app/api/[[...route]]/__tests__/categories.test.ts'
```

Expected: FAIL until route dependencies are injectable and validation/error responses are consistent.

- [ ] **Step 4: Introduce production/test route factories**

Keep the public Hono route paths and inferred client types unchanged. Use these factory boundaries:

```ts
type RouteDependencies<TRepository> = {
  authMiddleware: MiddlewareHandler;
  getUserId: (context: Context) => string | null | undefined;
  repository: TRepository;
};

export function createAccountsApp(dependencies: RouteDependencies<AccountsRepository>) {
  const app = new Hono();
  app.use("*", dependencies.authMiddleware);
  return app
    // register existing routes, calling dependencies instead of module globals
}

const app = createAccountsApp({
  authMiddleware: clerkMiddleware(),
  getUserId: (context) => getAuth(context)?.userId,
  repository: drizzleAccountsRepository,
});

export default app;
```

Create the equivalent category factory. Production repositories contain the existing Drizzle expressions, including user ID predicates; tests use fakes. Do not add environment checks or test-only branches to route handlers.

- [ ] **Step 5: Map known database conflicts safely**

For category uniqueness conflicts, return:

```json
{ "error": "Category name already exists" }
```

with HTTP 409. Unknown database failures return `{ "error": "Internal server error" }` with HTTP 500 and never include SQL, credentials, or submitted financial data.

- [ ] **Step 6: Verify all API contracts**

Run:

```bash
npx vitest run 'app/api/[[...route]]/__tests__/*.test.ts'
npm test
npm run typecheck
```

Expected: account, category, and transaction request-level suites pass, including authentication and cross-user isolation.

---

### Task 13: Final browser verification and audit closure

**Files:**
- Modify: `audit.md`
- Modify: `README.md` if the lint command, migration status, or local performance guidance needs documentation

**Interfaces:**
- Produces: an evidence-backed audit checklist with only verified items checked.

- [ ] **Step 1: Run the complete automated gate from a clean process state**

Stop duplicate Fintrak dev servers for this checkout only after confirming their exact PIDs and working directories. Then run:

```bash
npm test
npm run typecheck
npm run lint
npm audit --omit=dev
npm run build
git diff --check
```

Expected: canonical tests only; all commands exit 0; no high/critical production vulnerabilities; no whitespace errors.

- [ ] **Step 2: Run the production server and public browser checks**

Use one temporary production server. Verify `/sign-in` at desktop and mobile widths:

- no horizontal overflow;
- zero `/api/categories` and `/api/summary` calls;
- no middleware processing for logo/favicon assets;
- meaningful keyboard focus and mobile navigation name;
- production timing recorded separately from development cold compilation.

- [ ] **Step 3: Run authenticated browser checks when a session is available**

Verify overview, month navigation, accounts, categories, transactions, settings, quick add, transaction create/edit/delete, CSV import, account/category menus, date/account filters, and responsive navigation. Confirm one initial summary query key and no summary request caused solely by the header on non-overview pages.

If no authenticated session is available, leave the signed-in completion-gate checkbox open and state that limitation; do not invent credentials or weaken auth.

- [ ] **Step 4: Update `audit.md` from evidence**

Check each completed item and add concise measured results:

- canonical test file/test counts;
- production route size after chart splitting;
- public request counts;
- resolved dependency versions and audit severity count;
- generated migration filename and explicit “not applied” status.

Leave any unverified or unsuccessful optimization unchecked with its evidence and next action.

- [ ] **Step 5: Recheck preservation of user-owned changes**

Run:

```bash
git status --short
git diff -- app/'(dashboard)' components/header.tsx components/welcome-msg.tsx lib/hono.ts middleware.ts
```

Expected: the original layout/visual/origin/protection edits remain present alongside the remediation changes; no unrelated file was reverted or overwritten.

- [ ] **Step 6: Final verification report**

Report the exact commands and outcomes, remaining unchecked audit items, migration-not-applied status, and the paths to `audit.md`, this plan, and the generated migration. Do not claim complete remediation if the authenticated browser gate or any automated command remains unresolved.
