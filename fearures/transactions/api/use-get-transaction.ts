import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/hono";

export const getUserTransaction = (id?: string) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const query = useQuery({
    enabled: !!id,
    queryKey: ["transaction", { id }],
    queryFn: async () => {
      const response = await client.api.transactions[":id"].$get({
        param: { id },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const { data } = await response.json();

      return data;
    },
  });
  return query;
};
