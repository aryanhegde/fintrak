# Fintrak Revival + Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the 2-year-old fintrak finance tracker running on Next.js 15.5 + React 19 with a clean, committed git tree, reusing the still-alive Neon database and Clerk app.

**Architecture:** No architectural changes. This is a dependency modernization: Next 14→15, React 18→19, Clerk v5→v7, Drizzle ORM 0.30→0.45 / drizzle-kit 0.20→0.31, plus within-major bumps. The app structure (Next App Router pages + Hono catch-all API at `app/api/[[...route]]/` + feature hooks in `fearures/`→`features/`) stays identical.

**Tech Stack:** Next.js 15.5.x, React 19, Clerk v7 (`@clerk/nextjs`, `@clerk/backend` 3.x, `@hono/clerk-auth` 3.x), Hono 4.12, Drizzle ORM 0.45 + drizzle-kit 0.31, Neon serverless Postgres, TanStack Query 5, Tailwind 3 (unchanged).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-fintrak-revival-design.md`
- **Never write to the live Neon database.** No `db:migrate`, no `db:seed`, no DDL. Read-only queries are allowed for verification.
- **Do not edit `.env` values for Clerk keys or DATABASE_URL** — they are live and working. Only key *names* may change where Clerk v7 renamed them (Task 4).
- Deliberately NOT upgraded: `tailwindcss` (stay 3.x), `zod` major (stay 3.x — bump to `^3.25.0` only, required by drizzle-zod 0.8 / @hono/zod-validator 0.8), `react-day-picker` (stay 8.10.1), `lucide-react` (stay 0.378.x), `zustand` (stay 4.x), `sonner` (stay 1.x), `next-themes` (stay 0.3.x).
- There is no test suite; each task's verification is: `npx tsc --noEmit` passes, `npm run build` passes, and where stated, a dev-server boot probe.
- Boot probe command (used in several tasks):
  ```bash
  (nohup npm run dev > /tmp/fintrak-dev.log 2>&1 &) && sleep 8 && \
  curl -s -o /dev/null -w "sign-in: %{http_code}\n" http://localhost:3000/sign-in && \
  curl -s -o /dev/null -w "root: %{http_code} -> %{redirect_url}\n" -H "Sec-Fetch-Dest: document" -H "Accept: text/html" http://localhost:3000/ && \
  pkill -f "next dev"
  ```
  Expected: `sign-in: 200` and `root: 307 -> https://rich-yeti-44.clerk.accounts.dev/...` (unauthenticated redirect to Clerk). Any 500 = failure; read `/tmp/fintrak-dev.log`.
- Commit after every task. Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Revert the stale 2-year-old working-tree diff

