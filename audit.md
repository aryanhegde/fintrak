# Fintrak Audit TODOs

Audit date: 2026-08-12
Remediation verification: 2026-08-13

## P1 — High priority

- [x] Fix transaction date-range filtering.
  - `app/api/[[...route]]/transactions.ts:45` derives `endDate` from `from` and ignores `to`, collapsing a requested range to its first day.
  - Parse the `to` parameter for the upper boundary.
  - Add an API regression test proving `from=2026-08-01&to=2026-08-31` includes transactions throughout the month.

- [x] Enforce category ownership on transaction writes.
  - `POST /api/transactions`, `POST /api/transactions/bulk-create`, and `PATCH /api/transactions/:id` validate account ownership but accept any existing `categoryId`.
  - Verify every non-null category belongs to `auth.userId` before inserting or updating.
  - Add two-user integration tests covering create, bulk-create, and update attempts with another user's category ID.

- [x] Reject non-success HTTP responses in every mutation hook.
  - Twelve hooks under `features/accounts/api`, `features/categories/api`, and `features/transactions/api` parse JSON without checking `response.ok`.
  - A JSON 403 or 404 can therefore trigger `onSuccess`, show a success toast, invalidate caches, and close a form even though nothing changed.
  - Use the guarded pattern in `features/transactions/api/use-create-transaction.ts`, preferably through a shared response helper.
  - Test representative 403, 404, and 500 responses.

- [x] Patch vulnerable production dependencies and regenerate the lockfile.
  - Upgrade Next.js from resolved `15.5.20` to at least `15.5.21`.
  - Upgrade Hono from resolved `4.12.30` to at least `4.12.34`.
  - Ensure the update also resolves the vulnerable nested PostCSS `8.4.31` and Sharp `0.34.5` versions.
  - Rerun `npm audit --omit=dev`, the test suite, type checking, linting, and the production build.

## Performance diagnosis — measured 2026-08-12

The multi-second public-page delay is primarily a development cold-start problem, not a production rendering problem. The first development visit to `/sign-in` took 8.9 seconds, including 5.8 seconds compiling 3,408 modules. Warm development visits took 137–196 ms. A fresh production build served the same page in 200 ms on the first visit and 57–76 ms when warm.

Signed-in pages also do avoidable remote work. A read-only Neon probe on the configured database measured five sequential requests at about 1.34 seconds total (828, 310, 50, 103, and 48 ms), versus 339 ms when five requests ran concurrently. The database currently has approximately zero accounts and transactions, so data volume and missing indexes are not the present cause of that latency.

- [x] Stop the header from loading the full financial summary on every dashboard route.
  - `components/header.tsx` renders `AccountFilter` on accounts, categories, transactions, settings, and overview pages.
  - `components/account-filter.tsx:26` calls `getUserSummary()` only to include `isLoadingSummary` in the account selector's disabled state.
  - This makes pages that do not display the summary pay for the five-query `/api/summary` endpoint.
  - Disable the selector based on the accounts query alone, then verify that non-overview routes no longer request `/api/summary`.

- [x] Prevent the overview's initial double summary request.
  - `components/month-picker.tsx:46` writes default `from` and `to` parameters in an effect after the initial render.
  - Summary consumers can first request the empty-parameter query key and then request the current-month key after `router.replace`.
  - Derive the default range before enabling the query, redirect on the server, or keep a stable effective range without a post-mount URL rewrite.

- [x] Parallelize or consolidate the five independent summary database queries.
  - `app/api/[[...route]]/summary.ts:99-169` awaits current totals, previous totals, current categories, previous categories, and active days in sequence.
  - The remote round-trip probe reduced five-request latency from about 1.34 seconds sequentially to 339 ms concurrently.
  - Run independent reads concurrently with one `Promise.all`, or consolidate compatible aggregations into fewer SQL statements.
  - Add endpoint timing instrumentation and compare cold and warm `/api/summary` latency before and after the change.

