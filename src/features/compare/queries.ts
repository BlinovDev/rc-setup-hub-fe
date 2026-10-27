import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { withSession } from "../setups/queries";
import { visibleSetups, compareSetups } from "./api";
export const compareKey = ["setups", "compare"] as const;
export function useCandidates(q: string, viewer: string, enabled: boolean) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: [...compareKey, "visible", viewer, q],
    queryFn: ({ pageParam, signal }) =>
      withSession(client, () => visibleSetups(q, pageParam, signal)),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });
}
export function useComparison(
  left: string,
  right: string,
  viewer: string,
  enabled: boolean,
) {
  const client = useQueryClient();
  return useQuery({
    queryKey: [...compareKey, "pair", viewer, left, right],
    queryFn: ({ signal }) =>
      withSession(client, () =>
        compareSetups(left, right, viewer === "guest", signal),
      ),
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });
}
