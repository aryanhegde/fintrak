# Transactions Page Redesign — Design Spec

**Date:** 2026-08-08
**Status:** Approved for implementation (user delegated creative authority; autonomous session)

## Concept — "A statement, not a spreadsheet"

The transactions page is where a finance app earns trust. Today it is a generic admin
table: a loud badge on every amount, repeated long date strings, ghost-button headers
with permanent sort icons, a spinner in a box while loading. The redesign treats the
page like a beautifully typeset bank statement: calm white surfaces on the existing
`bg-slate-50` canvas, strict numeric alignment, generous row height, and color spent
only where it carries meaning — money in, money out, warnings, selection.

Reference points: Mercury (quiet rows, right-aligned numerals, green inflows),
Linear (hover-revealed controls, floating selection bar), Stripe (small-caps headers,
hairline separators), Copilot Money (merchant monograms).

The page keeps its exact current behavior: same data hook, same sheets/dialogs, same
import flow logic, same bulk delete. This is a visual/IA overhaul, not a feature change.

## Shared vocabulary (page-level tokens)

- **Card shell:** `rounded-2xl border border-slate-200/60 bg-white shadow-sm` (matches restyled dashboard cards)
- **Hairline:** `border-slate-100`
- **Micro-label:** `text-[11px] font-semibold uppercase tracking-wider text-slate-400`
- **Accent:** blue-600 (house accent from header gradient/dashboard)
- **Money in:** emerald-600 · **Money out / destructive:** rose-600 · **Warning:** amber
- **Numerals:** `tabular-nums` in table columns only; tile values use proportional figures
- **Focus:** `focus-visible:ring-2 focus-visible:ring-blue-500/30`
- Interactive transitions: `transition-colors` (or `transition-opacity`), nothing slower than 200ms

## Layout (top → bottom)

### 1. Page header band (replaces the card-header title row)

Left: `Transactions` — `text-2xl font-bold tracking-tight text-slate-900`, with subline
`{n} transactions · {formatDateRange({from,to})}` in `mt-1 text-sm text-slate-500`
(uses `formatDateRange` from `lib/utils` + `useSearchParams`, mirroring dashboard).

Right (row on ≥sm, stacked full-width below): 
- **Import CSV** — outline: `h-9 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50` with `Upload` icon (this is the restyled `UploadButton`)
- **Add transaction** — primary: `h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm` with `Plus` icon. (Class overrides only — do not touch global button variants.)

### 2. Flow summary strip (new, `summary-tiles.tsx`)

`grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6`, each tile = card shell +
`px-5 py-4 flex items-center gap-4`:

- Icon disc `flex size-10 shrink-0 items-center justify-center rounded-xl`:
  - Money in → `bg-emerald-500/10` + `ArrowDownLeft` `size-5 text-emerald-600`
  - Money out → `bg-rose-500/10` + `ArrowUpRight` `size-5 text-rose-600`
  - Net → `bg-blue-500/10` + `Wallet` `size-5 text-blue-600`
- Text block: micro-label (`Money in` / `Money out` / `Net`) + value
  `text-xl font-semibold text-slate-900` (net when negative: `text-rose-600`).
- Values: in = `formatCurrency(sum of positive amounts)`; out = `formatCurrency(abs(sum of negatives))`;
  net = `formatCurrency(sum)`, with explicit `+` prefix when positive.
- Computed client-side from the already-fetched rows. No new API. No deltas (YAGNI).
- Per dataviz rules: values wear ink (slate-900), discs carry the semantic tint,
  sign + label accompany color (never color alone). Loading: 3 skeleton tiles same size.
- Hidden when the import variant is active.

### 3. Table card (new purpose-built `transactions-table.tsx`)

Card shell + `overflow-hidden`, wrapped `relative` (for the floating selection bar).
The shared `components/data-table.tsx` stays untouched (accounts/categories keep using it).

**Toolbar** — `flex items-center gap-4 px-5 py-4 border-b border-slate-100`:
- Search: relative wrapper, `Search` icon `absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400`,
  Input `h-9 w-full sm:w-72 rounded-lg border-slate-200 bg-slate-50 pl-9 text-sm placeholder:text-slate-400
  focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0`,
  placeholder `Search payee…` (drives the existing `payee` column filter).
- Right: `{n} transactions` count — `ml-auto text-xs text-slate-400 tabular-nums hidden md:block`.

