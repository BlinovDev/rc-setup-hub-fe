import { useRef } from "react";
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
  const pending = actions.mutation.isPending || queue.busy;
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
        />
      )}
      {actions.mutation.isError && (
        <InlineNotice tone="error">
          {photoError(actions.mutation.error)}
        </InlineNotice>
      )}
    </section>
  );
}
