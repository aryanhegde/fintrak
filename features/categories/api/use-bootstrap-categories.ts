import { InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/hono";
import { parseApiResponse } from "@/lib/api-response";

type ResponseType = InferResponseType<typeof client.api.categories.bootstrap.$post>;

export const useBootstrapCategories = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error>({
    mutationFn: async () => {
      const response = await client.api.categories.bootstrap.$post();

      return parseApiResponse<ResponseType>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};