**Header row** — `bg-slate-50/50`, cells `h-11 px-4 first:pl-5 last:pr-5`:
- Labels are micro-labels. Sortable headers are a full-cell `<button>`:
  `flex items-center gap-1` (amount: `justify-end w-full`), label + sort glyph:
  unsorted → `ChevronsUpDown size-3.5 text-slate-300 opacity-0 group-hover/head:opacity-100`;
  sorted → `ChevronUp`/`ChevronDown` `size-3.5 text-slate-600`. Set `aria-sort`.
- No ghost Buttons, no permanent `ArrowUpDown` clutter.

**Columns** (order): select · Payee · Category · Date · Account · Amount · actions

| Column | Spec |
|---|---|
| select | Checkbox restyled: `rounded-[4px] border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white`; width `w-10` |
| Payee | **Lead cell.** Monogram disc `size-9 rounded-full flex items-center justify-center text-xs font-semibold` tinted deterministically (hash of name → 8-pair palette: blue, emerald, violet, amber, rose, cyan, indigo, teal as `bg-{hue}-100 text-{hue}-700`), initials = first letters of first two words (fallback first 2 chars, uppercase). Name beside it `text-sm font-medium text-slate-900`. Gap `gap-x-3` |
| Category | Soft chip, clickable (existing `CategoryColumn` behavior): `inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors`. Uncategorized: `border border-dashed border-amber-300 bg-amber-50 text-amber-700` + `TriangleAlert size-3 mr-1`. Hidden `md`-down (`hidden md:table-cell`) |
| Date | `text-sm text-slate-500 tabular-nums whitespace-nowrap`, format `dd MMM yyyy` via `format(new Date(value), …)` (value may arrive as ISO string) |
| Account | Quiet link (existing `AccountColumn` behavior): `inline-flex items-center gap-x-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors` + `Landmark size-3.5`. Hidden `lg`-down (`hidden lg:table-cell`) |
| Amount | Right-aligned, `text-sm font-semibold tabular-nums whitespace-nowrap`; income `text-emerald-600` with `+` prefix; expense `text-slate-900` (minus comes from `formatCurrency`). **No badge.** |
| actions | `MoreHorizontal` ghost trigger `size-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100`, revealed on row hover: `max-lg:opacity-100 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 transition-opacity`. Dropdown `rounded-xl w-40 shadow-lg`: Edit (`Pencil size-4`), Delete (`Trash2 size-4`, `text-rose-600 focus:text-rose-600 focus:bg-rose-50`). Keep confirm dialog + mutations |

Responsive visibility lives in `columnDef.meta` (`headerClassName` / `cellClassName`,
via a module augmentation declared once in `columns.tsx`); the table applies them.

**Rows:** `group border-b border-slate-100 last:border-0 hover:bg-slate-50/80
data-[state=selected]:bg-blue-50/40 transition-colors`, cells `px-4 py-3 first:pl-5 last:pr-5`.

**Floating selection bar** (replaces toolbar delete button) — rendered when
`selected > 0`, sits above pagination inside the relative card:
`absolute inset-x-0 bottom-16 z-10 mx-auto w-fit flex items-center rounded-full
bg-slate-900 pl-4 pr-1.5 py-1.5 text-white shadow-xl shadow-slate-900/20
animate-in fade-in slide-in-from-bottom-2 duration-200`:
- `{n} selected` `text-sm font-medium tabular-nums whitespace-nowrap`
- divider `mx-3 h-4 w-px bg-white/20`
- Delete `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium
  text-rose-300 hover:bg-white/10 transition-colors` (`Trash2 size-3.5`) — existing
  confirm → `onDelete` → clear selection; respects `disabled`
- Clear `rounded-full p-1.5 hover:bg-white/10` (`X size-4`, `aria-label="Clear selection"`)

**Footer** — `flex items-center gap-3 px-5 py-3.5 border-t border-slate-100`:
- Left: `Showing {a}–{b} of {total}` `text-xs text-slate-500 tabular-nums` (empty-safe)
- Right cluster (`ml-auto flex items-center gap-3`): rows-per-page Select (10/25/50,
  trigger `h-8 w-[68px] rounded-lg border-slate-200 text-xs`) with micro "Rows" label;
  `Page {p} of {q}` `text-xs text-slate-500 tabular-nums hidden sm:block`;
  prev/next icon buttons `size-8 rounded-lg border border-slate-200 text-slate-500
  hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none`
  (`ChevronLeft`/`ChevronRight size-4`, aria-labels).

