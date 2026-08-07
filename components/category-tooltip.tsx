import { formatCurrency } from "@/lib/utils";

export const CategoryTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;

  const name = payload[0].payload.name;
  const value = payload[0].value;

  return (
    <div className="rounded-xl bg-white shadow-lg border border-slate-100 overflow-hidden min-w-[160px]">
      <div className="text-xs font-medium p-2 px-3 text-muted-foreground">
        {name}
      </div>
      <div className="p-2 px-3 pt-0 space-y-1.5">
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex items-center gap-x-2">
            <div className="size-2 bg-rose-500 rounded-full" />
            <p className="text-sm text-muted-foreground">Expenses</p>
          </div>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(value * -1)}
          </p>
        </div>
      </div>
    </div>
  );
};
