# Micro-expense refinement — design

**Date:** 2026-08-10
**Status:** Approved by user (approach A: refine in place)

## Problem

Fintrak was built as a general-purpose finance SaaS (accounts, payees, CSV import). Its actual user is a college student logging many small cash spends per day (₹10 tea, ₹60 snacks, ₹100 travel) who wants to look back a month later and see clearly how much went to each category (tea, cigarettes, food, snacks, travel, other). Money is one pot — parents send it, it gets spent; no cash-vs-UPI split.

Two gaps, equally important:

1. **Entry friction.** Logging a ₹10 chai requires opening a sheet and filling payee, account, category, date, and amount. Too slow for 10+ micro-spends a day, logged on a phone at the moment of spending.
2. **Review clarity.** The monthly per-category breakdown is not front and center; the dashboard is a generic chart grid.

## Decision

Refine in place (approach A). Keep the stack (Next.js 15, Hono, Drizzle/Neon, Clerk, React Query) and the feature-folder architecture — both are sound. Make the app *behave* purpose-built without destructive schema surgery. Rejected: stripping accounts/payee out of the schema (destructive migration, no daily-use benefit) and purely additive bolt-ons (leaves required-payee friction in the API).

## 1. Data & API

- **Schema migration (the only one):** `transactions.payee` becomes nullable. Amounts stay integer miliunits; dates stay timestamps; category FK unchanged.
- **Hidden default account:** server-side helper `ensureDefaultAccount(userId)` returns the user's first account, creating one named "Cash" if none exists. Quick-add entries use it implicitly. The accounts feature code remains but disappears from the UI.
- **Category seeding:** idempotent bootstrap endpoint (`POST /api/categories/bootstrap`): if the user has zero categories, create Tea, Cigarettes, Food, Snacks, Travel, Other. Called by the client when it observes an empty category list. Categories remain fully editable via the existing management UI.
- **Transactions API:** quick-add reuses `POST /api/transactions`; `payee` optional in the zod insert schema. Display components fall back to the category name (or "—") when payee is null.
- **Monthly aggregation:** reuse the existing summary aggregation bounded to a calendar month, extended to return **all** categories (not top-N) plus the previous month's per-category totals for deltas. Month boundary math is IST-local (the user's device timezone), computed client-side and passed as from/to.

## 2. Quick-add flow

- A persistent **+** button in the navigation, thumb-reachable on mobile.
- Opens a full-screen (mobile) / modal (desktop) entry surface:
  - Category chips, one per category the user has, in the order the categories API returns them (no ordering feature).
  - Large rupee amount keypad (numeric, paise not needed for entry — whole rupees; stored ×1000 as miliunits).
  - Optional single-line note.
  - Date defaults to now; one-tap "yesterday" toggle for catch-up logging. Full date picker not shown here (use the edit form for older corrections).
- On save: success toast, amount clears, surface **stays open** for the next entry. Explicit close to leave.
- Target interaction: chip → amount → save in under 3 seconds.

## 3. Monthly review (home screen)

The dashboard home (`app/(dashboard)/page.tsx`) becomes the monthly breakdown:

- Month picker, defaulting to the current month.
- Total spent for the month.
- One row per category with spend: name, amount, share-of-total bar, delta vs previous month.
- Existing chart components (pie/area) remain below as secondary detail, driven by the same month range.
- The transactions page is unchanged and remains the full statement view. Follows the established visual language (card shell, micro-labels, tabular-nums, INR via `formatCurrency`).

## 4. Navigation & form cleanup

- Nav: **Overview · Transactions · Categories · Settings**. Accounts leaves the nav (code retained).
- Full transaction form: account picker removed (uses default account), payee optional. Form remains for editing and unusual entries.

## 5. Error handling

- Failed quick-add save (flaky campus network): the entry stays populated with an inline error and retry; no silent loss.
- Bootstrap/seeding failures are non-fatal: the quick-add still works with whatever categories exist.
- Out of scope (deliberate): offline/PWA support, money-in tracking flows, cash-vs-UPI accounts, budgets/limits.

## 6. Testing

On the existing vitest setup:

- Month-bounds math (first/last instant, year rollover).
- Seeding idempotency (second bootstrap call creates nothing).
- API accepts payee-less transaction creation; rejects malformed amounts.
- Keypad input → miliunits conversion (₹10 → 10000).
- Display fallback when payee is null.
