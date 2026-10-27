import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { publicUserSetupsKey, withSession } from "../setups/queries";
import { getPublicUserSetups, getPublicUser } from "./api";
export const publicUserKey = (userId: string) =>
  ["users", "public", userId] as const;
export function usePublicUser(userId: string, enabled = true) {
  const client = useQueryClient();
  return useQuery({
    queryKey: publicUserKey(userId),
    queryFn: ({ signal }) =>
      withSession(client, () => getPublicUser(userId, signal)),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function usePublicUserSetups(userId: string, enabled: boolean) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: publicUserSetupsKey(userId),
    queryFn: ({ pageParam, signal }) =>
      withSession(client, () => getPublicUserSetups(userId, pageParam, signal)),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
    retry: false,
    gcTime: 0,
  });
}