- [x] Lazy-mount dashboard sheets and defer their data queries until opened.
  - `app/layout.tsx` mounts all seven dashboard sheets, including on public authentication pages.
  - Closed transaction and quick-add sheets call the categories query immediately; the sign-in pass produced four failed `/api/categories` requests because React Query retried the unauthenticated request three times.
  - Move `SheetProvider` to the authenticated dashboard layout, render only the active sheet, and set query `enabled` conditions from authentication and open state.

- [x] Reduce the overview's initial JavaScript cost.
  - The production build reports 287 kB of first-load JavaScript for `/`, the largest page in the app; its page-specific payload is 126 kB and includes the charting path.
  - Dynamically load below-the-fold charts, keep sheet/form dependencies out of the initial route, and set a bundle budget that fails on meaningful regressions.

- [x] Use one development server per checkout and benchmark production separately.
  - Two other Fintrak development servers were already listening on ports 3001 and 3003 during the audit.
  - Multiple watchers and compilers for the same checkout consume resources and can contend over `.next`; stop stale instances before profiling or building.
  - Treat the measured one-time 5.8-second development compile separately from production runtime performance.

## P2 — Medium priority

- [x] Make test discovery ignore nested worktrees.
  - `vitest.config.ts` currently discovers tests under `.claude/worktrees`.
  - `npm test` reported 14 files and 124 tests, while the canonical app contains 6 files and 51 tests.
  - Exclude `.claude/**` and other nested worktree directories explicitly.

- [x] Add API and tenant-isolation test coverage.
  - Existing tests cover pure helpers and schemas but not Hono routes, authenticated queries, mutations, date filters, or cross-user access.
  - Cover account/category/transaction CRUD, bulk operations, malformed ranges, ownership checks, and non-success client behavior.

- [x] Repair dashboard accessibility issues.
  - In `components/navigation.tsx`, use `SheetTrigger asChild` instead of nesting its button around the shared `Button` component.
  - Give the mobile-menu trigger an accessible name.
  - Add accessible names to the account/category row action buttons and the sign-toggle button in `components/amount-input.tsx`.
  - Verify form labels and validation attributes reach the actual currency and select controls.

- [ ] Add database indexes before transaction volume grows.
  - The database currently has only primary-key indexes plus `categories(user_id, name)`; it has no index on `accounts.user_id` or the transaction join/date columns.
  - Current table sizes are too small for missing indexes to explain today's latency.
  - Once representative data exists, use `EXPLAIN (ANALYZE, BUFFERS)` to confirm indexes such as `accounts(user_id)` and `transactions(account_id, date)` before adding them.
  - Generated `drizzle/0003_closed_mastermind.sql` contains the proposed indexes, but the migration is intentionally **not applied**. Keep this item open until deployment is explicitly approved and verified.

## P3 — Lower priority and hardening

- [x] Prevent the real `Other` category from colliding with the synthetic remainder bucket.
  - Default categories include `Other`, while `summary.ts` may append another result named `Other` after the top three categories.
  - Merge the values or use an unambiguous label such as `Everything else`.

- [x] Migrate away from Clerk's deprecated path-matcher authorization.
  - The installed Clerk SDK warns that `createRouteMatcher` is deprecated.
  - Keep authorization checks colocated with every page and API resource that reads user data.

- [x] Correct the middleware static-file matcher.
  - `middleware.ts:21` currently matches `/logo.svg` and `/favicon.ico`, adding unnecessary Clerk middleware work.
  - Replace it with the correctly escaped Clerk/Next matcher and add matcher tests for routes, API requests, and static assets.

- [x] Remove production debug logging of financial payloads.
  - Mutation hooks and API routes log request parameters and bodies, including transaction amounts, notes, account IDs, and category data.
  - Remove or replace these logs with redacted, environment-aware diagnostics.

- [x] Strengthen request validation.
  - Validate date strings and reject inverted ranges.
  - Trim and bound account/category names, payees, and notes.
  - Set minimum and maximum lengths on bulk-operation arrays.
  - Return consistent structured errors for validation, uniqueness, and database failures.

