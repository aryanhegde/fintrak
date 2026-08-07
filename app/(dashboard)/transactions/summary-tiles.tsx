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
