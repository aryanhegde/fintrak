import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

describe("lazy dashboard loading boundaries", () => {
  it("exports the chart loading view for the dynamic fallback", async () => {
    const dataCharts = await import("@/components/data-charts");

    expect(dataCharts).toHaveProperty("DataChartsLoading");

    const DataChartsLoading = (
      dataCharts as typeof dataCharts & {
        DataChartsLoading: () => React.ReactNode;
      }
    ).DataChartsLoading;
    const markup = renderToStaticMarkup(<DataChartsLoading />);

    expect(markup).toContain("lg:grid-cols-6");
  });

  it("exposes the dashboard chart through a lazy boundary", async () => {
    const modulePath = "../lazy-data-charts";

    await expect(import(/* @vite-ignore */ modulePath)).resolves.toHaveProperty(
      "LazyDataCharts"
    );
  });

  it("loads the chart fallback without loading the chart renderer", async () => {
    vi.resetModules();
    vi.doMock("recharts", () => {
      throw new Error("The loading fallback imported the chart renderer");
    });
    const modulePath = "../data-charts-loading";

    try {
      await expect(import(/* @vite-ignore */ modulePath)).resolves.toHaveProperty(
        "DataChartsLoading"
      );
    } finally {
      vi.doUnmock("recharts");
    }
  });
});
