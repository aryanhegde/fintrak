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
            aria-hidden="true"
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
    meta: {
      headerClassName: "hidden sm:table-cell",
      cellClassName: "hidden sm:table-cell",
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