- [x] Modernize the lint and test configuration.
  - Replace deprecated `next lint` with the ESLint CLI before Next.js 16.
  - Resolve the Vitest CommonJS/ESM configuration warning.

## Verified baseline

- [x] Production build succeeds on the audited checkout.
- [x] TypeScript check succeeds.
- [x] ESLint reports no errors or warnings in application code.
- [x] Canonical test suite passes: 20 files, 184 tests.
- [x] Public sign-in renders without horizontal overflow at desktop and mobile viewport sizes.
- [x] Dashboard and API routes require authentication in the audited route set.

## Completion gate

- [x] All P1 items are fixed and covered by regression tests.
- [x] `npm audit --omit=dev` reports no high or critical production vulnerabilities.
- [x] `npm test` runs only canonical project tests.
- [x] Type checking, linting, and production build all pass after remediation.
- [ ] A signed-in browser pass verifies dashboard, quick-add, transaction editing, import, and responsive navigation.

## Remediation evidence — verified 2026-08-13

- Automated gate: `npm test` passed 20 canonical files and 184 tests; type checking, zero-warning ESLint, the production build, and `git diff --check` all exited successfully.
- Production dependencies: Next.js `15.5.23`, Hono `4.13.1`, PostCSS `8.5.26`, and Sharp `0.35.3`; `npm audit --omit=dev` reported `found 0 vulnerabilities`.
- API coverage: 52 request-level account, category, and transaction tests cover authentication, tenant isolation, validation, missing resources, ownership failures, conflicts, bulk bounds, and safe server errors.
- Date boundaries: an explicit `to=yyyy-MM-dd` resolves to `23:59:59.999` in the local calendar day, so timed transactions on the requested final day remain included; omitted `to` still defaults to the exact current time.
- Safe failures: the composed API root and injectable transaction app share a JSON 500 handler that returns only `{ "error": "Internal server error" }`; handled validation and uniqueness responses retain their specific status and payload.
- Summary: the five independent reads now start together; aggregation regression tests preserve a real `Other` category and label the synthetic bucket `Everything else`.
- Production bundle: overview first-load JavaScript fell from the measured 286 kB baseline to 140 kB (route payload 7.46 kB). Chart and sheet bundles are deferred.
- Public production browser pass: `/sign-in` had no horizontal overflow at 1440×900 or 390×844, observed zero `/api/categories` and `/api/summary` requests, loaded `/logo.svg` and `/favicon.ico`, and exposed usable keyboard focus through the sign-in controls. Unauthenticated navigation to `/` redirected to `/sign-in`.
- Production timing: the temporary server was ready in 153 ms; two direct `/sign-in` requests completed in 9.6 ms and 7.5 ms. This is recorded separately from the audited development cold compilation.
- Process hygiene: no Fintrak server was listening before the final gate. PID 2129 on port 3000 belonged to `/Users/aryanhegde/Documents/agency-os` and was intentionally untouched. The temporary Fintrak server on port 3011 was stopped after verification.
- Database indexes: `drizzle/0003_closed_mastermind.sql` was generated for `accounts(user_id)` and `transactions(account_id, date)` and was **not applied**. Run `EXPLAIN (ANALYZE, BUFFERS)` after representative data exists before deployment confirmation.

## Remaining follow-up

- Authenticated browser QA remains open because the available in-app browser had no signed-in Fintrak session. No credentials were created or requested, and authentication was not weakened.
- Local Node.js is `22.12.0`; one ESLint transitive package declares a `22.13.0` minimum. The verified lint/build/test gates pass, but upgrading the local Node patch removes the install-time engine warning.
- Vitest's original CommonJS/ESM warning is resolved by `vitest.config.mts`; Vite still emits a non-failing future-native-loader warning for `__dirname`. Replace it with `import.meta.dirname` when the supported project runtime baseline permits it.
