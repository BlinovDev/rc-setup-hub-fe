import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { components } from "../../api/generated/schema";
import { currentUserKey } from "../auth/queries";
import {
  SetupError,
  createSetup,
  deleteSetup,
  getMySetups,
  getSetup,
  patchSetup,
} from "./api";

export const mineKey = ["setups", "mine"] as const;
export const detailKey = (id: string) => ["setups", "detail", id] as const;
async function withSession<T>(
  client: QueryClient,
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof SetupError && error.status === 401) {
      await client.cancelQueries({ queryKey: currentUserKey, exact: true });
      client.setQueryData(currentUserKey, null);
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
export function useCreateSetup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["CreateSetup"]) =>
      withSession(client, () => createSetup(body)),
    retry: false,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: mineKey, exact: true });
    },
  });
}
export function usePatchSetup(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["PatchSetup"]) =>
      withSession(client, () => patchSetup(id, body)),
    retry: false,
    onSuccess: async (setup) => {
      await client.cancelQueries({ queryKey: detailKey(id), exact: true });
      client.setQueryData(detailKey(id), setup);
      await client.invalidateQueries({ queryKey: mineKey, exact: true });
    },
  });
}
export function useDeleteSetup(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => withSession(client, () => deleteSetup(id)),
    retry: false,
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: detailKey(id), exact: true });
      client.removeQueries({ queryKey: detailKey(id), exact: true });
      client.setQueryData<components["schemas"]["Setup"][]>(mineKey, (old) =>
        old?.filter((setup) => setup.id !== id),
      );
      await client.invalidateQueries({ queryKey: mineKey, exact: true });
    },
  });
}
