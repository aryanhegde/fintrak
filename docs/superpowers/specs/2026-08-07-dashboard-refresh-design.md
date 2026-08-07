# Dashboard Refresh — Design

**Date:** 2026-08-07
**Branch:** modernize
**Status:** Approved

## Goal

Replace the generic tutorial-style dashboard with a refined, modern design:
soft neutral page background, bento-grid card layout, gradient-filled charts,
a segmented donut with percentage badges, and three new insight cards
(financial health score, recurring transactions, top spending categories).
Palette stays blue, refined.

## Decisions (from brainstorming)

- **Scope:** visual restyle of existing components + new insight sections.
- **Palette:** keep blue as the accent; soften everything else (slate neutrals).
- **Header:** slim the blue band down; remove the card overlap (`-mt-24`).
- **New sections:** recurring transactions, financial health score, top
  spending categories. (Largest transactions: declined.)
- **Data layer:** new `/insights` Hono endpoint; `/summary` untouched.
- **Layout:** bento grid on a single 12-column grid.

## Page structure

```
Header (slim blue band: logo / nav / user, then welcome + filters)
└─ page background: bg-slate-50
Row 1: [Remaining] [Income] [Expenses]                (3 equal cards)
Row 2: [Cashflow chart ── 2/3] [Categories donut 1/3]
Row 3: [Health score] [Recurring] [Top categories]    (3 equal cards)
```

Content container stays `max-w-screen-2xl`; the `-mt-24` overlap is removed.

## Components

### Header (`components/header.tsx`, `welcome-msg.tsx`, `filters.tsx`)
- Reduce vertical padding (~half); remove `pb-36`.
- One row: logo + nav + user button. Second compact row: welcome message
  (smaller type) + filters inline.
- Gradient: `from-blue-700 to-blue-600`.

### Card baseline (all dashboard cards)
`rounded-2xl border border-slate-200/60 bg-white shadow-sm` — replaces
`border-none drop-shadow-sm`.

### Stat cards (`data-card.tsx`)
- Small uppercase tracked label, large `tabular-nums` amount (CountUp kept).
- % change becomes a tinted pill badge (emerald/rose background) instead of
  colored text.
- Icon in a smaller tinted circle; date range as one muted line.

### Cashflow chart (`chart.tsx`, `area-variant.tsx`, `line-variant.tsx`, `bar-variant.tsx`)
- Keep the area/line/bar switcher.
- Area variant: monotone curves, gradient fill fading to transparent, dashed
  horizontal-only gridlines, thin muted axes, custom floating tooltip
  (white rounded card with shadow, colored dot per series).
- Line/bar variants restyled to match the same axis/grid/tooltip treatment.

### Categories donut (`spending-pie.tsx`, `pie-variant.tsx`, radar/radial variants)
- Pie variant → segmented donut: `paddingAngle` gaps, rounded segment corners,
  percentage labels as small white pill badges positioned on the slices,
  wrapped dot legend below.
- Radar/radial variants stay selectable; colors updated to the new palette.

### Health score card (new: `components/health-score-card.tsx`)
- Circular tick-mark progress dial showing savings rate for the filtered
  period (`remaining / income`, clamped 0–100; 0 when income is 0).
- 2–3 computed insight bullets (e.g. income vs last period, top category
  concentration). Bullets are computed server-side and returned as strings.

### Recurring transactions card (new: `components/recurring-card.tsx`)
- List rows: payee initial avatar, payee name, "Next: {date}", amount and
  cadence label on the right.
- Empty state: "No recurring payments detected yet."

### Top categories card (new: `components/top-categories-card.tsx`)
- Top 5 expense categories for the filtered period: name, amount, slim
  progress bar scaled relative to the largest category.

Each new card exports a matching `*Loading` skeleton.

## Data layer

### New route: `app/api/[[...route]]/insights.ts`
Mounted in the route index like existing routes. Auth via Clerk middleware.
Query params: `from`, `to`, `accountId` (same validator shape as summary).

Returns:

```ts
{
  healthScore: number,          // 0–100 savings rate for the filtered period
  insights: string[],           // 2–3 generated bullets
  recurring: {
    payee: string,
    amount: number,             // milliunits, negative = expense
    cadence: "weekly" | "monthly",
    nextDate: string,           // ISO date
  }[],
  topCategories: { name: string, value: number }[],  // top 5 expenses
}
```

- `healthScore`, `insights`, `topCategories` respect `from/to/accountId`.
- `recurring` always scans the last 120 days (filter-independent by design;
  `accountId` still applies).

### Recurring detection algorithm
1. Fetch the user's transactions for the last 120 days.
2. Group by normalized payee (lowercased, trimmed).
3. Within a group, cluster amounts within ±10% of each other.
4. A cluster qualifies if it has ≥2 occurrences with a stable interval:
   median gap 25–35 days → monthly; 6–8 days → weekly.
5. `nextDate` = last occurrence + median gap.

### Client hook
`features/summary/api/use-get-insights.ts` — React Query, keyed on
`from/to/accountId`, mirroring `use-get-summary.ts`.

## Error/empty handling
- Insights endpoint failures: the three new cards render their empty states;
  the rest of the dashboard is unaffected (independent query).
- No transactions in period: health score card shows 0 with a neutral
  message; top categories and recurring show empty states.

## Out of scope
- Dark mode, schema changes, other pages (transactions/accounts/categories/
  settings), removing chart-type switchers, largest-transactions card.
