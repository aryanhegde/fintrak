# Fintrak Revival + Modernization — Design

**Date:** 2026-07-13
**Status:** Approved

## Context

Fintrak is a personal finance tracker (accounts, categories, transactions, dashboard
with charts) built ~2 years ago on Next.js 14.2.3 / React 18 / Clerk v5 / Hono 4.3 /
Drizzle ORM 0.30 / Neon Postgres / Tailwind 3. It has sat untouched since.

Findings from exploration (2026-07-13):

- The app **boots and works as-is** on Node 22: dev server ready in ~4s, unauthenticated
  visits redirect to Clerk sign-in, API routes return 401 correctly.
- The **Neon database is alive** with all tables intact (`accounts`, `categories`,
  `transactions`, `subscriptions`) and the **Clerk keys are valid** (API returns 200).
  Both are reused; no new accounts or data migration needed.
- The working tree has a trivial 2-year-old uncommitted diff: one blank line in
  `app/api/[[...route]]/accounts.ts` and a debug `console.log` in
  `fearures/accounts/api/use-create-account.ts`.
- The feature directory is misspelled: `fearures/`.

## Goal

`npm run dev` serves a fully working app on a modern, supported stack:
**Next.js 15.5.x + React 19**, latest compatible Clerk major, Drizzle ORM 0.45 /
drizzle-kit 0.31, with a clean committed git tree. Existing Neon DB and Clerk app
are reused unchanged.

## Plan of record

### Phase 1 — Cleanup (own commit, before any upgrades)

1. Revert both stale uncommitted files (`app/api/[[...route]]/accounts.ts`,
   `fearures/accounts/api/use-create-account.ts`) to their committed state — the
   changes are a blank line and a debug `console.log`, neither worth keeping.
2. `git mv fearures features` and update every import/path reference across the repo.
3. Verify the app still builds and boots; commit.

### Phase 2 — Framework upgrade

1. **Next.js 14.2.3 → 15.5.x, React 18 → 19.** Use `@next/codemod` for the async
   request APIs (`params`, `searchParams`, `headers`, `cookies` become Promises).
   Touch points: the Hono catch-all route `app/api/[[...route]]/route.ts`, any page
   components reading params.
2. **Clerk v5 → newest major whose peer deps accept Next 15** (v6 made `auth()`
   async; v7 is current). Also bump `@clerk/backend` and `@hono/clerk-auth` to
   matching versions. `middleware.ts` stays on `clerkMiddleware`.
3. **Drizzle ORM → 0.45.x, drizzle-kit → 0.31.x.** Rewrite `drizzle.config.ts` to
   `defineConfig` with `dialect: "postgresql"`; update package.json scripts
   (`generate:pg` → `generate`). Schema code unchanged. **No migrations are run
   against the live database** — the schema is not changing.
4. **Minor/patch bumps** for Hono, `@hono/zod-validator`, TanStack Query/Table,
   `@neondatabase/serverless`, and the rest of the dependency list.
5. **Deliberately NOT upgraded** (kept back on purpose):
   - Tailwind 3 (v4 is a CSS-first config rewrite, zero functional gain here)
   - Zod 3 (Zod 4 ripples into drizzle-zod / @hono/zod-validator APIs)
   - react-day-picker 8 (v9 breaks the calendar component's props)

### Phase 3 — Verification

No test suite exists and none is added (out of scope for a revival). Verification:

1. `npx tsc --noEmit` passes.
2. `next build` passes.
3. Drive the real app in a browser: sign-in page renders, dashboard loads after
   sign-in, account/category/transaction CRUD works against the live Neon DB.
   The user signs in themselves (Claude does not handle credentials).

## Risks & handling

- **React 19 peer-dependency friction** from older libs (`react-select`,
  `recharts`, `react-use`, `react-countup`): bump each to its React-19-compatible
  release; if a lib has none, pin with an npm `overrides` entry and verify at
  runtime before accepting it.
- **Clerk major-version API drift** beyond `auth()` async: follow the official
  v5→v6 (→v7) migration notes; the app's Clerk surface is small (middleware,
  two auth pages, `@hono/clerk-auth` in API routes).
- Everything is reversible via git; the live database is never written to by the
  upgrade itself.

## Out of scope

- Deployment (Vercel etc.)
- New features, tests, Tailwind 4, Zod 4
- Schema changes or data migration
