import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/hono";

export const useBootstrapCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await client.api.categories.bootstrap.$post();

      if (!response.ok) {
        throw new Error("Failed to seed categories");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};
