import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/hono";

export const getUserAccount = (id?: string) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const query = useQuery({
    enabled: !!id,
    queryKey: ["account", { id }],
    queryFn: async () => {
      const response = await client.api.accounts[":id"].$get({
        param: { id },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }

      const { data } = await response.json();

      return data;
    },
  });
  return query;
};
