import { captureSession } from "../auth/sessionCache";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { profileMutationKey } from "./queries";
import { useEffect, useRef, useState } from "react";
import type { components } from "../../api/generated/schema";
import { Button } from "../../shared/components/Button";
import { InlineNotice } from "../../shared/components/Feedback";
import { SquareCropPreview } from "../setups/photos/SquareCropPreview";
import {
  boundCrop,
  centerCrop,
  maxCropZoom,
  zoomCropAt,
} from "../setups/photos/crop";
import { trapDialogTab } from "../setups/form/dialogFocus";
import { Avatar } from "./Avatar";
import { ProfileError } from "./api";
import { useRemoveAvatar, useUploadAvatar } from "./queries";

type Crop = components["schemas"]["PhotoCrop"];
const maxBytes = 10 * 1024 * 1024;

export function AvatarEditor({
  user,
}: {
  user: components["schemas"]["User"];
}) {
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (file) restoreFocus.current = true;
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      opener.current?.focus();
    }
  }, [file]);
  const remove = useRemoveAvatar();
  const busy = useIsMutating({ mutationKey: profileMutationKey }) > 0;
  return (
    <section className="profile-avatar-editor" aria-labelledby="avatar-title">
      <h3 id="avatar-title" className="font-semibold">
        Profile photo
      </h3>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar url={user.avatar_url} size={80} />
        <div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            className="sr-only"
            aria-label="Choose avatar file"
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!selected) return;
              setError("");
              remove.reset();
              if (selected.size === 0 || selected.size > maxBytes) {
                setError("Choose a nonempty image of at most 10 MiB.");
                return;
              }
              setFile(selected);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              ref={opener}
              disabled={busy || !!file}
              onClick={() => input.current?.click()}
            >
              {user.has_custom_avatar ? "Replace avatar" : "Upload avatar"}
            </Button>
            {user.has_custom_avatar && (
              <Button
                disabled={busy || !!file}
                onClick={() => {
                  setConfirmRemove(true);
                  remove.reset();
                }}
              >
                Remove avatar
              </Button>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            JPEG, PNG, WebP or HEIC/HEIF · up to 10 MiB and 50 megapixels.
          </p>
          <p className="text-sm text-slate-600">
            Photo changes save immediately. Removing a custom photo restores
            Google, or the default avatar.
          </p>
        </div>
      </div>
      {confirmRemove && (
        <div
          className="mt-3 space-y-2"
          role="group"
          aria-label="Confirm avatar removal"
        >
          <p>Remove your custom avatar?</p>
          <Button
            autoFocus
            disabled={remove.isPending}
            onClick={() => setConfirmRemove(false)}
          >
            Cancel removal
          </Button>{" "}
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={async () => {
              try {
                await remove.mutateAsync();
                setConfirmRemove(false);
                opener.current?.focus();
              } catch {
                /* safe feedback below */
              }
            }}
          >
            {remove.isPending ? "Removing…" : "Confirm removal"}
          </Button>
        </div>
      )}
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      {remove.isError && (
        <InlineNotice tone="error">
          Unable to remove avatar. Your current photo is unchanged. Try again.
        </InlineNotice>
      )}
      {remove.isSuccess && <InlineNotice>Avatar removed.</InlineNotice>}
      {file && (
        <AvatarCropDialog
          file={file}
          onClose={() => {
            setFile(undefined);
            opener.current?.focus();
          }}
        />
      )}
    </section>
  );
}

function avatarError(error: Error) {
  if (error instanceof ProfileError) {
    if (error.status === 400 || error.status === 413)
      return "Choose a valid JPEG, PNG, WebP or HEIC/HEIF image of at most 10 MiB and 50 megapixels.";
    if (error.status === 403)
      return "Avatar upload was not permitted. Reload and try again.";
    if (error.status === 404)
      return "Your profile is unavailable. Reload before trying again.";
    if (error.status === 503)
      return "Avatar uploads are busy. Try again shortly.";
  }
  return "Avatar was not saved. Your current photo is unchanged. Try again.";
}

