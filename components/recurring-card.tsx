import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { formatCurrency } from "@/lib/utils";

type Props = {
  recurring: {
    payee: string;
    amount: number; // display units, negative = expense
    cadence: "weekly" | "monthly";
    nextDate: string;
  }[];
};

export const RecurringCard = ({ recurring }: Props) => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold line-clamp-1">
          Recurring Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recurring.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No recurring payments detected yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {recurring.slice(0, 5).map((item) => (
              <li
                key={`${item.payee}-${item.amount}`}
                className="flex items-center gap-x-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-700 uppercase">
                  {item.payee.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize">
                    {item.payee}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Next: {format(new Date(item.nextDate), "MMM d")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(Math.abs(item.amount))}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {item.cadence}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export const RecurringCardLoading = () => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-x-3">
            <Skeleton className="size-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
