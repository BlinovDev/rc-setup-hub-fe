import { useMutation, useQueryClient } from "@tanstack/react-query";
import { captureSession } from "../auth/sessionCache";
import { currentUserKey } from "../auth/queries";
import { ProfileError, updateNickname } from "./api";

export function useUpdateNickname() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateNickname,
    retry: false,
    onMutate: () => captureSession(client),
    onSuccess: async (user, _body, isCurrent) => {
      await client.cancelQueries({ queryKey: currentUserKey, exact: true });
      // Do not restore a session cleared by logout or a concurrent /me 401.
      if (isCurrent?.()) client.setQueryData(currentUserKey, user);
    },
    onError: async (error, _body, isCurrent) => {
      if (
        isCurrent?.() &&
        error instanceof ProfileError &&
        error.status === 401
      ) {
        await client.cancelQueries({ queryKey: currentUserKey, exact: true });
        if (isCurrent()) client.setQueryData(currentUserKey, null);
      }
    },
  });
}
