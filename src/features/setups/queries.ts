import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { components } from "../../api/generated/schema";
import { captureSession } from "../auth/sessionCache";
import { currentUserKey } from "../auth/queries";
import {
  SetupError,
  createSetup,
  deleteSetup,
  getMySetups,
  getSetup,
  getUserSetups,
  patchSetup,
} from "./api";

export const mineKey = ["setups", "mine"] as const;
export const userSetupsKey = (userId: string) =>
  ["setups", "user", userId] as const;
export const detailKey = (id: string) => ["setups", "detail", id] as const;
// All setup writes refresh the same list projections; detail/media lifetimes
// remain with the mutation that owns them.
export async function refreshSetupLists(client: QueryClient, ownerId?: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: mineKey, exact: true }),
    client.invalidateQueries({ queryKey: ["setups", "search"] }),
    ...(ownerId
      ? [
          client.invalidateQueries({
            queryKey: userSetupsKey(ownerId),
            exact: true,
          }),
        ]
      : []),
  ]);
}
export async function withSession<T>(
  client: QueryClient,
  request: () => Promise<T>,
): Promise<T> {
  const isCurrent = captureSession(client);
  try {
    const result = await request();
    if (!isCurrent()) throw new Error("Session changed during request.");
    return result;
  } catch (error) {
    if (!isCurrent())
      throw new Error("Session changed during request.", { cause: error });
    if (error instanceof SetupError && error.status === 401) {
      await client.cancelQueries({ queryKey: currentUserKey, exact: true });
      if (isCurrent()) client.setQueryData(currentUserKey, null);
    }
    throw error;
  }
}
export function useMySetups() {
  const client = useQueryClient();
  return useQuery({
    queryKey: mineKey,
    queryFn: ({ signal }) => withSession(client, () => getMySetups(signal)),
    retry: false,
  });
}
export function useSetup(id: string, enabled: boolean) {
  const client = useQueryClient();
  return useQuery({
    queryKey: detailKey(id),
    queryFn: ({ signal }) => withSession(client, () => getSetup(id, signal)),
    enabled,
    retry: false,
  });
}
export function useUserSetups(userId: string, enabled: boolean) {
  const client = useQueryClient();
  return useQuery({
    queryKey: userSetupsKey(userId),
    queryFn: ({ signal }) =>
      withSession(client, () => getUserSetups(userId, signal)),
    enabled,
    retry: false,
  });
}
export function useCreateSetup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["CreateSetup"]) =>
      withSession(client, () => createSetup(body)),
    retry: false,
    onSuccess: async (setup) => {
      await refreshSetupLists(client, setup.owner_id);
    },
  });
}
export function usePatchSetup(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["PatchSetup"]) =>
      withSession(client, () => patchSetup(id, body)),
    retry: false,
    onMutate: () => captureSession(client),
    onSuccess: async (setup, _body, isCurrent) => {
      await client.cancelQueries({ queryKey: detailKey(id), exact: true });
      if (!isCurrent?.()) return;
      client.setQueryData(detailKey(id), setup);
      await refreshSetupLists(client, setup.owner_id);
    },
  });
}
export function useDeleteSetup(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => withSession(client, () => deleteSetup(id)),
    retry: false,
    onMutate: () => captureSession(client),
    onSuccess: async (_data, _body, isCurrent) => {
      const ownerId =
        client.getQueryData<components["schemas"]["Setup"]>(detailKey(id))
          ?.owner_id ??
        client.getQueryData<components["schemas"]["User"] | null>(
          currentUserKey,
        )?.id;
      await client.cancelQueries({ queryKey: detailKey(id), exact: true });
      if (!isCurrent?.()) return;
      client.removeQueries({ queryKey: detailKey(id), exact: true });
      client.setQueryData<components["schemas"]["Setup"][]>(mineKey, (old) =>
        old?.filter((setup) => setup.id !== id),
      );
      await refreshSetupLists(client, ownerId);
    },
  });
}
