import { useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getUserCategories } from "@/features/categories/api/use-get-categories";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/hono", () => ({
  client: {},
}));

const useQueryMock = vi.mocked(useQuery);

describe("getUserCategories", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("passes an explicitly disabled option to useQuery", () => {
    getUserCategories({ enabled: false });

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });
});
