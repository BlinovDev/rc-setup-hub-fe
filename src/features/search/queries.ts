import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { withSession } from "../setups/queries";
import { searchSetups } from "./api";
import type { DiscoveryFilters } from "./filters";
export const searchKey = ["setups", "search"] as const;
export function useSetupSearch(
  filters: DiscoveryFilters,
  enabled: boolean,
  viewer = "guest",
) {
  const client = useQueryClient();
  const personal = filters.scope && filters.scope !== "all";
  return useInfiniteQuery({
    queryKey: personal
      ? [...searchKey, "personal", viewer, filters]
      : [...searchKey, filters],
    queryFn: ({ pageParam, signal }) =>
      withSession(client, () => searchSetups(filters, pageParam, signal)),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
    retry: false,
    staleTime: personal ? 0 : 30_000,
    refetchOnWindowFocus: personal ? "always" : true,
    gcTime: 0,
  });
}
