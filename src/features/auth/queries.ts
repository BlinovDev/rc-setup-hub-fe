import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getCurrentUser, logout } from "./api";

export const currentUserKey = ["auth", "me"] as const;

export const currentUserOptions = queryOptions({
  queryKey: currentUserKey,
  queryFn: ({ signal }) => getCurrentUser(signal),
  staleTime: 60_000,
  retry: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
});

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    retry: false,
    onSuccess: async () => {
      // Prevent an older in-flight /me response from restoring logged-out UI.
      await queryClient.cancelQueries({
        queryKey: currentUserKey,
        exact: true,
      });
      queryClient.setQueryData(currentUserKey, null);
    },
  });
}