**Files:**
- Modify (revert): `app/api/[[...route]]/accounts.ts`, `fearures/accounts/api/use-create-account.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a clean working tree for all later tasks

- [ ] **Step 1: Confirm the diff is only the known trivial changes**

Run: `git diff --stat`
Expected: exactly two files — `app/api/[[...route]]/accounts.ts` (1 blank line added) and `fearures/accounts/api/use-create-account.ts` (debug `console.log`). If anything else appears, STOP and report.

- [ ] **Step 2: Revert both files**

```bash
git checkout -- "app/api/[[...route]]/accounts.ts" "fearures/accounts/api/use-create-account.ts"
```

- [ ] **Step 3: Verify clean tree**

Run: `git status --porcelain`
Expected: empty output (untracked `node_modules/` and `.env` are gitignored). No commit needed — this task only discards uncommitted noise.

---

### Task 2: Rename `fearures/` → `features/` and update all imports

**Files:**
- Rename: `fearures/` → `features/` (entire directory, via `git mv`)
- Modify (import paths only): `app/(dashboard)/accounts/actions.tsx`, `app/(dashboard)/accounts/page.tsx`, `app/(dashboard)/categories/actions.tsx`, `app/(dashboard)/categories/page.tsx`, `app/(dashboard)/transactions/account-column.tsx`, `app/(dashboard)/transactions/actions.tsx`, `app/(dashboard)/transactions/category-column.tsx`, `app/(dashboard)/transactions/page.tsx`, `components/account-filter.tsx`, `components/data-charts.tsx`, `components/data-grid.tsx`, `providers/sheet-provider.tsx`, plus files inside the renamed directory that self-reference `@/fearures` (`new-account-sheet.tsx`, `edit-transaction-sheet.tsx`, `new-transaction-sheet.tsx`)

**Interfaces:**
- Consumes: clean tree from Task 1
- Produces: all feature imports resolve via `@/features/...` (tsconfig alias `@/*` → `./*` is unchanged)

- [ ] **Step 1: Rename the directory**

```bash
git mv fearures features
```

- [ ] **Step 2: Rewrite every `fearures` reference to `features`**

```bash
grep -rl "fearures" --include="*.ts" --include="*.tsx" app components features providers lib db hooks | while read f; do
  sed -i '' 's/fearures/features/g' "$f"
done
```

- [ ] **Step 3: Verify zero references remain**

Run: `grep -rn "fearures" --include="*.ts" --include="*.tsx" --include="*.json" . --exclude-dir=node_modules --exclude-dir=.next`
Expected: no output.

- [ ] **Step 4: Typecheck and boot probe**

Run: `npx tsc --noEmit` — Expected: exit 0, no errors.
Run the Global Constraints boot probe — Expected: `sign-in: 200`, `root: 307`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Rename misspelled fearures/ directory to features/

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Upgrade Next.js 14.2.3 → 15.5.x and React 18 → 19

**Files:**
- Modify: `package.json` (deps + devDeps)
- Create: `.npmrc` (legacy peer deps — `react-day-picker@8` and `react-countup` don't declare React 19 in peers but work at runtime)
- Possibly modify: none expected — no page/layout uses `params`/`searchParams`, and no server-side `auth()`/`headers()`/`cookies()` calls exist (verified during planning)

**Interfaces:**
- Consumes: clean renamed tree from Task 2
- Produces: app compiles and runs on `next@15.5.x`, `react@19.x`. Task 4 depends on this because `@clerk/nextjs@7` requires Next ≥15.2.

- [ ] **Step 1: Create `.npmrc`**

```
legacy-peer-deps=true
```

- [ ] **Step 2: Bump framework packages**

```bash
npm install next@^15.5.20 react@^19.2.0 react-dom@^19.2.0 eslint-config-next@^15.5.20
npm install -D @types/react@^19 @types/react-dom@^19
```

- [ ] **Step 3: Run the async-request-API codemod (expected no-op, run to be safe)**

```bash
npx @next/codemod@latest next-async-request-api . --force
```

Expected: completes; `git status` shows no source changes (planning found zero usages of `params`/`searchParams`/`headers()`/`cookies()`). If it does change files, review each change — it should only be awaiting request APIs.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. If React-19 type errors appear (commonly: implicit `JSX.Element`, `ReactNode` mismatches from stale `@types/react` duplicates), run `npm dedupe` first; fix genuine errors minimally in place.

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: build succeeds. Known acceptable warnings: `punycode` deprecation, edge-runtime notices for `app/api/[[...route]]/route.ts` (it declares `export const runtime = "edge"`, still supported in Next 15).

- [ ] **Step 6: Boot probe**

Run the Global Constraints boot probe — Expected: `sign-in: 200`, `root: 307` (Clerk v5 still handles auth at this point).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .npmrc
git commit -m "Upgrade to Next.js 15.5 and React 19

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Upgrade Clerk v5 → v7 (+ @clerk/backend 3.x, @hono/clerk-auth 3.x)

**Files:**
- Modify: `package.json`, `middleware.ts`, `.env` (rename two deprecated env keys, values unchanged)
- Unchanged but verify-compile: `app/layout.tsx` (ClerkProvider), `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx` (SignIn/SignUp/ClerkLoaded/ClerkLoading), `components/header.tsx` (UserButton), `components/welcome-msg.tsx` (useUser), all `app/api/[[...route]]/*.ts` (clerkMiddleware/getAuth from `@hono/clerk-auth`)

**Interfaces:**
- Consumes: Next 15 from Task 3 (`@clerk/nextjs@7` peer-requires it)
- Produces: working auth on Clerk v7; API routes still authenticate via `@hono/clerk-auth`'s `getAuth(c)` returning `{ userId }`

- [ ] **Step 1: Bump Clerk packages**

```bash
npm install @clerk/nextjs@^7 @clerk/backend@^3 @hono/clerk-auth@^3
```

- [ ] **Step 2: Update `middleware.ts` for the v6+ async `auth` param**

In Clerk v6+, the middleware callback's `auth` argument is no longer called as `auth().protect()`; it exposes `protect()` directly and returns a Promise. Replace the file contents with:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/", "/api"]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+.[w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

(Only the callback body changes; keep the matcher exactly as-is.)

- [ ] **Step 3: Rename deprecated redirect env keys in `.env`**

Clerk v6+ replaced `AFTER_SIGN_IN`/`AFTER_SIGN_UP` URLs with fallback-redirect keys. Edit `.env`, changing ONLY these two key names (keep each line's existing value):

- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=` → `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=` → `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=`

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass. If `@hono/clerk-auth@3` raises type errors around `getAuth`, check its changelog — `getAuth(c)` still returns an object with `userId: string | null`; fix imports only, do not restructure route logic.

- [ ] **Step 5: Boot probe + live API auth check**

Run the Global Constraints boot probe — Expected: `sign-in: 200`, `root: 307` to the Clerk handshake URL.
Additionally: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/accounts` (while dev server is up) — Expected: `401`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json middleware.ts
git commit -m "Upgrade Clerk v5 to v7 (async middleware auth, hono adapter v3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(`.env` is gitignored; the key rename is not committed.)

---

### Task 5: Upgrade Drizzle ORM/kit, Neon driver, and the Zod validator chain

**Files:**
- Modify: `package.json`, `drizzle.config.ts`, `package.json` scripts (`db:generate`)
- Unchanged but verify-compile: `db/schema.ts`, `db/drizzle.ts`, `scripts/migrate.ts`, `scripts/seed.ts`, all `app/api/[[...route]]/*.ts` (zValidator usages)

**Interfaces:**
- Consumes: nothing from Tasks 3–4 strictly, but runs after to keep one moving part per commit
- Produces: `db` export from `db/drizzle.ts` unchanged in shape; `insertAccountSchema`/`insertCategorySchema`/`insertTransactionSchema` from `db/schema.ts` keep working with `zValidator`

- [ ] **Step 1: Bump packages**

```bash
npm install drizzle-orm@^0.45.2 drizzle-zod@^0.8.3 zod@^3.25.0 @hono/zod-validator@^0.8.0 @neondatabase/serverless@^1.1.0
npm install -D drizzle-kit@^0.31.10
```

- [ ] **Step 2: Rewrite `drizzle.config.ts`** (drizzle-kit 0.31 uses `dialect` + `dbCredentials.url`; also fixes the old `"/env"` dotenv-path typo)

```ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 3: Update the generate script in `package.json`** (drizzle-kit 0.31 CLI renamed `generate:pg` → `generate`; schema/out now come from the config file)

```json
"db:generate": "drizzle-kit generate",
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both pass. Likely friction points: (a) drizzle-zod 0.8's `createInsertSchema` return type is stricter — the three insert schemas in `db/schema.ts` should still compile as-is; (b) `@hono/zod-validator@0.8` requires zod ≥3.25 — already bumped.

- [ ] **Step 5: Read-only live DB verification** (allowed by Global Constraints; no writes)

```bash
node -e "
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql('select count(*)::int as n from accounts').then(r => console.log('accounts rows:', r[0].n));
"
```

Expected: prints a row count without error (driver v1 works against the live DB).

- [ ] **Step 6: Verify drizzle-kit config parses WITHOUT running a migration**

Run: `npx drizzle-kit check` (validates config + existing migration folder consistency; makes no DB changes)
Expected: exits without config errors. Do NOT run `db:generate`, `db:migrate`, or `db:studio` against the live DB.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts
git commit -m "Upgrade Drizzle ORM 0.45 / drizzle-kit 0.31, Neon driver v1, zod-validator chain

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Within-major bumps for the remaining dependencies

**Files:**
- Modify: `package.json`, `package-lock.json` only

**Interfaces:**
- Consumes: all previous tasks committed
- Produces: final dependency set for verification in Task 7

- [ ] **Step 1: Update within existing semver ranges**

```bash
npm update
```

This respects `^` ranges: Hono → 4.12.x, TanStack Query → 5.101.x, TanStack Table → 8.x latest, recharts → 2.15.4, react-select → 5.10.x, date-fns → 3.6.x latest, react-hook-form → 7.x latest, etc. It cannot cross majors, so the kept-back list in Global Constraints is safe automatically (`lucide-react@^0.378` pins to 0.378.x, `sonner@^1`, `zustand@^4`, `next-themes@^0.3`, `tailwindcss@^3.4`, `react-day-picker@^8.10`).

- [ ] **Step 2: Confirm no kept-back package crossed a major**

Run: `npm ls next react tailwindcss zod react-day-picker zustand sonner next-themes lucide-react --depth=0`
Expected: next 15.5.x, react 19.x, tailwindcss 3.4.x, zod 3.x, react-day-picker 8.10.x, zustand 4.x, sonner 1.x, next-themes 0.3.x, lucide-react 0.378.x.

- [ ] **Step 3: Typecheck, build, boot probe**

Run: `npx tsc --noEmit` && `npm run build`, then the Global Constraints boot probe.
Expected: all pass, `sign-in: 200`, `root: 307`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Update remaining dependencies within existing majors

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end verification in a real browser + README refresh

**Files:**
- Modify: `README.md` (replace create-next-app boilerplate with accurate run instructions)
- Create: `.claude/launch.json` (dev-server launch config for the browser preview)

**Interfaces:**
- Consumes: fully upgraded app from Tasks 1–6
- Produces: human-verified working app; accurate README

- [ ] **Step 1: Create `.claude/launch.json`**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "fintrak-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

- [ ] **Step 2: Start the dev server via the browser preview tool and open http://localhost:3000**

Expected: redirect to `/sign-in`, Clerk sign-in form renders (no blank page, no console errors). Check the browser console for errors with the console-reading tool.

- [ ] **Step 3: Hand off to the user for sign-in**

Claude must NOT enter credentials. Tell the user: "The app is running at http://localhost:3000 — please sign in with your Clerk account (the Google/email login you used 2 years ago), then tell me when you're in."

- [ ] **Step 4: After user signs in, verify the core flows in the browser**

- Dashboard (`/`) loads: welcome message, data cards, and charts render using live Neon data.
- `/accounts` lists existing accounts from the DB.
- Create a test account named `revival-test` via the "Add new" flow → appears in the list (this is a user-data write via the app, permitted — it is not a schema/migration write).
- Delete the `revival-test` account → disappears from the list.
- `/transactions` and `/categories` pages load without errors.
- Browser console: no red errors during the above.

- [ ] **Step 5: Replace `README.md` boilerplate**

```markdown
# fintrak

Personal finance tracker: accounts, categories, transactions, and a dashboard
with charts. Next.js 15 (App Router) + React 19, Clerk auth, Hono API routes,
Drizzle ORM on Neon serverless Postgres, Tailwind 3 + shadcn/ui.

## Run locally

1. `npm install`
2. Create `.env` with:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` (Clerk app keys)
   - `DATABASE_URL` (Neon Postgres connection string)
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/`
3. `npm run dev` → http://localhost:3000

## Database

Schema lives in `db/schema.ts`. `npm run db:generate` creates migrations in
`drizzle/`; `npm run db:migrate` applies them (uses `bun`).
```

- [ ] **Step 6: Final commit**

```bash
git add README.md .claude/launch.json
git commit -m "Refresh README and add dev-server launch config

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
