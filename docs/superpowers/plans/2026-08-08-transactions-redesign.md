# Transactions Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Transactions page as a "statement, not a spreadsheet" — page header band, money in/out/net summary tiles, a purpose-built statement-style table (monogram payees, right-aligned ink amounts, hover-revealed actions, floating selection bar, skeleton loading, designed empty states), and a matching import-flow restyle — with zero behavior change.

**Architecture:** All work lives in `app/(dashboard)/transactions/` plus one pure-helper module with tests. The shared `components/data-table.tsx` (used by accounts/categories) and all `components/ui/*`, hooks, and API code are untouched. A new purpose-built `TransactionsTable` replaces the generic table only on this page. Spec: `docs/superpowers/specs/2026-08-08-transactions-redesign-design.md`.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 3 (+tailwindcss-animate), shadcn/ui primitives, TanStack Table v8, lucide-react, date-fns v3, vitest.

## Global Constraints

- **Zero behavior change.** Same data hook (`getUserTransactions`), same sheets/dialogs (`useNewTransaction`, `useOpenTransaction`, `useOpenCategory`, `useOpenAccount`, `useConfirm`), same mutations, same import flow logic.
- **Never touch:** `components/data-table.tsx`, anything in `components/ui/`, `features/`, `app/api/`, `lib/utils.ts`, global button/badge variants.
- **Git hygiene:** the repo has unrelated uncommitted changes (`components/navigation.tsx`, `lib/hono.ts`, `middleware.ts`). NEVER run `git add -A`, `git add .`, or `git commit -a`. Work happens on branch `redesign/transactions-page`.
- **Execution mode (parallel wave):** implementation subagents EDIT FILES ONLY — they run no git commands and no repo-wide `tsc`/`lint` (sibling tasks may be mid-flight; repo-wide checks only pass at wave end). Task 1's agent runs `npm test` (its files are self-contained). The main session runs verification and makes each task's commit at wave boundaries using the exact `git add` lists below.
- **Page-level tokens (use verbatim):**
  - Card shell: `rounded-2xl border border-slate-200/60 bg-white shadow-sm`
  - Hairline: `border-slate-100`
  - Micro-label: `text-[11px] font-semibold uppercase tracking-wider text-slate-400`
  - Accent blue-600; money-in emerald-600; destructive rose-600; warning amber
  - `tabular-nums` in table columns/counters only; tile values proportional (no tabular-nums)
  - Focus: `focus-visible:ring-2 focus-visible:ring-blue-500/30`
- Icons: lucide-react only. Currency: `formatCurrency` from `@/lib/utils` (INR). Dates may deserialize as ISO strings — always `new Date(value)` before date-fns `format`.
- Verify commands (run from repo root): `npx tsc --noEmit` · `npm run lint` · `npm test`.
- All components in this folder are client components — keep existing `"use client"` directives where present, add to any new file whose module (or its imports) uses hooks. `columns.tsx` already has it today; keep it.

---

### Task 1: Pure helpers — monogram + summary math (TDD)

**Files:**
- Create: `app/(dashboard)/transactions/lib.ts`
- Test: `app/(dashboard)/transactions/__tests__/lib.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (later tasks import these from `"./lib"` / `"../lib"`):
  - `summarizeTransactions(rows: { amount: number }[]): { inflow: number; outflow: number; net: number }`
  - `monogramInitials(name: string): string`
  - `monogramStyle(name: string): string` (returns one of `MONOGRAM_STYLES`)
  - `MONOGRAM_STYLES: readonly string[]` (8 Tailwind class pairs)

- [ ] **Step 1: Write the failing test** at `app/(dashboard)/transactions/__tests__/lib.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  MONOGRAM_STYLES,
  monogramInitials,
  monogramStyle,
  summarizeTransactions,
} from "../lib";

describe("summarizeTransactions", () => {
  it("splits inflow, outflow and net", () => {
    const rows = [{ amount: 200 }, { amount: -120.5 }, { amount: 100 }, { amount: -30 }];
    expect(summarizeTransactions(rows)).toEqual({
      inflow: 300,
      outflow: 150.5,
      net: 149.5,
    });
  });

  it("returns zeros for an empty period", () => {
    expect(summarizeTransactions([])).toEqual({ inflow: 0, outflow: 0, net: 0 });
  });
});

