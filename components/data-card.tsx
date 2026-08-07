import { IconType } from "react-icons";
import { VariantProps, cva } from "class-variance-authority";

import { Skeleton } from "./ui/skeleton";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import { CountUp } from "@/components/count-up";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const boxVariant = cva("shrink-0 rounded-full p-2.5", {
  variants: {
    variant: {
      default: "bg-blue-500/15",
      success: "bg-emerald-500/15",
      danger: "bg-rose-500/15",
      warning: "bg-yellow-500/15",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const iconVariant = cva("size-5", {
  variants: {
    variant: {
      default: "fill-blue-500",
      success: "fill-emerald-500",
      danger: "fill-rose-500",
      warning: "fill-yellow-500",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type BoxVariants = VariantProps<typeof boxVariant>;
type IconVariants = VariantProps<typeof iconVariant>;

interface DataCardProps extends BoxVariants, IconVariants {
  icon: IconType;
  title: string;
  value?: number;
  dateRange: string;
  percentageChange?: number;
}

export const DataCard = ({
  icon: Icon,
  title,
  value = 0,
  variant,
  dateRange,
  percentageChange = 0,
}: DataCardProps) => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-x-4 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </CardTitle>
          <CardDescription className="text-xs line-clamp-1">
            {dateRange}
          </CardDescription>
        </div>
        <div className={cn(boxVariant({ variant }))}>
          <Icon className={cn(iconVariant({ variant }))} />
        </div>
      </CardHeader>
      <CardContent>
        <h1 className="font-bold text-3xl tabular-nums mb-3 line-clamp-1 break-all">
          <CountUp
            preserveValue
            start={0}
            end={value}
            decimals={2}
            decimalPlaces={2}
            formattingFn={formatCurrency}
          />
        </h1>
        <div className="flex items-center gap-x-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              percentageChange > 0 && "bg-emerald-100 text-emerald-700",
              percentageChange < 0 && "bg-rose-100 text-rose-700",
              percentageChange === 0 && "bg-slate-100 text-slate-600"
            )}
          >
            {formatPercentage(percentageChange, { addPrefix: true })}
          </span>
          <span className="text-xs text-muted-foreground">vs last period</span>
        </div>
      </CardContent>
    </Card>
  );
};

export const DataCardLoading = () => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm h-[178px]">
      <CardHeader className="flex flex-row items-center justify-between gap-x-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="size-10 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="shrink-0 h-10 w-24 mb-2" />
        <Skeleton className="shrink-0 h-4 w-40" />
      </CardContent>
    </Card>
  );
};
