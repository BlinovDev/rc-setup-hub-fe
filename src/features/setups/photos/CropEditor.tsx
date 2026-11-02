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
import {
  boundCrop,
  centerCrop,
  maxCropZoom,
  panCrop,
  zoomCropAt,
} from "./crop";
import { trapDialogTab } from "../form/dialogFocus";
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
  const [base, setBase] = useState(photo);
  const [crop, setCrop] = useState(
    photo.crop ?? centerCrop(photo.width, photo.height),
  );
  const draft = useRef(crop);
  const resetDraft = useRef(false);
  type Point = { x: number; y: number };
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ crop: Crop; points: Point[] } | null>(null);
  const zoomLimit = maxCropZoom(base.width, base.height);
  const actualZoom = Math.min(base.width, base.height) / crop.size;
  const legacyZoom = actualZoom > zoomLimit + 0.01;
  function replaceCrop(next: Crop) {
    draft.current = next;
    setCrop(next);
  }
  function startGesture() {
    gesture.current = {
      crop: draft.current,
      points: [...pointers.current.values()],
    };
  }
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
    if (unavailable || !media.data || !image.current) return;
    const element = image.current;
    const source = URL.createObjectURL(media.data);
    element.src = source;
    return () => {
      URL.revokeObjectURL(source);
      element.removeAttribute("src");
    };
  }, [media.data, unavailable]);
  function change(next: Crop) {
    if (!ready) return;
    request.current = null;
    mutation.reset();
    resetDraft.current = false;
    replaceCrop(boundCrop(next, base.width, base.height));
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
      : "Thumbnail adjustment was not saved. The previously saved crop remains intact. Retry saving.";
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
        trapDialogTab(event);
      }}
    >
      <div className="crop-header">
        <h3 className="font-semibold">Adjust square thumbnail</h3>
        <Button
          disabled={!ready}
          onClick={() => {
            request.current = null;
            mutation.reset();
            pointers.current.clear();
            gesture.current = null;
            replaceCrop(centerCrop(base.width, base.height));
            resetDraft.current = true;
          }}
        >
          Reset to center
        </Button>
      </div>
      <p className="crop-help">
        Drag to move and pinch to zoom. Save applies the square thumbnail; the
        full photo stays unchanged.
      </p>
      <div className="crop-workspace">
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
        {media.data && !media.isError && !unavailable && (
          <div className="crop-stage">
            <div
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
                  change({
                    ...crop,
                    x: crop.x + move[0]!,
                    y: crop.y + move[1]!,
                  });
                  return;
                }
                if (["+", "=", "Add"].includes(event.key)) {
                  event.preventDefault();
                  if (!legacyZoom)
                    change(
                      zoomCropAt(
                        crop,
                        actualZoom + 0.25,
                        base.width,
                        base.height,
                      ),
                    );
                } else if (["-", "_", "Subtract"].includes(event.key)) {
                  event.preventDefault();
                  change(
                    zoomCropAt(
                      crop,
                      actualZoom - 0.25,
                      base.width,
                      base.height,
                    ),
                  );
                }
              }}
              aria-describedby="crop-instructions"
              onPointerDown={(event) => {
                if (
                  !ready ||
                  pointers.current.size >= 2 ||
                  (event.pointerType === "mouse" && event.button !== 0)
                )
                  return;
                event.currentTarget.focus();
                event.currentTarget.setPointerCapture(event.pointerId);
                pointers.current.set(event.pointerId, {
                  x: event.clientX,
                  y: event.clientY,
                });
                startGesture();
              }}
              onPointerMove={(event) => {
                const start = gesture.current;
                if (!start || !pointers.current.has(event.pointerId) || !ready)
                  return;
                pointers.current.set(event.pointerId, {
                  x: event.clientX,
                  y: event.clientY,
                });
                const points = [...pointers.current.values()];
                const box = event.currentTarget.getBoundingClientRect();
                if (box.width <= 0) return;
                if (
                  start.points.length === 2 &&
                  points.length === 2 &&
                  !legacyZoom
                ) {
                  const distance = (p: Point[]) =>
                    Math.hypot(p[1]!.x - p[0]!.x, p[1]!.y - p[0]!.y);
                  const midpoint = (p: Point[]) => ({
                    x: ((p[0]!.x + p[1]!.x) / 2 - box.left) / box.width,
                    y: ((p[0]!.y + p[1]!.y) / 2 - box.top) / box.width,
                  });
                  const initial = distance(start.points);
                  if (initial < 1) return;
                  const zoom =
                    ((Math.min(base.width, base.height) / start.crop.size) *
                      distance(points)) /
                    initial;
                  change(
                    zoomCropAt(
                      start.crop,
                      zoom,
                      base.width,
                      base.height,
                      midpoint(start.points),
                      midpoint(points),
                    ),
                  );
                } else if (points.length === 1 && start.points.length === 1) {
                  change(
                    panCrop(
                      start.crop,
                      points[0]!.x - start.points[0]!.x,
                      points[0]!.y - start.points[0]!.y,
                      box.width,
                      base.width,
                      base.height,
                    ),
                  );
                }
              }}
              onPointerUp={(event) => {
                pointers.current.delete(event.pointerId);
                startGesture();
              }}
              onPointerCancel={(event) => {
                pointers.current.delete(event.pointerId);
                startGesture();
              }}
              onLostPointerCapture={(event) => {
                pointers.current.delete(event.pointerId);
                startGesture();
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
            <p id="crop-instructions" className="sr-only">
              Drag to move and pinch to zoom. With a keyboard, use arrow keys to
              move and plus or minus to zoom. Coordinates use integer pixels.
            </p>
            <p role="status" className="crop-zoom-status">
              Zoom {actualZoom.toFixed(2)}×
            </p>
            {legacyZoom && (
              <p className="crop-legacy-warning">
                The saved crop is tighter than the 4× editing range. It is
                preserved. Reset to center to adjust zoom.
              </p>
            )}
          </div>
        )}
        {mutation.isError && (
          <InlineNotice tone="error">
            {error}
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
                      replaceCrop(
                        current.crop ??
                          centerCrop(current.width, current.height),
                      );
                      resetDraft.current = false;
                      pointers.current.clear();
                      gesture.current = null;
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
          </InlineNotice>
        )}
        {reloadError && <InlineNotice tone="error">{reloadError}</InlineNotice>}
        {pending && <p role="status">Saving thumbnail adjustment…</p>}
      </div>
      <div className="crop-actions">
        <Button disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!ready}
          onClick={() =>
            void save(
              resetDraft.current ? null : crop,
              mutation.isError && !conflict && !unavailable,
            )
          }
        >
          {mutation.isError && !conflict && !unavailable
            ? "Retry save"
            : "Save thumbnail"}
        </Button>
      </div>
    </dialog>
  );
}
