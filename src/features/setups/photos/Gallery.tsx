import { useEffect, useRef, useState } from "react";
import type { components } from "../../../api/generated/schema";
import { Button } from "../../../shared/components/Button";
import {
  InlineNotice,
  LoadingState,
} from "../../../shared/components/Feedback";
import { PhotoImage } from "./PhotoImage";
import { usePhotos } from "./queries";
export function Gallery({ setupId }: { setupId: string }) {
  const photos = usePhotos(setupId);
  const [selected, setSelected] = useState<string>();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const gallery = photos.isError ? [] : (photos.data ?? []);
  const index = gallery.findIndex((p) => p.id === selected);
  const current = gallery[index];
  useEffect(() => {
    if (current && !dialog.current?.open) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    if (!current && dialog.current?.open) dialog.current.close();
  }, [current]);
  function close() {
    setSelected(undefined);
    trigger.current?.focus();
  }
  if (photos.isPending) return <LoadingState>Loading photos…</LoadingState>;
  if (photos.isError)
    return (
      <InlineNotice tone="error">
        Photos not found or unavailable.{" "}
        <Button onClick={() => void photos.refetch()}>Retry photos</Button>
      </InlineNotice>
    );
  if (!gallery.length) return <p>No photos yet.</p>;
  return (
    <section aria-label="Setup gallery" className="space-y-3">
      <h3 className="font-semibold">Photos</h3>
      <div className="photo-grid">
        {gallery.map((p, i) => (
          <Button
            key={p.id}
            className="photo-open"
            aria-label={`Enlarge photo ${i + 1}${p.is_cover ? " (cover)" : ""}`}
            onClick={(e) => {
              trigger.current = e.currentTarget;
              setSelected(p.id);
            }}
          >
            <PhotoImage photo={p} alt={`Setup photo ${i + 1}`} />
            {p.is_cover && <span>Cover</span>}
          </Button>
        ))}
      </div>
      <dialog
        ref={dialog}
        aria-label="Enlarged setup photo"
        className="photo-viewer"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }
          if (event.key === "Tab") {
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            );
            const first = buttons[0],
              last = buttons.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
        onCancel={close}
        onClose={close}
      >
        {current && (
          <>
            <div className="flex flex-wrap justify-between gap-3">
              <p>
                Photo {index + 1} of {gallery.length}
              </p>
              <Button autoFocus onClick={close}>
                Close photo
              </Button>
            </div>
            <PhotoImage
              key={current.id}
              photo={current}
              alt={`Enlarged setup photo ${index + 1}`}
              thumbnail={false}
            />
            {gallery.length > 1 && (
              <div className="flex justify-between gap-3">
                <Button
                  onClick={() =>
                    setSelected(
                      gallery[(index + gallery.length - 1) % gallery.length]!
                        .id,
                    )
                  }
                >
                  Previous photo
                </Button>
                <Button
                  onClick={() =>
                    setSelected(gallery[(index + 1) % gallery.length]!.id)
                  }
                >
                  Next photo
                </Button>
              </div>
            )}
          </>
        )}
      </dialog>
    </section>
  );
}
export function PersistedPhotos({
  photos,
  pending,
  onCover,
  onDelete,
  onCrop,
}: {
  photos: components["schemas"]["SetupPhoto"][];
  pending: boolean;
  onCover: (id: string) => void;
  onDelete: (id: string) => void;
  onCrop: (photo: components["schemas"]["SetupPhoto"]) => void;
}) {
  const [confirm, setConfirm] = useState<string>();
  const restore = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (confirm === undefined && restore.current) {
      document.getElementById(`delete-${restore.current}`)?.focus();
      restore.current = undefined;
    }
  }, [confirm]);
  return (
    <div className="photo-grid">
      {photos.map((p, i) => (
        <article key={p.id} className="space-y-2 rounded border p-3">
          <PhotoImage photo={p} alt={`Saved setup photo ${i + 1}`} />
          <p>{p.is_cover ? "Cover photo" : "Saved photo"}</p>
          <Button
            id={`crop-${p.id}`}
            disabled={pending}
            onClick={() => onCrop(p)}
          >
            Adjust thumbnail {i + 1}
          </Button>
          {!p.is_cover && (
            <Button disabled={pending} onClick={() => onCover(p.id)}>
              Make photo {i + 1} cover
            </Button>
          )}
          {confirm === p.id ? (
            <div role="group" aria-label={`Confirm photo ${i + 1} deletion`}>
              <p>Delete this saved photo immediately?</p>
              <Button
                autoFocus
                disabled={pending}
                onClick={() => {
                  setConfirm(undefined);
                  restore.current = p.id;
                }}
              >
                Keep photo
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  onDelete(p.id);
                  setConfirm(undefined);
                }}
              >
                Confirm delete photo {i + 1}
              </Button>
            </div>
          ) : (
            <Button
              id={`delete-${p.id}`}
              disabled={pending}
              onClick={() => {
                setConfirm(p.id);
              }}
            >
              Delete photo {i + 1}
            </Button>
          )}
        </article>
      ))}
    </div>
  );
}
