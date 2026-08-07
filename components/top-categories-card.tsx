import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { formatCurrency } from "@/lib/utils";

type Props = {
  categories: {
    name: string;
    value: number; // display units, positive
  }[];
};

export const TopCategoriesCard = ({ categories }: Props) => {
  const max = categories[0]?.value ?? 0;

  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold line-clamp-1">
          Top Spending
        </CardTitle>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No spending in this period.
          </p>
        ) : (
          <ul className="space-y-4">
            {categories.map((category) => (
              <li key={category.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="truncate text-sm font-medium">
                    {category.name}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(category.value)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{
                      width: `${max > 0 ? (category.value / max) * 100 : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export const TopCategoriesCardLoading = () => {
  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
