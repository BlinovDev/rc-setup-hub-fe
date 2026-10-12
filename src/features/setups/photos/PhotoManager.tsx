import { useEffect, useRef, useState } from "react";
import type { components } from "../../../api/generated/schema";
import { CropEditor } from "./CropEditor";
import { Button } from "../../../shared/components/Button";
import {
  InlineNotice,
  LoadingState,
} from "../../../shared/components/Feedback";
import { PhotoPicker } from "./queue";
import { usePhotoQueue, type PhotoQueue } from "./usePhotoQueue";
import { PersistedPhotos } from "./Gallery";
import { usePhotoActions, usePhotos } from "./queries";
import { photoError } from "./api";
export function PhotoManager({
  setupId,
  ownerId,
  queue: existingQueue,
}: {
  setupId: string;
  ownerId: string;
  queue?: PhotoQueue;
}) {
  const ownQueue = usePhotoQueue();
  const queue = existingQueue ?? ownQueue;
  const photos = usePhotos(setupId);
  const actions = usePhotoActions(setupId, ownerId);
  const actionLock = useRef(false);
  const [selected, setSelected] =
    useState<components["schemas"]["SetupPhoto"]>();
  const offered = useRef(new Set<string>());
  const opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (selected || !photos.isSuccess) return;
    opener.current?.focus();
    const next = queue.items.find(
      (item) =>
        item.state === "uploaded" &&
        item.photo &&
        !offered.current.has(item.photo.id),
    );
    if (!next?.photo) return;
    const current = photos.data.find((p) => p.id === next.photo!.id);
    if (current) {
      offered.current.add(next.photo.id);
      opener.current = document.getElementById(
        `crop-${current.id}`,
      ) as HTMLButtonElement | null;
      setSelected(current);
    }
  }, [queue.items, queue.busy, photos.data, photos.isSuccess, selected]);
  function closeEditor() {
    setSelected(undefined);
  }
  function perform(photoId: string, remove: boolean) {
    if (actionLock.current || queue.busy) return;
    actionLock.current = true;
    actions.mutation.mutate(
      { photoId, remove },
      {
        onSuccess: () => {
          if (remove) queue.forget(photoId);
        },
        onSettled: () => {
          actionLock.current = false;
        },
      },
    );
  }
  const pending = actions.mutation.isPending || queue.busy || !!selected;
  return (
    <section className="space-y-4" aria-label="Manage setup photos">
      <PhotoPicker
        saved
        queue={queue}
        stored={photos.data ?? []}
        disabled={!photos.isSuccess || actions.mutation.isPending}
        onUpload={() =>
          void queue.send((item) =>
            actions.upload.mutateAsync({
              file: item.file,
              requestId: item.requestId,
            }),
          )
        }
        onRetry={(id) =>
          void queue.send(
            (item) =>
              actions.upload.mutateAsync({
                file: item.file,
                requestId: item.requestId,
              }),
            id,
          )
        }
      />
      {photos.isPending ? (
        <LoadingState>Loading saved photos…</LoadingState>
      ) : photos.isError ? (
        <InlineNotice tone="error">
          Photos not found or unavailable.{" "}
          <Button onClick={() => void photos.refetch()}>Reload photos</Button>
        </InlineNotice>
      ) : (
        <PersistedPhotos
          photos={photos.data}
          pending={pending}
          onCover={(photoId) => perform(photoId, false)}
          onDelete={(photoId) => perform(photoId, true)}
          onCrop={(photo) => {
            opener.current = document.getElementById(
              `crop-${photo.id}`,
            ) as HTMLButtonElement | null;
            setSelected(photo);
          }}
        />
      )}
      {actions.mutation.isError && (
        <InlineNotice tone="error">
          {photoError(actions.mutation.error)}
        </InlineNotice>
      )}
      {selected && (
        <CropEditor
          key={selected.id}
          photo={selected}
          ownerId={ownerId}
          onClose={closeEditor}
          onReload={async () => {
            const result = await photos.refetch();
            if (!result.isSuccess) throw new Error("Reload failed");
            return result.data?.find((p) => p.id === selected.id);
          }}
        />
      )}
    </section>
  );
}
