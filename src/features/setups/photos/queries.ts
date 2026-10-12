import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { currentUserOptions } from "../../auth/queries";
import { detailKey, mineKey, userSetupsKey, withSession } from "../queries";
import {
  chooseCover,
  cropPhoto,
  deletePhoto,
  getPhotos,
  uploadPhoto,
} from "./api";
import type { components } from "../../../api/generated/schema";
import { SetupError } from "../api";
export const photosKey = (id: string) => [...detailKey(id), "photos"] as const;
export async function refreshPhotos(
  client: QueryClient,
  id: string,
  ownerId: string,
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: photosKey(id) }),
    client.invalidateQueries({ queryKey: detailKey(id), exact: true }),
    client.invalidateQueries({ queryKey: mineKey, exact: true }),
    client.invalidateQueries({ queryKey: userSetupsKey(ownerId), exact: true }),
    client.invalidateQueries({ queryKey: ["setups", "search"] }),
  ]);
}
export function usePhotos(id: string, enabled = true) {
  const client = useQueryClient();
  const session = useQuery(currentUserOptions);
  return useQuery({
    queryKey: [...photosKey(id), session.data?.id],
    enabled: enabled && !!session.data,
    queryFn: ({ signal }) => withSession(client, () => getPhotos(id, signal)),
    retry: false,
    gcTime: 0,
  });
}
export function usePhotoActions(id: string, ownerId: string) {
  const client = useQueryClient();
  const upload = useMutation({
    mutationFn: ({ file, requestId }: { file: File; requestId: string }) =>
      withSession(client, () => uploadPhoto(id, file, requestId)),
    retry: false,
    onSuccess: () => refreshPhotos(client, id, ownerId),
    onError: async (error) => {
      if (error instanceof SetupError && [400, 404, 409].includes(error.status))
        await refreshPhotos(client, id, ownerId);
    },
  });
  const mutation = useMutation({
    mutationFn: ({ photoId, remove }: { photoId: string; remove: boolean }) =>
      withSession(client, async () => {
        if (remove) await deletePhoto(id, photoId);
        else await chooseCover(id, photoId);
      }),
    retry: false,
    onSuccess: () => refreshPhotos(client, id, ownerId),
    onError: async (error) => {
      if (error instanceof SetupError && [404, 409].includes(error.status))
        await refreshPhotos(client, id, ownerId);
    },
  });
  return { upload, mutation };
}
export function useCropPhoto(id: string, ownerId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      photoId,
      body,
    }: {
      photoId: string;
      body: components["schemas"]["PhotoCropUpdate"];
    }) => withSession(client, () => cropPhoto(id, photoId, body)),
    retry: false,
    onSuccess: () => refreshPhotos(client, id, ownerId),
    onError: async (error) => {
      if (error instanceof SetupError && [404, 409].includes(error.status))
        await refreshPhotos(client, id, ownerId);
    },
  });
}
