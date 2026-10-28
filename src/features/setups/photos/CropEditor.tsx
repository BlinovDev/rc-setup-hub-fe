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
  zoomCrop,
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
  const frame = useRef<HTMLDivElement>(null);
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
        trapDialogTab(event);
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
      {media.data && !media.isError && !unavailable && (
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
          <p id="crop-instructions" className="text-sm">
            Drag or pinch the photo or use arrow keys to move the crop window
            (Shift for 10 pixels). Sliders offer the same controls. Preview uses
            integer pixels; JPEG resampling can slightly change edge colors.
          </p>
          <p role="status">Zoom {actualZoom.toFixed(2)}×</p>
          {legacyZoom && (
            <p>
              The saved crop is tighter than the 4× editing range. It is
              preserved. Reset to center to adjust zoom; Cancel keeps the saved
              frame.
            </p>
          )}
          <div className="crop-controls">
            <label>
              Zoom
              <input
                type="range"
                min={1}
                max={zoomLimit}
                step={0.05}
                value={Math.min(zoomLimit, actualZoom)}
                aria-valuetext={`${actualZoom.toFixed(2)} times`}
                disabled={!ready || legacyZoom || zoomLimit === 1}
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
        <Button
          disabled={!ready}
          onClick={() => void save(resetDraft.current ? null : crop)}
        >
          Apply thumbnail
        </Button>
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
                  replaceCrop(
                    current.crop ?? centerCrop(current.width, current.height),
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
      </div>
    </dialog>
  );
}
