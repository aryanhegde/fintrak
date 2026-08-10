import { Suspense } from "react";

import { DataCharts } from "@/components/data-charts";
import { MonthPicker } from "@/components/month-picker";
import { MonthlyBreakdown } from "@/components/monthly-breakdown";

export default function DashboardPage() {
  return (
    <div className="max-w-screen-2xl mx-auto w-full py-8 pb-10 space-y-6">
      <Suspense>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
          <MonthPicker />
        </div>
        <MonthlyBreakdown />
        <DataCharts />
      </Suspense>
    </div>
  );
}
