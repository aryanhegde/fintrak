"use client";

import { getUserSummary } from "@/features/summary/api/use-get-summary";
import { Chart } from "./chart";
import { DataChartsLoading } from "./data-charts-loading";
import { SpendingPie } from "./spending-pie";

export { DataChartsLoading } from "./data-charts-loading";

export const DataCharts = () => {
  const { data, isLoading } = getUserSummary();

  if (isLoading) {
    return <DataChartsLoading />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
      <div className="col-span-1 lg:col-span-3 xl:col-span-4">
        <Chart data={data?.days} />
      </div>
      <div className="col-span-1 lg:col-span-3 xl:col-span-2">
        <SpendingPie data={data?.categories} />
      </div>
    </div>
  );
};
