import { SquareCropPreview } from "./SquareCropPreview";
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
import { boundCrop, centerCrop } from "./crop";
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
  const [resetKey, setResetKey] = useState(0);
  const [crop, setCrop] = useState(
    photo.crop ?? centerCrop(photo.width, photo.height),
  );
  const resetDraft = useRef(false);
  function replaceCrop(next: Crop) {
    setCrop(next);
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
            replaceCrop(centerCrop(base.width, base.height));
            resetDraft.current = true;
            setResetKey((value) => value + 1);
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
          <SquareCropPreview
            resetKey={resetKey}
            width={base.width}
            height={base.height}
            crop={crop}
            ready={ready}
            onChange={change}
            imageRef={image}
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
                      setResetKey((value) => value + 1);
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
