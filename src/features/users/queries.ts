import { useQuery, useQueryClient } from "@tanstack/react-query";
import { withSession } from "../setups/queries";
import { getPublicUser } from "./api";
export function usePublicUser(userId: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: ["users", "public", userId],
    queryFn: ({ signal }) =>
      withSession(client, () => getPublicUser(userId, signal)),
    retry: false,
    staleTime: 60_000,
  });
}
