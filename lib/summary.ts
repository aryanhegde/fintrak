export type SummaryReads<
  CurrentTotals,
  PreviousTotals,
  CurrentCategories,
  PreviousCategories,
  ActiveDays,
> = {
  currentTotals: () => Promise<CurrentTotals>;
  previousTotals: () => Promise<PreviousTotals>;
  currentCategories: () => Promise<CurrentCategories>;
  previousCategories: () => Promise<PreviousCategories>;
  activeDays: () => Promise<ActiveDays>;
};

export async function runSummaryReads<
  CurrentTotals,
  PreviousTotals,
  CurrentCategories,
  PreviousCategories,
  ActiveDays,
>(
  reads: SummaryReads<
    CurrentTotals,
    PreviousTotals,
    CurrentCategories,
    PreviousCategories,
    ActiveDays
  >
) {
  const [
    currentTotals,
    previousTotals,
    currentCategories,
    previousCategories,
    activeDays,
  ] = await Promise.all([
    reads.currentTotals(),
    reads.previousTotals(),
    reads.currentCategories(),
    reads.previousCategories(),
    reads.activeDays(),
  ]);

  return {
    currentTotals,
    previousTotals,
    currentCategories,
    previousCategories,
    activeDays,
  };
}

export type CategoryBucket = {
  name: string;
  value: number;
};

export function topCategoryBuckets(
  categories: readonly CategoryBucket[],
  limit = 3
): CategoryBucket[] {
  const topCategories = categories.slice(0, limit);
  const remainder = categories.slice(limit);

  if (remainder.length === 0) {
    return topCategories;
  }

  return [
    ...topCategories,
    {
      name: "Everything else",
      value: remainder.reduce((total, category) => total + category.value, 0),
    },
  ];
}
