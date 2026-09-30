import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { withSession } from "../setups/queries";
import { searchSetups } from "./api";
import type { DiscoveryFilters } from "./filters";
export const searchKey = ["setups", "search"] as const;
export function useSetupSearch(filters: DiscoveryFilters, enabled: boolean) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: [...searchKey, filters],
    queryFn: ({ pageParam, signal }) =>
      withSession(client, () => searchSetups(filters, pageParam, signal)),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
    retry: false,
    staleTime: 30_000,
    gcTime: 0,
  });
}