**Initial sort:** `[{ id: "date", desc: true }]` so the Date chevron reflects reality.

**Empty states** (inside table body area, `flex flex-col items-center justify-center py-20 px-6 text-center`):
- No data: disc `size-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4` +
  `ReceiptText size-7 text-blue-600`; `No transactions yet` `text-base font-semibold text-slate-900`;
  `mt-1 text-sm text-slate-500 max-w-sm` `Add your first transaction or import a CSV to get started.`;
  `mt-5` primary blue **Add transaction** button (rendered only when `onAddNew` prop provided).
- Search miss: `SearchX` in `bg-slate-100 text-slate-500` disc; `No matches for “{query}”`;
  sub `Try a different payee or clear the search.`; ghost **Clear search**
  (`text-blue-600 hover:bg-blue-50 rounded-lg`).

### 4. Loading state (skeleton, no spinner)

Real header band renders immediately (title + working buttons). Below: 3 skeleton tiles;
table card with toolbar skeleton (`h-9 w-72 rounded-lg`), 8 skeleton rows
(`flex items-center gap-4 px-5 py-[15px]`: `size-9 rounded-full` circle, `h-4 w-1/4`,
`h-4 w-24 hidden md:block`, `h-4 w-20 hidden lg:block`, `ml-auto h-4 w-24`) separated by
hairlines, footer skeleton. Exported as `TransactionsTableSkeleton` + `SummaryTilesLoading`.

### 5. Import variant restyle (logic byte-for-byte identical)

- Header band: title `Import transactions`, sub `Map your CSV columns — date, payee and
  amount are required.` Right: **Cancel** (outline recipe) + **Continue** (primary blue,
  disabled until 3/3 mapped; keep same submit flow).
- Card toolbar row: label `Match columns` (micro-label) + three requirement chips
  (`date`, `payee`, `amount`): mapped → `bg-emerald-100 text-emerald-700` +
  `CheckCircle2 size-3.5`; unmapped → `bg-slate-100 text-slate-500` + `Circle size-3.5`;
  chip base `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize`.
- Mapping table: card shell; header row `bg-slate-50/50`; `TableHeadSelect` trigger:
  `h-8 w-full min-w-32 rounded-lg border px-2.5 text-xs font-medium capitalize` —
  unmapped `border-slate-200 bg-white text-slate-500`, mapped `border-blue-200 bg-blue-50 text-blue-700`;
  body cells `text-sm text-slate-600`, hairline row borders.
- `ImportCard` keeps its own full-page container (as today) but adopts the header band pattern.

## Architecture & isolation

- `app/(dashboard)/transactions/page.tsx` — orchestration + header band + variants + loading.
- `app/(dashboard)/transactions/transactions-table.tsx` — **new**, purpose-built table
  (props `{ columns, data, filterKey, onDelete, disabled?, onAddNew? }`). Generic over row type.
- `app/(dashboard)/transactions/summary-tiles.tsx` — **new**, `TransactionsSummary({ transactions })`.
- `app/(dashboard)/transactions/columns.tsx` — rewritten cells/headers; exports unchanged
  (`columns`, `ResponseType`) + the `ColumnMeta` augmentation.
- `category-column.tsx`, `account-column.tsx`, `actions.tsx` — restyled, same props/behavior.
- `import-card.tsx`, `import-table.tsx`, `table-head-select.tsx`, `upload-button.tsx` — restyled, same props/behavior.
- **Untouched:** `components/data-table.tsx`, `components/ui/*`, all hooks/API/features, other pages.

## Error handling & edge cases

- Amounts arrive as rupee floats (hook converts miliunits); dates may deserialize as ISO
  strings — always `new Date(value)` before `format`.
- Long payee names: `truncate` within a `min-w-0` cell (monogram `shrink-0`).
- Zero-row filter result ≠ zero data — distinct empty states (see above).
- Pagination footer must be arithmetic-safe on empty data (`Showing 0–0 of 0` → hide range, show `No transactions`).
- `disabled` prop gates delete affordances exactly as today.

## Testing

- `npx tsc --noEmit`, `npm run lint`, `npm test` (existing vitest suite must stay green).
- Browser verification of every state: list, hover, sort, selection bar, search miss,
  empty, loading, pagination, page-size change, import mapping, mobile (375px) and
  desktop (1280px+). Screenshot-driven pixel pass at the end.
