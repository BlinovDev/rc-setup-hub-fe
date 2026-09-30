import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userSetupsKey, withSession } from "../setups/queries";
import {
  FriendshipError,
  friendshipErrorMessage,
  acceptRequest,
  deleteRelationship,
  getFriendships,
  searchUsers,
  sendRequest,
} from "./api";

export const friendshipsKey = ["friendships"] as const;
export const userSearchKey = (q: string) => ["users", "search", q] as const;
export function validUserSearch(q: string) {
  return Array.from(q).length <= 64 && !q.includes("\0");
}
export function useFriendships() {
  const client = useQueryClient();
  return useQuery({
    queryKey: friendshipsKey,
    queryFn: ({ signal }) => withSession(client, () => getFriendships(signal)),
    retry: false,
  });
}
export function useUserSearch(q: string, enabled: boolean) {
  const client = useQueryClient();
  return useQuery({
    queryKey: userSearchKey(q),
    queryFn: ({ signal }) => withSession(client, () => searchUsers(q, signal)),
    enabled: enabled && !!q && validUserSearch(q),
    retry: false,
  });
}
export function useSendRequest(
  userId: string,
  feedback: (message: string) => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["friendships", "send", userId],
    mutationFn: () =>
      withSession(client, () => sendRequest({ user_id: userId })),
    retry: false,
    onMutate: () => feedback(""),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: friendshipsKey, exact: true }),
    onError: (error) => {
      feedback(friendshipErrorMessage(error, "send"));
      if (error instanceof FriendshipError && error.status === 409)
        return client.invalidateQueries({
          queryKey: friendshipsKey,
          exact: true,
        });
    },
  });
}
export function useAcceptRequest(
  id: string,
  otherUserId: string,
  feedback: (message: string) => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["friendships", "item", id],
    mutationFn: () => withSession(client, () => acceptRequest(id)),
    retry: false,
    onMutate: () => feedback(""),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: friendshipsKey, exact: true }),
        client.invalidateQueries({ queryKey: ["setups", "detail"] }),
        client.invalidateQueries({
          queryKey: userSetupsKey(otherUserId),
          exact: true,
        }),
      ]),
    onError: async (error) => {
      feedback(friendshipErrorMessage(error, "accept"));
      if (
        error instanceof FriendshipError &&
        [404, 409].includes(error.status)
      ) {
        await client.cancelQueries({
          queryKey: userSetupsKey(otherUserId),
          exact: true,
        });
        client.removeQueries({
          queryKey: userSetupsKey(otherUserId),
          exact: true,
        });
        await client.invalidateQueries({
          queryKey: friendshipsKey,
          exact: true,
        });
      }
    },
  });
}
export function useDeleteRelationship(
  id: string,
  otherUserId: string,
  accepted: boolean,
  feedback: (message: string) => void,
) {
  const client = useQueryClient();
  async function refresh() {
    if (accepted) {
      // Cancel old requests before removal so a late response cannot restore access.
      await Promise.all([
        client.cancelQueries({ queryKey: ["setups", "detail"] }),
        client.cancelQueries({
          queryKey: userSetupsKey(otherUserId),
          exact: true,
        }),
      ]);
      client.removeQueries({
        queryKey: userSetupsKey(otherUserId),
        exact: true,
      });
      client.removeQueries({ queryKey: ["setups", "detail"] });
    }
    await client.invalidateQueries({ queryKey: friendshipsKey, exact: true });
  }
  return useMutation({
    mutationKey: ["friendships", "item", id],
    mutationFn: () => withSession(client, () => deleteRelationship(id)),
    retry: false,
    onMutate: () => feedback(""),
    onSuccess: refresh,
    onError: (error) => {
      feedback(friendshipErrorMessage(error, "delete"));
      if (error instanceof FriendshipError && error.status === 404)
        return refresh();
    },
  });
}
