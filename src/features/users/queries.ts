import { useQuery, useQueryClient } from "@tanstack/react-query";
import { withSession } from "../setups/queries";
import { getPublicUser } from "./api";
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
