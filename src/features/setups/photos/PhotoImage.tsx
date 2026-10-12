import { useEffect, useRef, useState } from "react";
import type { components } from "../../../api/generated/schema";
import { usePhotoMedia } from "./usePhotoMedia";
import { SetupError } from "../api";
export const placeholderPath = "/images/setup-photo-placeholder.webp";
function BlobImage({
  blob,
  alt,
  className,
  onError,
  width,
  height,
}: {
  blob: Blob;
  alt: string;
  className: string;
  onError: () => void;
  width: number;
  height: number;
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
      width={width}
      height={height}
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
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined",
  );
  const [brokenId, setBrokenId] = useState<string>();
  const identity = `${photo?.id}-${thumbnail ? photo?.thumbnail_revision : "full"}`;
  const broken = brokenId === identity;
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
  const image = usePhotoMedia(photo, thumbnail, visible || !thumbnail);
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
            key={identity}
            blob={image.data}
            alt={alt}
            className={thumbnail ? "photo-thumb" : "photo-enlarged"}
            width={thumbnail ? photo.thumbnail_width : photo.width}
            height={thumbnail ? photo.thumbnail_height : photo.height}
            onError={() => setBrokenId(identity)}
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
            className={thumbnail ? "photo-thumb" : "photo-enlarged"}
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
