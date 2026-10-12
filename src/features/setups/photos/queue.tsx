import { useEffect, useRef, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { InlineNotice } from "../../../shared/components/Feedback";
import type { components } from "../../../api/generated/schema";

export const acceptedPhotoTypes =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
import type { PhotoQueue } from "./usePhotoQueue";
function Preview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    const element = image.current;
    if (!element || broken) return;
    const source = URL.createObjectURL(file);
    element.src = source;
    return () => {
      URL.revokeObjectURL(source);
      element.removeAttribute("src");
    };
  }, [file, broken]);
  return broken ? (
    <p>Local preview unavailable; the server will convert supported photos.</p>
  ) : (
    <img
      ref={image}
      className="photo-queued-preview"
      alt={`Queued preview: ${file.name}`}
      onError={() => setBroken(true)}
    />
  );
}
export function PhotoPicker({
  queue,
  stored = [],
  disabled = false,
  onUpload,
  onRetry,
}: {
  queue: PhotoQueue;
  stored?: components["schemas"]["SetupPhoto"][];
  disabled?: boolean;
  onUpload?: () => void;
  onRetry?: (id: string) => void;
}) {
  const count =
    new Set([
      ...stored.map((p) => p.id),
      ...queue.items.flatMap((i) => (i.photo ? [i.photo.id] : [])),
    ]).size + queue.items.filter((i) => i.state !== "uploaded").length;
  return (
    <section
      className="space-y-3 rounded border p-4"
      aria-label="Photo upload queue"
    >
      <h3 className="font-semibold">Optional photos</h3>
      <p>
        JPEG, PNG, WebP or HEIC/HEIF · 25 MiB per file · up to 10 photos. The
        server converts the first still image, corrects orientation and removes
        metadata.
      </p>
      <p>{count}/10 photo slots used (saved and queued).</p>
      <label htmlFor="setup-photo-files">Choose photos</label>
      <input
        id="setup-photo-files"
        type="file"
        accept={acceptedPhotoTypes}
        multiple
        disabled={disabled || queue.busy}
        onChange={(e) => {
          queue.select(Array.from(e.target.files ?? []), stored);
          e.target.value = "";
        }}
        className="max-w-full"
      />
      {queue.error && <InlineNotice tone="error">{queue.error}</InlineNotice>}
      <ul className="photo-queue">
        {queue.items.map((item) => (
          <li key={item.requestId} className="space-y-2 rounded border p-3">
            <Preview file={item.file} />
            <p className="break-words">{item.file.name}</p>
            <p role="status">
              {item.state === "queued"
                ? "Queued — not uploaded"
                : item.state === "uploading"
                  ? "Uploading…"
                  : item.state === "uploaded"
                    ? "Uploaded and saved"
                    : "Upload failed"}
            </p>
            {item.error && (
              <InlineNotice tone="error">{item.error}</InlineNotice>
            )}
            {item.state !== "uploaded" && (
              <Button
                disabled={queue.busy || disabled}
                onClick={() => queue.remove(item.requestId)}
              >
                Remove queued {item.file.name}
              </Button>
            )}
            {item.state === "error" && onRetry && (
              <Button
                disabled={queue.busy || disabled}
                onClick={() => onRetry(item.requestId)}
              >
                Retry {item.file.name}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {onUpload && queue.items.some((i) => i.state === "queued") && (
        <Button disabled={disabled || queue.busy} onClick={onUpload}>
          Upload queued photos
        </Button>
      )}
    </section>
  );
}
