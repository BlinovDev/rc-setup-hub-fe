import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "../../../api/generated/schema";
import { currentUserOptions } from "../../auth/queries";
import { detailKey, withSession } from "../queries";
import { getPhotoImage } from "./api";
import { SetupError } from "../api";
export const placeholderPath = "/images/setup-photo-placeholder.webp";
function BlobImage({
  blob,
  alt,
  className,
  onError,
}: {
  blob: Blob;
  alt: string;
  className: string;
  onError: () => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    if (!element) return;
    const source = URL.createObjectURL(blob);
    element.src = source;
    return () => {
      URL.revokeObjectURL(source);
      element.removeAttribute("src");
    };
  }, [blob]);
  return (
    <img
      ref={image}
      alt={alt}
      className={className}
      loading="lazy"
      onError={onError}
    />
  );
}
export function PhotoImage({
  photo,
  alt,
  thumbnail = true,
}: {
  photo?: components["schemas"]["SetupPhoto"] | null;
  alt: string;
  thumbnail?: boolean;
}) {
  const client = useQueryClient();
  const session = useQuery(currentUserOptions);
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined",
  );
  const [brokenId, setBrokenId] = useState<string>();
  const broken = brokenId === photo?.id && brokenId !== undefined;
  useEffect(() => {
    if (!container.current || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const image = useQuery({
    queryKey: [
      ...detailKey(photo?.setup_id ?? "none"),
      "media",
      session.data?.id,
      photo?.id,
      thumbnail,
    ],
    queryFn: ({ signal }) =>
      withSession(client, () =>
        getPhotoImage(photo!.setup_id, photo!.id, thumbnail, signal),
      ),
    enabled: !!photo && !!session.data && (visible || !thumbnail),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const denied =
    image.error instanceof SetupError &&
    [401, 403, 404].includes(image.error.status);
  return (
    <div ref={container} className={thumbnail ? "photo-frame" : "photo-full"}>
      {denied ? (
        <p role="status">Photo not found or unavailable.</p>
      ) : photo && !image.isError && !broken ? (
        image.data ? (
          <BlobImage
            key={`${photo.id}-${thumbnail}`}
            blob={image.data}
            alt={alt}
            className={thumbnail ? "photo-thumb" : "photo-enlarged"}
            onError={() => setBrokenId(photo.id)}
          />
        ) : (
          <span>Loading photo…</span>
        )
      ) : (
        <>
          <img
            src={placeholderPath}
            alt={
              photo
                ? "Photo could not be displayed"
                : "No setup photo — placeholder"
            }
            className="photo-thumb"
            loading="lazy"
            width={600}
            height={400}
          />
          {photo && <span role="status">Photo could not be displayed.</span>}
        </>
      )}
    </div>
  );
}
