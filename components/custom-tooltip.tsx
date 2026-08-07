import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;

  const date = payload[0].payload.date;
  const income = payload[0].value;
  const expenses = payload[1]?.value ?? 0;

  return (
    <div className="rounded-xl bg-white shadow-lg border border-slate-100 overflow-hidden min-w-[180px]">
      <div className="text-xs font-medium p-2 px-3 text-muted-foreground">
        {format(date, "dd MMM, yyyy")}
      </div>
      <div className="p-2 px-3 pt-0 space-y-1.5">
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex items-center gap-x-2">
            <div className="size-2 bg-blue-600 rounded-full" />
            <p className="text-sm text-muted-foreground">Income</p>
          </div>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(income)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex items-center gap-x-2">
            <div className="size-2 bg-rose-500 rounded-full" />
            <p className="text-sm text-muted-foreground">Expenses</p>
          </div>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(expenses * -1)}
          </p>
        </div>
      </div>
    </div>
  );
};
