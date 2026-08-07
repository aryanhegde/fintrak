"use client";

import { useGetInsights } from "@/features/summary/api/use-get-insights";
import {
  HealthScoreCard,
  HealthScoreCardLoading,
} from "./health-score-card";
import { RecurringCard, RecurringCardLoading } from "./recurring-card";
import {
  TopCategoriesCard,
  TopCategoriesCardLoading,
} from "./top-categories-card";

export const DataInsights = () => {
  const { data, isLoading } = useGetInsights();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <HealthScoreCardLoading />
        <RecurringCardLoading />
        <TopCategoriesCardLoading />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
      <HealthScoreCard
        score={data?.healthScore ?? 0}
        insights={data?.insights ?? []}
      />
      <RecurringCard recurring={data?.recurring ?? []} />
      <TopCategoriesCard categories={data?.topCategories ?? []} />
    </div>
  );
};
