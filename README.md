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
