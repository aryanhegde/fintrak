"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { client } from "@/lib/hono";
import { convertAmountFromMiliunits } from "@/lib/utils";

export const useGetInsights = () => {
  const params = useSearchParams();
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const accountId = params.get("accountId") || "";

  const query = useQuery({
    queryKey: ["insights", { from, to, accountId }],
    queryFn: async () => {
      const response = await client.api.insights.$get({
        query: { from, to, accountId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch insights");
      }

      const { data } = await response.json();
      return {
        ...data,
        recurring: data.recurring.map((r) => ({
          ...r,
          amount: convertAmountFromMiliunits(r.amount),
        })),
        topCategories: data.topCategories.map((cat) => ({
          ...cat,
          value: convertAmountFromMiliunits(cat.value),
        })),
      };
    },
  });

  return query;
};
