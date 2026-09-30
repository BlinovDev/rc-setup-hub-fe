import { useMutation, useQueryClient } from "@tanstack/react-query";
import { currentUserKey } from "../auth/queries";
import { ProfileError, updateNickname } from "./api";

export function useUpdateNickname() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateNickname,
    retry: false,
    onSuccess: async (user) => {
      await client.cancelQueries({ queryKey: currentUserKey, exact: true });
      // Do not restore a session cleared by logout or a concurrent /me 401.
      if (client.getQueryData(currentUserKey) !== null)
        client.setQueryData(currentUserKey, user);
    },
    onError: async (error) => {
      if (error instanceof ProfileError && error.status === 401) {
        await client.cancelQueries({ queryKey: currentUserKey, exact: true });
        client.setQueryData(currentUserKey, null);
      }
    },
  });
}
