"use client";

import dynamic from "next/dynamic";

import { DataChartsLoading } from "@/components/data-charts-loading";

export const LazyDataCharts = dynamic(
  () =>
    import("@/components/data-charts").then((module) => module.DataCharts),
  { ssr: false, loading: () => <DataChartsLoading /> }
);
