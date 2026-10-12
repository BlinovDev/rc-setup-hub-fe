import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "../../../api/generated/schema";
import { currentUserOptions } from "../../auth/queries";
import { detailKey, withSession } from "../queries";
import { getPhotoImage } from "./api";
export function usePhotoMedia(
  photo: components["schemas"]["SetupPhoto"] | null | undefined,
  thumbnail: boolean,
  enabled = true,
) {
  const client = useQueryClient();
  const session = useQuery(currentUserOptions);
  return useQuery({
    queryKey: [
      ...detailKey(photo?.setup_id ?? "none"),
      "media",
      session.data?.id,
      photo?.id,
      thumbnail,
      thumbnail ? photo?.thumbnail_revision : "full",
    ],
    queryFn: ({ signal }) =>
      withSession(client, () =>
        getPhotoImage(photo!.setup_id, photo!.id, thumbnail, signal),
      ),
    enabled: !!photo && !!session.data && enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}
