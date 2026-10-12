import { useEffect, useRef, useState } from "react";
import type { components } from "../../../api/generated/schema";
import { Button } from "../../../shared/components/Button";
import {
  InlineNotice,
  LoadingState,
} from "../../../shared/components/Feedback";
import { SetupError } from "../api";
import { useCropPhoto } from "./queries";
import { usePhotoMedia } from "./usePhotoMedia";
import { boundCrop, centerCrop, zoomCrop } from "./crop";
type Photo = components["schemas"]["SetupPhoto"];
type Crop = components["schemas"]["PhotoCrop"];

export function CropEditor({
  photo,
  ownerId,
  onClose,
  onReload,
}: {
  photo: Photo;
  ownerId: string;
  onClose: () => void;
  onReload: () => Promise<Photo | undefined>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    crop: Crop;
  } | null>(null);
  const [base, setBase] = useState(photo);
  const [crop, setCrop] = useState(
    photo.crop ?? centerCrop(photo.width, photo.height),
  );
  const [loaded, setLoaded] = useState(false);
  const [decodeError, setDecodeError] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState("");
  const [missing, setMissing] = useState(false);
  const media = usePhotoMedia(base, false);
  const mutation = useCropPhoto(photo.setup_id, ownerId);
  const lock = useRef(false);
  const request = useRef<components["schemas"]["PhotoCropUpdate"] | null>(null);
  const pending = mutation.isPending || reloading;
  const conflict =
    mutation.error instanceof SetupError && mutation.error.status === 409;
  const unavailable =
    missing ||
    (mutation.error instanceof SetupError && mutation.error.status === 404);
  const ready =
    loaded &&
    !decodeError &&
    !media.isError &&
    !pending &&
    !conflict &&
    !unavailable;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = element?.close.bind(element);
    return () => close?.();
  }, []);
  useEffect(() => {
    if (!media.data || !image.current) return;
    const element = image.current;
    const source = URL.createObjectURL(media.data);
    element.src = source;
    return () => {
      URL.revokeObjectURL(source);
      element.removeAttribute("src");
    };
  }, [media.data]);
  function change(next: Crop) {
    if (!ready) return;
    request.current = null;
    mutation.reset();
    setCrop(boundCrop(next, base.width, base.height));
  }
  async function save(value: Crop | null, retry = false) {
    if (!ready || lock.current) return;
    lock.current = true;
    const body =
      retry && request.current
        ? request.current
        : { expected_revision: base.thumbnail_revision, crop: value };
    request.current = body;
    try {
      await mutation.mutateAsync({ photoId: base.id, body });
      onClose();
    } catch {
      /* Keep the draft and exact retry request. */
    } finally {
      lock.current = false;
    }
  }
  const error = conflict
    ? "This thumbnail changed. Reload crop before applying again; your draft will be discarded."
    : unavailable
      ? "Photo was deleted or is unavailable. Close the editor and reload photos."
      : "Thumbnail adjustment was not saved. The previously saved crop remains intact. Retry adjustment.";
  return (
    <dialog
      ref={dialog}
      className="photo-viewer crop-dialog"
      aria-label="Adjust thumbnail"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!pending) onClose();
        }
        if (event.key === "Tab") {
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
            ),
          );
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Adjust square thumbnail</h3>
        <Button disabled={pending} onClick={onClose}>
          Cancel adjustment
        </Button>
      </div>
      <p>
        Photo uploaded and saved. Adjusting this thumbnail saves immediately.
        Cancel keeps its current frame. The full photo stays uncropped.
      </p>
      {media.isPending && (
        <LoadingState>Loading normalized photo…</LoadingState>
      )}
      {(media.isError || decodeError) && (
        <InlineNotice tone="error">
          Normalized photo not found or unavailable.{" "}
          <Button
            disabled={media.isFetching}
            onClick={() => {
              setDecodeError(false);
              setLoaded(false);
              void media.refetch();
            }}
          >
            Retry preview
          </Button>
        </InlineNotice>
      )}
      {media.data && !media.isError && (
        <>
          <div
            ref={frame}
            className="crop-preview"
            role="group"
            aria-label="Square thumbnail preview"
            tabIndex={0}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 10 : 1;
              const move = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
              }[event.key];
              if (move) {
                event.preventDefault();
                change({ ...crop, x: crop.x + move[0]!, y: crop.y + move[1]! });
              }
            }}
            onPointerDown={(event) => {
              if (!ready) return;
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointer: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                crop,
              };
            }}
            onPointerMove={(event) => {
              const start = drag.current;
              if (!start || start.pointer !== event.pointerId || !ready) return;
              const scale =
                start.crop.size /
                event.currentTarget.getBoundingClientRect().width;
              change({
                ...start.crop,
                x: start.crop.x - (event.clientX - start.x) * scale,
                y: start.crop.y - (event.clientY - start.y) * scale,
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <img
              ref={image}
              alt="Normalized photo crop preview"
              draggable={false}
              style={{
                width: `${(base.width / crop.size) * 100}%`,
                height: `${(base.height / crop.size) * 100}%`,
                left: `${(-crop.x / crop.size) * 100}%`,
                top: `${(-crop.y / crop.size) * 100}%`,
              }}
              onLoad={(event) => {
                const el = event.currentTarget;
                setDecodeError(
                  el.naturalWidth !== base.width ||
                    el.naturalHeight !== base.height,
                );
                setLoaded(
                  el.naturalWidth === base.width &&
                    el.naturalHeight === base.height,
                );
              }}
              onError={() => {
                setDecodeError(true);
                setLoaded(false);
              }}
            />
          </div>
          <p className="text-sm">
            Drag the photo or use arrow keys (Shift for 10 pixels). Sliders
            offer the same controls. Preview uses integer pixels; JPEG
            resampling can slightly change edge colors.
          </p>
          <div className="crop-controls">
            <label>
              Zoom
              <input
                type="range"
                min={1}
                max={Math.min(base.width, base.height)}
                step={0.01}
                value={Math.min(base.width, base.height) / crop.size}
                disabled={!ready}
                onChange={(e) =>
                  change(
                    zoomCrop(
                      crop,
                      Number(e.target.value),
                      base.width,
                      base.height,
                    ),
                  )
                }
              />
            </label>
            <label>
              Horizontal position
              <input
                type="range"
                min={0}
                max={base.width - crop.size}
                step={1}
                value={crop.x}
                disabled={!ready}
                onChange={(e) => change({ ...crop, x: Number(e.target.value) })}
              />
            </label>
            <label>
              Vertical position
              <input
                type="range"
                min={0}
                max={base.height - crop.size}
                step={1}
                value={crop.y}
                disabled={!ready}
                onChange={(e) => change({ ...crop, y: Number(e.target.value) })}
              />
            </label>
          </div>
        </>
      )}
      {mutation.isError && <InlineNotice tone="error">{error}</InlineNotice>}
      {reloadError && <InlineNotice tone="error">{reloadError}</InlineNotice>}
      {pending && <p role="status">Saving thumbnail adjustment…</p>}
      <div className="flex flex-wrap gap-3">
        <Button disabled={!ready} onClick={() => void save(crop)}>
          Apply thumbnail
        </Button>
        <Button
          disabled={!ready}
          onClick={() => {
            setCrop(centerCrop(base.width, base.height));
            void save(null);
          }}
        >
          Reset to center
        </Button>
        {mutation.isError && !conflict && !unavailable && (
          <Button disabled={!ready} onClick={() => void save(crop, true)}>
            Retry adjustment
          </Button>
        )}
        {conflict && (
          <Button
            disabled={pending}
            onClick={async () => {
              setReloading(true);
              setReloadError("");
              try {
                const current = await onReload();
                if (current) {
                  setBase(current);
                  setCrop(
                    current.crop ?? centerCrop(current.width, current.height),
                  );
                  mutation.reset();
                  request.current = null;
                } else setMissing(true);
              } catch {
                setReloadError(
                  "Unable to reload crop. Retry reload; the draft was retained.",
                );
              } finally {
                setReloading(false);
              }
            }}
          >
            Reload crop
          </Button>
        )}
      </div>
    </dialog>
  );
}
