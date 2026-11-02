import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { components } from "../../api/generated/schema";
import { publicUserKey } from "../users/queries";
import { searchKey } from "../search/queries";
import { captureSession } from "../auth/sessionCache";
import { currentUserKey } from "../auth/queries";
import { ProfileError, updateProfile, uploadAvatar, removeAvatar } from "./api";

export const profileMutationKey = ["users", "profile", "mutation"] as const;
type User = components["schemas"]["User"];
export function useUpdateProfile() {
  return useProfileMutation(updateProfile);
}
export function useUploadAvatar() {
  return useProfileMutation(uploadAvatar);
}
export function useRemoveAvatar() {
  return useProfileMutation(removeAvatar);
}
function useProfileMutation<T>(mutationFn: (body: T) => Promise<User>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    mutationKey: profileMutationKey,
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
      client.setQueryData<components["schemas"]["DriverProfile"]>(
        publicUserKey(user.id),
        (old) =>
          old
            ? {
                ...old,
                nickname: user.nickname,
                avatar_url: user.avatar_url,
                instagram_url: user.instagram_url,
                tiktok_url: user.tiktok_url,
                youtube_url: user.youtube_url,
              }
            : old,
      );
      await Promise.all([
        client.invalidateQueries({ queryKey: searchKey }),
        client.invalidateQueries({ queryKey: ["setups", "compare"] }),
        client.invalidateQueries({ queryKey: ["users", "avatar"] }),
      ]);
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