describe("monogramInitials", () => {
  it("uses first letters of the first two words", () => {
    expect(monogramInitials("Amazon Prime")).toBe("AP");
  });

  it("uses the first two letters of a single word", () => {
    expect(monogramInitials("Uber")).toBe("UB");
  });

  it("trims whitespace and uppercases", () => {
    expect(monogramInitials("  swiggy  ")).toBe("SW");
  });

  it("falls back to ? for empty names", () => {
    expect(monogramInitials("")).toBe("?");
    expect(monogramInitials("   ")).toBe("?");
  });
});

describe("monogramStyle", () => {
  it("is deterministic and drawn from the palette", () => {
    const style = monogramStyle("Netflix");
    expect(monogramStyle("Netflix")).toBe(style);
    expect(MONOGRAM_STYLES).toContain(style);
  });

  it("handles empty names", () => {
    expect(MONOGRAM_STYLES).toContain(monogramStyle(""));
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../lib`.

- [ ] **Step 3: Implement** `app/(dashboard)/transactions/lib.ts`:

```ts
export const MONOGRAM_STYLES = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
] as const;

export function summarizeTransactions(rows: { amount: number }[]) {
  let inflow = 0;
  let outflow = 0;

  for (const { amount } of rows) {
    if (amount > 0) inflow += amount;
    else outflow += Math.abs(amount);
  }

  return { inflow, outflow, net: inflow - outflow };
}

export function monogramInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return (words[0][0] + words[1][0]).toUpperCase();
}

export function monogramStyle(name: string) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);

  return MONOGRAM_STYLES[hash % MONOGRAM_STYLES.length];
}
```

Floating-point note: `inflow - outflow` on the test data gives exactly `149.5`; if you see float noise in the test run, compare with `toBeCloseTo` instead — but `toEqual` is expected to pass with these values.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test` → all pass (including the pre-existing `lib/__tests__/insights.test.ts`).
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/transactions/lib.ts" "app/(dashboard)/transactions/__tests__/lib.test.ts"
git commit -m "feat(transactions): add monogram and summary helpers"
```

---

### Task 2: Column definitions + cell components

**Files:**
- Modify (full rewrite of JSX/styling, same exports & behavior): `app/(dashboard)/transactions/columns.tsx`
- Modify: `app/(dashboard)/transactions/category-column.tsx`
- Modify: `app/(dashboard)/transactions/account-column.tsx`
- Modify: `app/(dashboard)/transactions/actions.tsx`

**Interfaces:**
- Consumes: `monogramInitials`, `monogramStyle` from `"./lib"` (Task 1).
- Produces: `columns: ColumnDef<ResponseType>[]` and `type ResponseType` (export names unchanged — `page.tsx`/table import them as today), plus a `@tanstack/react-table` `ColumnMeta` module augmentation adding optional `headerClassName` / `cellClassName` (Task 3's table reads these).

- [ ] **Step 1: Rewrite `columns.tsx`** — keep the existing `ResponseType` derivation and `"use client"`; replace all header/cell rendering:

```tsx
"use client";

import { format } from "date-fns";
import { InferResponseType } from "hono";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { Column, ColumnDef, RowData } from "@tanstack/react-table";

import { client } from "@/lib/hono";
import { cn, formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

import { Actions } from "./actions";
import { AccountColumn } from "./account-column";
import { CategoryColumn } from "./category-column";
import { monogramInitials, monogramStyle } from "./lib";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
  }
}

export type ResponseType = InferResponseType<
  typeof client.api.transactions.$get,
  200
>["data"][0];

const SortableHeader = ({
  column,
  label,
  align,
}: {
  column: Column<ResponseType, unknown>;
  label: string;
  align?: "right";
}) => {
  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      aria-label={`Sort by ${label.toLowerCase()}`}
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "group/head flex w-full items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600",
        align === "right" && "justify-end"
      )}
    >
      {label}
      {sorted === "asc" ? (
        <ChevronUp className="size-3.5 text-slate-600" />
      ) : sorted === "desc" ? (
        <ChevronDown className="size-3.5 text-slate-600" />
      ) : (
        <ChevronsUpDown className="size-3.5 text-slate-300 opacity-0 transition-opacity group-hover/head:opacity-100" />
      )}
    </button>
  );
};

