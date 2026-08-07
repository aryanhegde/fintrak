import { DataCharts } from "@/components/data-charts";
import { DataGrid } from "@/components/data-grid";
import { DataInsights } from "@/components/data-insights";

export default function DashboardPage() {
  return (
    <div className="max-w-screen-2xl mx-auto w-full py-8 pb-10">
      <DataGrid />
      <DataCharts />
      <DataInsights />
    </div>
  );
}
