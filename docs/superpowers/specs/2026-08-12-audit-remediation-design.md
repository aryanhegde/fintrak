# Fintrak Audit Remediation Design

**Date:** 2026-08-12

## Goal

Resolve the correctness, tenant-isolation, client error-handling, performance, accessibility, dependency, validation, logging, and tooling findings recorded in `audit.md` without overwriting the current uncommitted dashboard visual changes.

## Scope and constraints

- Preserve all existing uncommitted edits to dashboard pages, `components/header.tsx`, `components/welcome-msg.tsx`, `lib/hono.ts`, and `middleware.ts`; remediation changes must be layered onto them.
- Use regression tests before behavior changes. Configuration-only and dependency-lock changes receive command-level verification.
- Generate database migrations when schema indexes change, but do not run migrations against the configured Neon database.
- Do not redesign the product or replace the current Next.js, Clerk, Hono, Drizzle, React Query, or shadcn/Radix architecture.
- Mark an `audit.md` item complete only after its specific checks and the applicable project-wide checks pass.

## Architecture

The work is divided into independently verifiable remediation batches. Shared validation and response handling will be extracted into small utilities so route handlers and mutation hooks apply one behavior consistently. Security checks remain at the API boundary, while authenticated UI providers and queries move to the dashboard boundary and become conditional on actual visibility.

Performance changes remove unnecessary requests before optimizing legitimate work. The header will no longer subscribe to summary data, default date ranges will be stable before querying, closed sheets will not fetch editor data, and independent summary reads will run concurrently. Bundle reduction will use a client-only dynamic boundary for charts rather than changing chart behavior.

## Correctness and tenant isolation

Transaction list range parsing will use `to` for the upper boundary and reject invalid or inverted date ranges with a structured `400` response. Shared date-range parsing will cover the transactions, summary, and insights endpoints where applicable.

Transaction create, bulk-create, and update operations will verify that every non-null category ID belongs to the authenticated user. Bulk operations will deduplicate account and category IDs before ownership queries and fail the complete request if any referenced resource is unowned. Existing transaction ownership checks remain in place.

Route-level tests will exercise authenticated and unauthenticated behavior with injected auth/database dependencies or a route test harness. Required cases include the full-month range regression, another user's category on create/bulk-create/update, another user's account, malformed and inverted dates, missing resources, and bounded bulk payloads.

## Client request handling

A shared response parser will check `response.ok`, extract a safe server error message when present, and throw an `Error` for all non-success responses. Every account, category, and transaction mutation will use it. Successful requests retain their current toasts and cache invalidations; failed requests must execute `onError` and must not close forms or display success feedback.

Financial payload logging will be removed from route handlers and client hooks. No replacement logging is needed for this personal app; errors remain visible through controlled responses and UI toasts.

## Performance

- Remove `getUserSummary()` from `AccountFilter`; its disabled state depends only on the accounts query.
- Give summary and transaction queries an effective default date range synchronously. `MonthPicker` may canonicalize the URL, but the query key and request parameters must not change during that canonicalization.
- Move `SheetProvider` from the root layout to the authenticated dashboard layout. Sheet queries will use `enabled: isOpen` where editor data is unnecessary while closed, and auth-page requests must not include dashboard APIs.
- Start the five independent summary reads together with `Promise.all`. Derived calculations run after the required results resolve.
- Dynamically import the dashboard chart section with server rendering disabled and a stable skeleton fallback, keeping the overview summary tiles immediately available.
- Keep database indexes as a generated, unapplied migration: `accounts(user_id)` and `transactions(account_id, date)`. The migration is preventative because the audited database is too small for indexes to improve current latency.

Performance verification compares request counts and production bundle output with the audited baseline. The sign-in page must make zero category or summary API calls, non-overview dashboard routes must not request `/api/summary` solely because of the header, and initial overview state must use one summary query key.

## Accessibility and middleware

The mobile navigation trigger will use `SheetTrigger asChild` with an accessible name. Account and category row menus and the amount sign-toggle control will receive explicit names. Form components will expose labels or ARIA attributes on their actual interactive currency/select controls.

The Clerk middleware matcher will adopt the correctly escaped static-asset exclusion pattern while preserving protection for dashboard and API routes. Because the installed Clerk helper is deprecated, authorization will be expressed using the supported Clerk middleware pattern available in the upgraded dependency; route/API protection behavior will be covered by focused matcher or route tests where the framework permits it.

## Validation and category aggregation

Reusable Zod schemas will trim and bound names, payees, and notes; validate ISO calendar dates; reject inverted ranges; and require bounded, non-empty bulk arrays. Validation errors will return a consistent JSON error shape.

The dashboard's synthetic remainder category will use the label `Everything else`, preventing collision with a real category named `Other`. Aggregation tests will cover both labels appearing together.

## Tooling, dependencies, and migration

- Upgrade Next.js to at least `15.5.21` and Hono to at least `4.12.34`, update compatible companion packages, and regenerate `package-lock.json`.
- Confirm that the resolved production graph no longer contains the audited vulnerable Next.js, Hono, PostCSS, or Sharp releases.
- Replace `next lint` with an ESLint CLI script compatible with the installed Next.js/ESLint generation, without performing a broad formatting rewrite.
- Exclude `.claude/**`, `.codex/**`, and nested worktree directories from Vitest discovery so only canonical tests run.
- Resolve the Vitest module-format warning through the smallest compatible configuration change.
- Generate the Drizzle index migration and journal metadata, but leave deployment to an explicit later request.

## Verification

Each behavior batch follows red-green-refactor and runs its focused tests. The final gate is:

1. Canonical Vitest suite passes with no nested-worktree tests.
2. TypeScript checking passes.
3. ESLint passes with no application errors or warnings.
4. `npm audit --omit=dev` reports no high or critical production vulnerabilities.
5. Fresh production build succeeds and its route sizes/request behavior are recorded.
6. Public sign-in browser pass has no dashboard API calls and no horizontal overflow.
7. Signed-in browser verification covers overview, quick add, transaction create/edit/import, account/category actions, filters, and responsive navigation when an authenticated session is available.
8. `git diff --check` passes, the generated migration is present but unapplied, and all verified `audit.md` items are checked off.

If a signed-in session is unavailable, automated API/component coverage remains mandatory and the manual signed-in completion-gate item stays unchecked with the limitation stated explicitly.

## Out of scope

- Applying migrations to Neon.
- Replacing Clerk or Neon.
- A visual redesign beyond accessibility adjustments and existing user-owned UI changes.
- Adding production monitoring infrastructure or a hosted performance service.
- Refactoring unrelated application features.
