import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

const TICKS = 40;

const TickDial = ({ score }: { score: number }) => {
  const filledCount = Math.round((score / 100) * TICKS);
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        {Array.from({ length: TICKS }).map((_, i) => {
          const angle = (i / TICKS) * 2 * Math.PI;
          const x1 = 60 + 44 * Math.cos(angle);
          const y1 = 60 + 44 * Math.sin(angle);
          const x2 = 60 + 56 * Math.cos(angle);
          const y2 = 60 + 56 * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={i < filledCount ? "#2563eb" : "#e2e8f0"}
              strokeWidth={3.5}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{score}%</span>
        <span className="text-xs text-muted-foreground">Saved</span>
      </div>
    </div>
  );
};

type Props = {
  score: number;
  insights: string[];
};

export const HealthScoreCard = ({ score, insights }: Props) => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold line-clamp-1">
          Financial Health
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-x-6">
        <TickDial score={score} />
        <ul className="space-y-2.5">
          {insights.map((insight) => (
            <li key={insight} className="flex items-start gap-x-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-600" />
              <span className="text-sm text-slate-600">{insight}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export const HealthScoreCardLoading = () => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="flex items-center gap-x-6">
        <Skeleton className="size-36 rounded-full shrink-0" />
        <div className="w-full space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </CardContent>
    </Card>
  );
};
