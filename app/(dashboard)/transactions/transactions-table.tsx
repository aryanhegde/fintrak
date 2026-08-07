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
