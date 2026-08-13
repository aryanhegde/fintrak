/* eslint-disable react-hooks/rules-of-hooks */
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { client } from "@/lib/hono";
import { effectiveRollingRange } from "@/lib/query-range";
import { convertAmountFromMiliunits } from "@/lib/utils";

export const getUserTransactions = () => {
  const params = useSearchParams();
  const now = new Date();
  const { from, to } = effectiveRollingRange(
    { from: params.get("from"), to: params.get("to") },
    now
  );
  const accountId = params.get("accountId") || "";

  const query = useQuery({
    queryKey: ["transactions", { from, to, accountId }],
    queryFn: async () => {
      const response = await client.api.transactions.$get({
        query: {
          from,
          to,
          accountId,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const { data } = await response.json();
      return data.map((transaction) => ({
        ...transaction,
        amount: convertAmountFromMiliunits(transaction.amount),
      }));
    },
  });

  return query;
};