export function AvatarCropDialog({
  file,
  onClose,
}: {
  file: File;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const alive = useRef(true);
  const dialog = useRef<HTMLDialogElement>(null),
    image = useRef<HTMLImageElement>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  }>();
  const [resetKey, setResetKey] = useState(0);
  const [crop, setCrop] = useState<Crop>();
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const upload = useUploadAvatar();
  const [preparing, setPreparing] = useState(false);
  const pending = upload.isPending || preparing;
  const excessive =
    !!dimensions && dimensions.width * dimensions.height > 50_000_000;
  useEffect(() => {
    alive.current = true;
    const element = dialog.current;
    element?.showModal();
    const source = URL.createObjectURL(file);
    if (image.current) image.current.src = source;
    return () => {
      alive.current = false;
      URL.revokeObjectURL(source);
      element?.close();
    };
  }, [file]);
  async function confirm() {
    if (lock.current || excessive || (!decodeFailed && (!crop || !dimensions)))
      return;
    const isCurrent = captureSession(client);
    lock.current = true;
    setPreparing(true);
    setError("");
    try {
      let output = file;
      if (!decodeFailed && crop && image.current) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = Math.min(crop.size, 640);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Preview unavailable");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
          image.current,
          crop.x,
          crop.y,
          crop.size,
          crop.size,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error("Image encoding failed")),
            "image/jpeg",
            0.9,
          ),
        );
        output = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      }
      if (!alive.current || !isCurrent()) return;
      await upload.mutateAsync(output);
      onClose();
    } catch (error) {
      setError(
        avatarError(
          error instanceof Error ? error : new Error("Avatar failed"),
        ),
      );
    } finally {
      lock.current = false;
      setPreparing(false);
    }
  }
  const frame = dimensions && crop && !decodeFailed && !excessive;
  return (
    <dialog
      ref={dialog}
      className={`photo-viewer crop-dialog avatar-crop-dialog ${decodeFailed || excessive ? "avatar-preview-unavailable" : ""}`}
      aria-label="Adjust avatar"
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
        <h3 className="font-semibold">Adjust square avatar</h3>
        <Button
          disabled={pending || !dimensions || excessive}
          onClick={() => {
            if (dimensions) {
              setCrop(centerCrop(dimensions.width, dimensions.height));
              setResetKey((value) => value + 1);
            }
          }}
        >
          Reset to center
        </Button>
      </div>
      <p className="crop-help">
        Drag to move and pinch to zoom. Confirming saves your profile photo
        immediately.
      </p>
      <div className="crop-workspace">
        <SquareCropPreview
          resetKey={resetKey}
          hidden={decodeFailed || excessive}
          width={dimensions?.width ?? 1}
          height={dimensions?.height ?? 1}
          crop={crop ?? { x: 0, y: 0, size: 1 }}
          ready={!!frame && !pending}
          imageRef={image}
          label="Square avatar preview"
          alt="Avatar crop preview"
          onChange={(next) => {
            if (dimensions)
              setCrop(boundCrop(next, dimensions.width, dimensions.height));
          }}
          onLoad={(event) => {
            const { naturalWidth: width, naturalHeight: height } =
              event.currentTarget;
            setDimensions({ width, height });
            setCrop(centerCrop(width, height));
          }}
          onError={() => setDecodeFailed(true)}
        />
        {decodeFailed && (
          <InlineNotice>
            This browser cannot preview this file. You can upload it for a
            server-centered square crop; unsupported or corrupt files will be
            rejected.
          </InlineNotice>
        )}
        {excessive && (
          <InlineNotice tone="error">
            Choose an image of at most 50 megapixels.
          </InlineNotice>
        )}
        {frame && (
          <label className="avatar-zoom">
            Zoom{" "}
            <input
              aria-label="Avatar zoom"
              type="range"
              min="1"
              max={maxCropZoom(dimensions.width, dimensions.height)}
              step="0.05"
              disabled={pending}
              value={Math.min(dimensions.width, dimensions.height) / crop.size}
              onChange={(event) =>
                setCrop(
                  zoomCropAt(
                    crop,
                    Number(event.target.value),
                    dimensions.width,
                    dimensions.height,
                  ),
                )
              }
            />
          </label>
        )}
        {error && <InlineNotice tone="error">{error}</InlineNotice>}
      </div>
      <div className="crop-actions">
        <Button disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={pending || excessive || (!frame && !decodeFailed)}
          onClick={() => void confirm()}
        >
          {pending
            ? "Saving avatar…"
            : error
              ? "Retry avatar upload"
              : decodeFailed
                ? "Upload centered avatar"
                : "Use this avatar"}
        </Button>
      </div>
    </dialog>
  );
}
