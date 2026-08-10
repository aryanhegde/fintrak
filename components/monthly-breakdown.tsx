"use client";

import { useSearchParams } from "next/navigation";

import { getUserSummary } from "@/features/summary/api/use-get-summary";
import { formatCurrency } from "@/lib/utils";
import { monthLabel } from "@/lib/month";
import { Skeleton } from "@/components/ui/skeleton";

type CategoryTotal = { name: string; value: number };

export function buildBreakdownRows(
  current: CategoryTotal[],
  previous: CategoryTotal[]
) {
  const total = current.reduce((sum, c) => sum + c.value, 0);
  if (total === 0) {
    return [];
  }
  const previousByName = new Map(previous.map((c) => [c.name, c.value]));

  return current.map((c) => {
    const prev = previousByName.get(c.name);
    return {
      name: c.name,
      value: c.value,
      share: c.value / total,
      delta: prev === undefined ? null : c.value - prev,
    };
  });
}

export const MonthlyBreakdown = () => {
  const { data, isLoading } = getUserSummary();
  const params = useSearchParams();
  const from = params.get("from");
  const heading = from ? `Spent in ${monthLabel(from.slice(0, 7))}` : "Spent this month";

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  const rows = buildBreakdownRows(
    data?.allCategories ?? [],
    data?.previousCategories ?? []
  );
  const totalSpent = Math.abs(data?.expensesAmount ?? 0);

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {heading}
        </p>
        <p className="pt-1 text-3xl font-semibold tabular-nums text-slate-900">
          {formatCurrency(totalSpent)}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-8 text-sm text-slate-400">
          No spending recorded this month yet.
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.name}
              className="border-b border-slate-100 px-6 py-4 last:border-b-0"
            >
              <div className="flex items-baseline justify-between gap-x-4">
                <span className="truncate text-sm font-medium text-slate-900">
                  {row.name}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {formatCurrency(row.value)}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${Math.round(row.share * 100)}%` }}
                />
              </div>
              <p className="pt-1 text-xs text-slate-400">
                {Math.round(row.share * 100)}% of spending
                {row.delta !== null && (
                  <>
                    {" · "}
                    {row.delta >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(row.delta))} vs last month
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
