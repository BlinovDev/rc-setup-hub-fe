import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { components } from "../../api/generated/schema";
import { publicUserKey } from "../users/queries";
import { searchKey } from "../search/queries";
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
      if (!isCurrent?.()) return;
      await Promise.all([
        client.cancelQueries({ queryKey: currentUserKey, exact: true }),
        client.cancelQueries({ queryKey: publicUserKey(user.id), exact: true }),
      ]);
      // Do not restore a session cleared by logout or a concurrent /me 401.
      if (!isCurrent?.()) return;
      client.setQueryData(currentUserKey, user);
      client.setQueryData<components["schemas"]["PublicProfile"]>(
        publicUserKey(user.id),
        (old) =>
          old
            ? { ...old, nickname: user.nickname, avatar_url: user.avatar_url }
            : old,
      );
      await client.invalidateQueries({ queryKey: searchKey });
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