export const columns: ColumnDef<ResponseType>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="rounded-[4px] border-slate-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="rounded-[4px] border-slate-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { headerClassName: "w-10", cellClassName: "w-10" },
  },
  {
    accessorKey: "payee",
    header: ({ column }) => <SortableHeader column={column} label="Payee" />,
    cell: ({ row }) => {
      const payee = row.getValue("payee") as string;

      return (
        <div className="flex min-w-0 items-center gap-x-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              monogramStyle(payee)
            )}
          >
            {monogramInitials(payee)}
          </span>
          <span className="truncate text-sm font-medium text-slate-900">
            {payee}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "category",
    header: ({ column }) => <SortableHeader column={column} label="Category" />,
    cell: ({ row }) => (
      <CategoryColumn
        id={row.original.id}
        category={row.original.category}
        categoryId={row.original.categoryId}
      />
    ),
    meta: {
      headerClassName: "hidden md:table-cell",
      cellClassName: "hidden md:table-cell",
    },
  },
  {
    accessorKey: "date",
    header: ({ column }) => <SortableHeader column={column} label="Date" />,
    cell: ({ row }) => {
      const date = row.getValue("date") as string | Date;

      return (
        <span className="whitespace-nowrap text-sm tabular-nums text-slate-500">
          {format(new Date(date), "dd MMM yyyy")}
        </span>
      );
    },
  },
  {
    accessorKey: "account",
    header: ({ column }) => <SortableHeader column={column} label="Account" />,
    cell: ({ row }) => (
      <AccountColumn
        account={row.original.account}
        accountId={row.original.accountId}
      />
    ),
    meta: {
      headerClassName: "hidden lg:table-cell",
      cellClassName: "hidden lg:table-cell",
    },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <SortableHeader column={column} label="Amount" align="right" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const isIncome = amount > 0;

      return (
        <span
          className={cn(
            "whitespace-nowrap text-sm font-semibold tabular-nums",
            isIncome ? "text-emerald-600" : "text-slate-900"
          )}
        >
          {isIncome ? "+" : ""}
          {formatCurrency(amount)}
        </span>
      );
    },
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
  },
  {
    id: "actions",
    cell: ({ row }) => <Actions id={row.original.id} />,
    meta: { headerClassName: "w-12", cellClassName: "w-12 text-right" },
  },
];
```

- [ ] **Step 2: Restyle `category-column.tsx`** — same props/click behavior (`useOpenCategory` when `categoryId`, else `useOpenTransaction`), new markup: render a `<button type="button">` chip:
  - Base chip: `inline-flex items-center gap-x-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200`
  - Uncategorized variant (when `!category`): `border border-dashed border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100` with `<TriangleAlert className="size-3 shrink-0" />` before the text `Uncategorized`
  - Text content: `category ?? "Uncategorized"`, wrapped in `max-w-32 truncate` span.

- [ ] **Step 3: Restyle `account-column.tsx`** — same props/click (`useOpenAccount`), markup: `<button type="button" className="inline-flex items-center gap-x-1.5 text-sm text-slate-500 transition-colors hover:text-blue-600">` with `<Landmark className="size-3.5 shrink-0" />` (lucide) + `<span className="truncate">{account}</span>`.

- [ ] **Step 4: Restyle `actions.tsx`** — keep `useConfirm`, `useDeleteTransaction`, `useOpenTransaction` wiring exactly; restyle only:
  - Trigger: `<Button variant="ghost" className="size-8 rounded-lg p-0 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 max-lg:opacity-100" aria-label="Open transaction menu">` with `<MoreHorizontal className="size-4" />` (row `group` class comes from Task 3's table row).
  - Content: `<DropdownMenuContent align="end" className="w-40 rounded-xl">` — Edit item with `Pencil` icon `size-4 mr-2`; Delete item with `Trash2` icon, item class `text-rose-600 focus:bg-rose-50 focus:text-rose-600`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` and `npm run lint` → clean. (`page.tsx` still imports `columns` the same way, so the app keeps compiling mid-plan.)

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/transactions/columns.tsx" "app/(dashboard)/transactions/category-column.tsx" "app/(dashboard)/transactions/account-column.tsx" "app/(dashboard)/transactions/actions.tsx"
git commit -m "feat(transactions): statement-style columns and cells"
```

---

### Task 3: Purpose-built table, summary tiles, page orchestration

**Files:**
- Create: `app/(dashboard)/transactions/transactions-table.tsx`
- Create: `app/(dashboard)/transactions/summary-tiles.tsx`
- Modify (full rewrite): `app/(dashboard)/transactions/page.tsx`

**Interfaces:**
- Consumes: `columns` from `"./columns"` (unchanged export, Task 2); `summarizeTransactions` from `"./lib"` (Task 1); `meta.headerClassName`/`meta.cellClassName` off column defs (augmentation declared in Task 2 — do NOT redeclare it); existing hooks/imports currently used by `page.tsx` (keep: `useSelectAccount`, `useNewTransaction`, `useBulkCreateTransactions`, `useBulkDeleteTransactions`, `getUserTransactions`, `UploadButton`, `ImportCard`, toast, `VARIANTS` enum, `INITIAL_IMPORT_RESULTS`, `onSubmitImport` logic — all byte-identical behavior).
- Produces: `TransactionsTable` + `TransactionsTableSkeleton` from `"./transactions-table"`; `TransactionsSummary` + `SummaryTilesLoading` from `"./summary-tiles"`.

- [ ] **Step 1: Create `transactions-table.tsx`** (reference implementation — use verbatim):

```tsx
"use client";

