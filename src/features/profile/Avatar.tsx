import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { currentUserOptions } from "../auth/queries";
import { withSession } from "../setups/queries";
import { SetupError } from "../setups/api";

const managedAvatar =
  /^\/api\/v1\/users\/([0-9a-f-]{36})\/avatar\/([0-9a-f-]{36})$/i;
function AvatarImage({
  blob,
  size,
  onError,
}: {
  blob: Blob;
  size: number;
  onError: () => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = ref.current;
    if (!image) return;
    const source = URL.createObjectURL(blob);
    image.src = source;
    return () => {
      URL.revokeObjectURL(source);
      image.removeAttribute("src");
    };
  }, [blob]);
  return <img ref={ref} alt="" width={size} height={size} onError={onError} />;
}

// Managed avatars use the credentialed typed client and transient no-store blobs.
// Provider URLs are never fetched with application credentials.
export function Avatar({
  url,
  size = 32,
}: {
  url?: string | null;
  size?: number;
}) {
  return <AvatarContent key={url ?? "default"} url={url ?? null} size={size} />;
}
function AvatarContent({ url, size }: { url?: string | null; size: number }) {
  const [broken, setBroken] = useState(false);
  const client = useQueryClient();
  const session = useQuery(currentUserOptions);
  const match = url?.match(managedAvatar);
  const media = useQuery({
    queryKey: ["users", "avatar", session.data?.id ?? "guest", url],
    queryFn: ({ signal }) =>
      withSession(client, async () => {
        const { data, response } = await apiClient.GET(
          "/api/v1/users/{user_id}/avatar/{avatar_id}",
          {
            params: { path: { user_id: match![1]!, avatar_id: match![2]! } },
            parseAs: "blob",
            cache: "no-store",
            signal,
          },
        );
        if (response.status !== 200 || !data)
          throw new SetupError(response.status);
        return data;
      }),
    enabled: !!match && session.isSuccess,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
  });
  const ownerId = match?.[1];
  useEffect(() => {
    if (
      media.error instanceof SetupError &&
      media.error.status === 404 &&
      ownerId
    ) {
      void client.invalidateQueries({
        queryKey: ["users", "public", ownerId],
        exact: true,
      });
      if (session.data?.id === ownerId)
        void client.invalidateQueries({
          queryKey: ["auth", "me"],
          exact: true,
        });
    }
  }, [media.error, ownerId, client, session.data?.id]);
  const external = !!url && /^https:\/\//i.test(url);
  return (
    <span
      className="driver-avatar"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {match && media.data && !media.isError && !broken ? (
        <AvatarImage
          blob={media.data}
          size={size}
          onError={() => setBroken(true)}
        />
      ) : external && !broken ? (
        <img
          src={url!}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <circle cx="16" cy="11" r="5" />
          <path d="M5 29c0-8 5-11 11-11s11 3 11 11" />
        </svg>
      )}
    </span>
  );
}
