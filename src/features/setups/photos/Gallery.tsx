import { useEffect, useRef, useState } from "react";
import type { components } from "../../../api/generated/schema";
import { Button } from "../../../shared/components/Button";
import {
  InlineNotice,
  LoadingState,
} from "../../../shared/components/Feedback";
import { trapDialogTab } from "../form/dialogFocus";
import { PhotoImage } from "./PhotoImage";
import { usePhotos } from "./queries";
type Photo = components["schemas"]["SetupPhoto"];

export function Gallery({ setupId }: { setupId: string }) {
  const query = usePhotos(setupId);
  if (query.isPending) return <LoadingState>Loading photos…</LoadingState>;
  if (query.isError)
    return (
      <InlineNotice tone="error">
        Photos not found or unavailable.{" "}
        <Button onClick={() => void query.refetch()}>Retry photos</Button>
      </InlineNotice>
    );
  if (!query.data.length) return <p>No photos yet.</p>;
  return <PhotoCarousel key={setupId} photos={query.data} />;
}

function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState(photos[0]!.id);
  const activeRef = useRef(active);
  const index = Math.max(
    0,
    photos.findIndex((p) => p.id === active),
  );
  const track = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string>();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const selectedIndex = photos.findIndex((p) => p.id === selected);
  const current = photos[selectedIndex];
  useEffect(() => {
    if (current && !dialog.current?.open) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    if (!current && dialog.current?.open) dialog.current.close();
  }, [current]);
  useEffect(() => {
    const element = dialog.current;
    const dismiss = element?.close.bind(element);
    return () => dismiss?.();
  }, []);
  useEffect(() => {
    const element = track.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const next = Math.max(
        0,
        photos.findIndex((p) => p.id === activeRef.current),
      );
      element.scrollTo({
        left: next * element.clientWidth,
        behavior: "instant",
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [photos]);
  function go(next: number) {
    const bounded = (next + photos.length) % photos.length;
    activeRef.current = photos[bounded]!.id;
    setActive(activeRef.current);
    track.current?.scrollTo?.({
      left: bounded * track.current.clientWidth,
      behavior: "instant",
    });
  }
  function close() {
    setSelected(undefined);
    if (trigger.current?.isConnected)
      trigger.current.focus({ preventScroll: true });
  }
  function view(next: number) {
    setSelected(photos[(next + photos.length) % photos.length]!.id);
  }
  return (
    <section
      aria-label="Setup gallery"
      aria-roledescription="carousel"
      className="photo-carousel"
    >
      <h3 className="font-semibold">Photos</h3>
      <div
        ref={track}
        className="photo-slides"
        role="group"
        aria-label="Photo slides"
        tabIndex={0}
        onScroll={(e) => {
          const width = e.currentTarget.clientWidth;
          if (!width) return;
          const next = Math.max(
            0,
            Math.min(
              photos.length - 1,
              Math.round(e.currentTarget.scrollLeft / width),
            ),
          );
          activeRef.current = photos[next]!.id;
          setActive(activeRef.current);
        }}
        onKeyDown={(e) => {
          const next = {
            ArrowLeft: index - 1,
            ArrowRight: index + 1,
            Home: 0,
            End: photos.length - 1,
          }[e.key];
          if (next === undefined) return;
          e.preventDefault();
          e.currentTarget.focus({ preventScroll: true });
          go(next);
        }}
      >
        {photos.map((photo, i) => (
          <div
            key={photo.id}
            className="photo-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${photos.length}`}
            aria-hidden={i !== index}
          >
            <Button
              className="photo-hero"
              tabIndex={i === index ? 0 : -1}
              aria-label={`Enlarge photo ${i + 1}${photo.is_cover ? " (cover)" : ""}`}
              onClick={(e) => {
                trigger.current = e.currentTarget;
                setSelected(photo.id);
              }}
            >
              {Math.abs(i - index) <= 1 && (
                <PhotoImage
                  photo={photo}
                  alt={`Setup photo ${i + 1}`}
                  thumbnail={false}
                />
              )}
              <span className="photo-expand-hint">Enlarge</span>
            </Button>
          </div>
        ))}
      </div>
      <div className="gallery-controls">
        {photos.length > 1 && (
          <Button
            onClick={() => go(index - 1)}
            aria-label="Previous gallery photo"
          >
            ←
          </Button>
        )}
        <p role="status" aria-live="polite" aria-atomic="true">
          Photo {index + 1} of {photos.length}
        </p>
        {photos.length > 1 && (
          <Button onClick={() => go(index + 1)} aria-label="Next gallery photo">
            →
          </Button>
        )}
      </div>
      {photos.length > 1 && (
        <div
          className="gallery-thumbnails"
          role="group"
          aria-label="Choose photo"
        >
          {photos.map((photo, i) => (
            <Button
              key={photo.id}
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => go(i)}
            >
              <PhotoImage photo={photo} alt={`Photo ${i + 1} thumbnail`} />
            </Button>
          ))}
        </div>
      )}
      <dialog
        ref={dialog}
        aria-label="Enlarged setup photo"
        className="photo-viewer"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClose={close}
        onKeyDown={(e) => {
          trapDialogTab(e);
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          } else if (
            ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
          ) {
            e.preventDefault();
            view(
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? photos.length - 1
                  : selectedIndex + (e.key === "ArrowRight" ? 1 : -1),
            );
          }
        }}
      >
        {current && (
          <>
            <div className="flex flex-wrap justify-between gap-3">
              <p role="status" aria-live="polite">
                Photo {selectedIndex + 1} of {photos.length}
              </p>
              <Button autoFocus onClick={close}>
                Close photo
              </Button>
            </div>
            <PhotoImage
              key={current.id}
              photo={current}
              alt={`Enlarged setup photo ${selectedIndex + 1}`}
              thumbnail={false}
            />
            {photos.length > 1 && (
              <div className="flex justify-between gap-3">
                <Button onClick={() => view(selectedIndex - 1)}>
                  Previous photo
                </Button>
                <Button onClick={() => view(selectedIndex + 1)}>
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