import * as React from "react";

import {
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ReceiptText,
  Search,
  SearchX,
  Trash2,
  X,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50];

interface TransactionsTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterKey: string;
  onDelete: (rows: Row<TData>[]) => void;
  disabled?: boolean;
  onAddNew?: () => void;
}

export function TransactionsTable<TData, TValue>({
  columns,
  data,
  filterKey,
  onDelete,
  disabled,
  onAddNew,
}: TransactionsTableProps<TData, TValue>) {
  const [ConfirmDialog, confirm] = useConfirm(
    "Are you sure?",
    "You are about to perform a bulk delete."
  );

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, rowSelection },
  });

  const searchQuery =
    (table.getColumn(filterKey)?.getFilterValue() as string) ?? "";
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const rangeStart = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, filteredCount);

  const isEmpty = data.length === 0;
  const isSearchMiss = !isEmpty && filteredCount === 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <ConfirmDialog />

      <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search payee…"
            value={searchQuery}
            onChange={(event) =>
              table.getColumn(filterKey)?.setFilterValue(event.target.value)
            }
            className="h-9 rounded-lg border-slate-200 bg-slate-50 pl-9 text-sm placeholder:text-slate-400 focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0"
          />
        </div>
        <p className="ml-auto hidden whitespace-nowrap text-xs tabular-nums text-slate-400 md:block">
          {filteredCount} {filteredCount === 1 ? "transaction" : "transactions"}
        </p>
      </div>

      {isEmpty || isSearchMiss ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div
            className={cn(
              "mb-4 flex size-14 items-center justify-center rounded-2xl",
              isSearchMiss ? "bg-slate-100" : "bg-blue-50"
            )}
          >
            {isSearchMiss ? (
              <SearchX className="size-7 text-slate-500" />
            ) : (
              <ReceiptText className="size-7 text-blue-600" />
            )}
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {isSearchMiss ? `No matches for “${searchQuery}”` : "No transactions yet"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {isSearchMiss
              ? "Try a different payee or clear the search."
              : "Add your first transaction or import a CSV to get started."}
          </p>
          {isSearchMiss ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.getColumn(filterKey)?.setFilterValue("")}
              className="mt-5 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            >
              Clear search
            </Button>
          ) : (
            onAddNew && (
              <Button
                size="sm"
                onClick={onAddNew}
                className="mt-5 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700"
              >
                <Plus className="mr-2 size-4" />
                Add transaction
              </Button>
            )
          )}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-11 px-4 first:pl-5 last:pr-5",
                        header.column.columnDef.meta?.headerClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="group border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80 data-[state=selected]:bg-blue-50/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-4 py-3 first:pl-5 last:pr-5",
                        cell.column.columnDef.meta?.cellClassName
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-3.5">
            <p className="whitespace-nowrap text-xs tabular-nums text-slate-500">
              Showing {rangeStart}–{rangeEnd} of {filteredCount}
            </p>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Rows
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => table.setPageSize(Number(value))}
                >
                  <SelectTrigger className="h-8 w-[68px] rounded-lg border-slate-200 text-xs focus:ring-blue-500/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)} className="text-xs">
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="hidden whitespace-nowrap text-xs tabular-nums text-slate-500 sm:block">
                Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedRows.length > 0 && (
        <div className="absolute inset-x-0 bottom-16 z-10 mx-auto flex w-fit items-center rounded-full bg-slate-900 py-1.5 pl-4 pr-1.5 text-white shadow-xl shadow-slate-900/20 duration-200 animate-in fade-in slide-in-from-bottom-2">
          <span className="whitespace-nowrap text-sm font-medium tabular-nums">
            {selectedRows.length} selected
          </span>
          <span className="mx-3 h-4 w-px bg-white/20" />
          <button
            type="button"
            disabled={disabled}
            onClick={async () => {
              const ok = await confirm();

              if (ok) {
                onDelete(selectedRows);
                table.resetRowSelection();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-rose-300 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => table.resetRowSelection()}
            className="rounded-full p-1.5 transition-colors hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export const TransactionsTableSkeleton = () => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <Skeleton className="h-9 w-full rounded-lg sm:w-72" />
      </div>
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-slate-100 px-5 py-[15px] last:border-0"
        >
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="hidden h-4 w-20 lg:block" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
    </div>
  );
};
```

Note: `bottom-16` keeps the floating bar clear of the footer. `meta` typing comes from Task 2's `ColumnMeta` module augmentation — do NOT add your own `declare module` here. This file only typechecks once Task 2 has landed; that's expected (verification happens at wave end, per Global Constraints).

- [ ] **Step 2: Create `summary-tiles.tsx`**:

```tsx
"use client";

import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";

import { summarizeTransactions } from "./lib";

type Props = {
  transactions: { amount: number }[];
};

export const TransactionsSummary = ({ transactions }: Props) => {
  const { inflow, outflow, net } = summarizeTransactions(transactions);

  const tiles = [
    {
      label: "Money in",
      value: formatCurrency(inflow),
      icon: ArrowDownLeft,
      disc: "bg-emerald-500/10 text-emerald-600",
      valueClassName: "text-slate-900",
    },
    {
      label: "Money out",
      value: formatCurrency(outflow),
      icon: ArrowUpRight,
      disc: "bg-rose-500/10 text-rose-600",
      valueClassName: "text-slate-900",
    },
    {
      label: "Net",
      value: `${net > 0 ? "+" : ""}${formatCurrency(net)}`,
      icon: Wallet,
      disc: "bg-blue-500/10 text-blue-600",
      valueClassName: net < 0 ? "text-rose-600" : "text-slate-900",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
      {tiles.map(({ label, value, icon: Icon, disc, valueClassName }) => (
        <div
          key={label}
          className="flex items-center gap-4 rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm"
        >
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              disc
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {label}
            </p>
            <p className={cn("truncate text-xl font-semibold", valueClassName)}>
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export const SummaryTilesLoading = () => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm"
        >
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="w-full space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: Rewrite `page.tsx`** — keep ALL existing logic (enum `VARIANTS`, `INITIAL_IMPORT_RESULTS`, `onUpload`, `onCancelImport`, `onSubmitImport` with `useSelectAccount` + toast + `useBulkCreateTransactions`, `useBulkDeleteTransactions`, `getUserTransactions`, `useNewTransaction`) byte-for-byte; replace only the rendered JSX:

```tsx
"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

import { transactions as transactionSchema } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { formatDateRange } from "@/lib/utils";
import { useBulkCreateTransactions } from "@/features/transactions/api/use-bulk-create-transactions";
import { useBulkDeleteTransactions } from "@/features/transactions/api/use-bulk-delete-transactions";
import { getUserTransactions } from "@/features/transactions/api/use-get-transactions";
import { useNewTransaction } from "@/features/transactions/hooks/use-new-transaction";
import { useSelectAccount } from "@/features/accounts/hooks/use-select-account";

import { columns } from "./columns";
import ImportCard from "./import-card";
import { SummaryTilesLoading, TransactionsSummary } from "./summary-tiles";
import {
  TransactionsTable,
  TransactionsTableSkeleton,
} from "./transactions-table";
import { UploadButton } from "./upload-button";

enum VARIANTS {
  LIST = "LIST",
  IMPORT = "IMPORT",
}

const INITIAL_IMPORT_RESULTS = {
  data: [],
  errors: [],
  meta: {},
};

const PageHeader = ({ subtitle }: { subtitle: string }) => (
  <div className="flex flex-col gap-y-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Transactions
      </h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
    <HeaderActions />
  </div>
);

const TransactionsPage = () => {
  // …existing state/hooks unchanged (AccountDialog, variant, importResults,
  // onUpload, onCancelImport, newTransaction, createTransactions,
  // deleteTransactions, transactionsQuery, onSubmitImport)…
};
```

  The reference JSX for the three render branches (`HeaderActions` shown inline where it is used — a small local component is fine, or inline the JSX):

  **Header actions** (used in header band, list variant): `UploadButton` (restyled in Task 4 — just render it) then Add button:
  ```tsx
  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
    <UploadButton onUpload={onUpload} />
    <Button
      size="sm"
      onClick={newTransaction.onOpen}
      className="h-9 w-full rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 sm:w-auto"
    >
      <Plus className="mr-2 size-4" />
      Add transaction
    </Button>
  </div>
  ```

  **Subtitle:** with `const params = useSearchParams()`:
  ```tsx
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;
  const dateRange = formatDateRange({ from, to });
  const subtitle = transactionsQuery.isLoading
    ? dateRange
    : `${transactions.length} ${transactions.length === 1 ? "transaction" : "transactions"} · ${dateRange}`;
  ```

  **Loading branch:**
  ```tsx
  <div className="mx-auto w-full max-w-screen-2xl py-8 pb-10">
    <div className="flex flex-col gap-6">
      <PageHeader subtitle={dateRange} />
      <SummaryTilesLoading />
      <TransactionsTableSkeleton />
    </div>
  </div>
  ```
  (Header actions in the loading branch: render them — they don't depend on the query.)

  **Import branch:** unchanged semantics — `<AccountDialog />` + `<ImportCard data… onCancel… onSubmit… />` (ImportCard owns its own container, as today).

  **List branch:**
  ```tsx
  <div className="mx-auto w-full max-w-screen-2xl py-8 pb-10">
    <div className="flex flex-col gap-6">
      <PageHeader subtitle={subtitle} />
      <TransactionsSummary transactions={transactions} />
      <TransactionsTable
        columns={columns}
        data={transactions}
        filterKey="payee"
        onDelete={(row) => {
          const ids = row.map((r) => r.original.id);
          deleteTransactions.mutate({ ids });
        }}
        disabled={isDisabled}
        onAddNew={newTransaction.onOpen}
      />
    </div>
  </div>
  ```
  Keep `const isDisabled = false;` as today (or inline `false`); keep `filterKey="payee"`.
  Structure `PageHeader`/`HeaderActions` however reads cleanest as long as the rendered
  markup matches these recipes (note `PageHeader` needs access to `onUpload`/`newTransaction` —
  passing an `actions` ReactNode prop is the clean shape).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` and `npm run lint` → clean. `npm test` → still green.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/transactions/transactions-table.tsx" "app/(dashboard)/transactions/summary-tiles.tsx" "app/(dashboard)/transactions/page.tsx"
git commit -m "feat(transactions): statement-style table, summary tiles, page header band"
```

---

### Task 4: Import flow restyle

**Files:**
- Modify: `app/(dashboard)/transactions/import-card.tsx`
- Modify: `app/(dashboard)/transactions/import-table.tsx`
- Modify: `app/(dashboard)/transactions/table-head-select.tsx`
- Modify: `app/(dashboard)/transactions/upload-button.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: same component names/props as today — `ImportCard({ data, onCancel, onSubmit })` (default export), `ImportTable({ headers, body, selectedColumns, onTableHeadSelectChange })` (default export), `TableHeadSelect({ columnIndex, selectedColumns, onChange })`, `UploadButton({ onUpload })`.

- [ ] **Step 1: Restyle `upload-button.tsx`** — keep `useCSVReader`/`getRootProps` wiring and the `// TODO: Add a paywall` comment; button becomes the outline recipe:

```tsx
<Button
  size="sm"
  variant="outline"
  className="h-9 w-full rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto"
  {...getRootProps()}
>
  <Upload className="mr-2 size-4" />
  Import CSV
</Button>
```

- [ ] **Step 2: Restyle `import-card.tsx`** — keep ALL mapping/submit logic (`dateFormat`, `outputFormat`, `requiredOptions`, `selectedColumns` state, `onTableHeadSelectChange`, `progress`, `handleContinue`) byte-for-byte. Delete the unused imports (`Card…` from ui/card, `SelectContent` from radix, `boolean` from drizzle-orm — dead code today). New JSX:

```tsx
<div className="mx-auto w-full max-w-screen-2xl py-8 pb-10">
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-y-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Import transactions
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Map your CSV columns — date, payee and amount are required.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="h-9 w-full rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleContinue}
          disabled={progress < requiredOptions.length}
          className="h-9 w-full rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 sm:w-auto"
        >
          Continue
        </Button>
      </div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Match columns
        </span>
        {requiredOptions.map((option) => {
          const isMapped = Object.values(selectedColumns).includes(option);

          return (
            <span
              key={option}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                isMapped
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {isMapped ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <Circle className="size-3.5" />
              )}
              {option}
            </span>
          );
        })}
      </div>
      <div className="p-5">
        <ImportTable
          headers={headers}
          body={body}
          selectedColumns={selectedColumns}
          onTableHeadSelectChange={onTableHeadSelectChange}
        />
      </div>
    </div>
  </div>
</div>
```

(Imports needed: `CheckCircle2`, `Circle` from lucide-react; `cn` from `@/lib/utils`; `Button` from ui.)

- [ ] **Step 3: Restyle `import-table.tsx`** — same props/structure; wrapper becomes `rounded-xl border border-slate-200 overflow-hidden` (it now sits inside the card), `TableHeader` row `bg-slate-50/50` (replace `bg-muted`), header cells `className="h-12 px-2"`, body rows `className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"`, body cells `className="px-4 py-2.5 text-sm text-slate-600 whitespace-nowrap"`. Also fix the stray trailing space in `{cell} ` → `{cell}`.

- [ ] **Step 4: Restyle `table-head-select.tsx`** — same props/logic (skip handling, disabled options); trigger classes become:

```tsx
<SelectTrigger
  className={cn(
    "h-8 w-full min-w-32 rounded-lg border px-2.5 text-xs font-medium capitalize outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-0",
    currentSelection
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-slate-200 bg-white text-slate-500"
  )}
>
```

Keep `<SelectValue placeholder="skip" />` and the item list exactly as-is (capitalize class on items).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` and `npm run lint` → clean.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/transactions/import-card.tsx" "app/(dashboard)/transactions/import-table.tsx" "app/(dashboard)/transactions/table-head-select.tsx" "app/(dashboard)/transactions/upload-button.tsx"
git commit -m "feat(transactions): restyle CSV import flow"
```

---

### Task 5: Integration verification + pixel pass (main session, not a subagent)

**Files:** none new — fix-ups only, staged individually.

- [ ] Run `npx tsc --noEmit`, `npm run lint`, `npm test` on the assembled branch.
- [ ] Start the dev server (`fintrak-dev` launch config), open `/transactions`.
- [ ] Verify + screenshot every state: list (hover, sort chevrons, monograms, amount alignment), selection floating bar, search + search-miss, pagination + page-size, loading skeleton (throttle or reload), empty state, import flow (chips tick, mapped select tint), 375px mobile + desktop, no console errors.
- [ ] Fix visual nits inline (commit as `polish(transactions): …`), re-screenshot.
- [ ] Merge `redesign/transactions-page` back to `main` (ff if possible), leaving unrelated dirty files untouched.

## Execution order

Wave 1: Task 1 (alone — Tasks 2 & 3 import `./lib`).
Wave 2: Tasks 2, 3, 4 in parallel (disjoint files; contracts pinned above).
Wave 3: Task 5 (main session).
