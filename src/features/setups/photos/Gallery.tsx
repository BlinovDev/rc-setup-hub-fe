import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { components } from "../../../api/generated/schema";
import { Button } from "../../../shared/components/Button";
import {
  InlineNotice,
  LoadingState,
} from "../../../shared/components/Feedback";
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

// Native scrolling owns swipe/vertical gestures. Only intentional taps activate
// an image; pointer cancellation (browser takes over scrolling) also cancels taps.
function usePhotoTap() {
  const gesture = useRef({ x: 0, y: 0, moved: false });
  return {
    onPointerDownCapture: (e: React.PointerEvent) => {
      gesture.current = { x: e.clientX, y: e.clientY, moved: !e.isPrimary };
    },
    onPointerMoveCapture: (e: React.PointerEvent) => {
      if (
        Math.hypot(
          e.clientX - gesture.current.x,
          e.clientY - gesture.current.y,
        ) > 8
      )
        gesture.current.moved = true;
    },
    onPointerCancelCapture: () => {
      gesture.current.moved = true;
    },
    isTap: (e: React.MouseEvent) => e.detail === 0 || !gesture.current.moved,
  };
}

function GalleryChevron({
  direction,
  label,
  onClick,
  disabled,
}: {
  direction: "previous" | "next";
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className={`gallery-chevron gallery-${direction}`}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d={direction === "previous" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(1);
  const [atEnd, setAtEnd] = useState(photos.length === 1);
  const track = useRef<HTMLDivElement>(null);
  const viewerTrack = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number>();
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const inlineTap = usePhotoTap();
  const viewerTap = usePhotoTap();
  const open = selected !== undefined && !!photos[selected];

  function step(element: HTMLDivElement) {
    const first = element.children[0] as HTMLElement | undefined;
    const second = element.children[1] as HTMLElement | undefined;
    return (
      (second && first && second.offsetLeft - first.offsetLeft) ||
      element.clientWidth
    );
  }
  function updateInline(element: HTMLDivElement) {
    const size = step(element);
    if (!size) return;
    setIndex(
      Math.min(
        photos.length - 1,
        Math.max(0, Math.round(element.scrollLeft / size)),
      ),
    );
    setVisible(Math.max(1, Math.round(element.clientWidth / size)));
    setAtEnd(
      element.scrollLeft >= element.scrollWidth - element.clientWidth - 2,
    );
  }
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    updateInline(element);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateInline(element));
    observer.observe(element);
    return () => observer.disconnect();
    // Geometry is remeasured for a changed list; scrolling updates the same state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);
  useEffect(() => {
    if (!open) return;
    const modal = dialog.current!;
    modal.showModal();
    const element = viewerTrack.current!;
    element.scrollTo?.({
      left: selectedRef.current! * element.clientWidth,
      behavior: "instant",
    });
    modal
      .querySelector<HTMLButtonElement>(".photo-viewer-image")
      ?.focus({ preventScroll: true });
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            element.scrollTo?.({
              left: (selectedRef.current ?? 0) * element.clientWidth,
              behavior: "instant",
            });
          });
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      modal.close();
      document.body.style.overflow = previous;
      if (trigger.current?.isConnected)
        trigger.current.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    if (selected === undefined) return;
    if (document.activeElement?.classList.contains("photo-viewer-image"))
      viewerTrack.current
        ?.querySelectorAll<HTMLButtonElement>(".photo-viewer-image")
        [selected]?.focus({ preventScroll: true });
  }, [selected]);
  function go(next: number) {
    const element = track.current;
    if (!element) return;
    const bounded = Math.max(0, Math.min(photos.length - 1, next));
    element.scrollTo?.({ left: bounded * step(element), behavior: "instant" });
  }
  function close() {
    setSelected(undefined);
  }
  function view(next: number) {
    const bounded = Math.max(0, Math.min(photos.length - 1, next));
    setSelected(bounded);
    viewerTrack.current?.scrollTo?.({
      left: bounded * viewerTrack.current.clientWidth,
      behavior: "instant",
    });
    // Move focus with the image so it never remains on an offscreen slide.
    viewerTrack.current
      ?.querySelectorAll<HTMLButtonElement>(".photo-viewer-image")
      [bounded]?.focus({ preventScroll: true });
  }
  return (
    <section
      aria-label="Setup gallery"
      aria-roledescription="carousel"
      className="photo-carousel"
    >
      <h3 className="font-semibold">Photos</h3>
      <div
        className="gallery-strip"
        style={
          {
            "--last-ratio":
              (photos[index + visible - 1]?.width ?? 1) /
              (photos[index + visible - 1]?.height ?? 1),
          } as CSSProperties
        }
      >
        <div
          ref={track}
          className="photo-slides"
          role="group"
          aria-label="Photo slides"
          tabIndex={0}
          onPointerDownCapture={inlineTap.onPointerDownCapture}
          onPointerMoveCapture={inlineTap.onPointerMoveCapture}
          onPointerCancelCapture={inlineTap.onPointerCancelCapture}
          onScroll={(e) => updateInline(e.currentTarget)}
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
            >
              <button
                type="button"
                className="photo-hero"
                style={
                  {
                    "--photo-ratio": photo.width / photo.height,
                  } as CSSProperties
                }
                aria-label={`Enlarge photo ${i + 1}${photo.is_cover ? " (cover)" : ""}`}
                onClick={(e) => {
                  if (!inlineTap.isTap(e)) return;
                  trigger.current = e.currentTarget;
                  setSelected(i);
                }}
              >
                {i >= index - 1 && i <= index + visible && (
                  <PhotoImage
                    photo={photo}
                    alt={`Setup photo ${i + 1}`}
                    thumbnail={false}
                  />
                )}
              </button>
            </div>
          ))}
        </div>
        {photos.length > visible && (
          <>
            <GalleryChevron
              direction="previous"
              label="Previous gallery photo"
              onClick={() => go(index - 1)}
              disabled={index === 0}
            />
            <GalleryChevron
              direction="next"
              label="Next gallery photo"
              onClick={() => go(index + 1)}
              disabled={atEnd}
            />
          </>
        )}
      </div>
      <p
        className="gallery-position"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Photo {index + 1} of {photos.length}
      </p>
      <dialog
        ref={dialog}
        aria-label="Enlarged setup photo"
        className="photo-viewer"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClose={close}
        onClick={(e) => {
          if (e.target === e.currentTarget && viewerTap.isTap(e)) close();
        }}
        onKeyDown={(e) => {
          // Native modal inertness plus explicit wrap of currently visible controls.
          if (e.key === "Tab") {
            const controls = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            ).filter(
              (el) =>
                el.tabIndex >= 0 && getComputedStyle(el).display !== "none",
            );
            const first = controls[0],
              last = controls.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          } else {
            const next = {
              ArrowLeft: (selected ?? 0) - 1,
              ArrowRight: (selected ?? 0) + 1,
              Home: 0,
              End: photos.length - 1,
            }[e.key];
            if (next !== undefined) {
              e.preventDefault();
              view(next);
            }
          }
        }}
      >
        {open && (
          <>
            <div
              ref={viewerTrack}
              className="viewer-slides"
              role="group"
              aria-label="Enlarged photo slides"
              onPointerDownCapture={viewerTap.onPointerDownCapture}
              onPointerMoveCapture={viewerTap.onPointerMoveCapture}
              onPointerCancelCapture={viewerTap.onPointerCancelCapture}
              onScroll={(e) => {
                const element = e.currentTarget;
                if (!element.clientWidth) return;
                const next = Math.max(
                  0,
                  Math.min(
                    photos.length - 1,
                    Math.round(element.scrollLeft / element.clientWidth),
                  ),
                );
                setSelected(next);
              }}
            >
              {photos.map((photo, i) => (
                <div
                  className="viewer-slide"
                  key={photo.id}
                  aria-hidden={i !== selected}
                >
                  <button
                    type="button"
                    className="photo-viewer-image"
                    style={
                      {
                        "--photo-ratio": photo.width / photo.height,
                      } as CSSProperties
                    }
                    aria-label={`Close photo ${i + 1}`}
                    tabIndex={i === selected ? 0 : -1}
                    onClick={(e) => {
                      if (viewerTap.isTap(e)) close();
                    }}
                  >
                    {Math.abs(i - selected) <= 1 && (
                      <PhotoImage
                        photo={photo}
                        alt={`Enlarged setup photo ${i + 1}`}
                        thumbnail={false}
                      />
                    )}
                  </button>
                </div>
              ))}
            </div>
            <p className="sr-only" role="status" aria-live="polite">
              Photo {selected + 1} of {photos.length}
            </p>
            {photos.length > 1 && (
              <div
                className="viewer-navigation"
                style={
                  {
                    "--photo-ratio":
                      photos[selected]!.width / photos[selected]!.height,
                  } as CSSProperties
                }
              >
                <GalleryChevron
                  direction="previous"
                  label="Previous photo"
                  onClick={() => view(selected - 1)}
                  disabled={selected === 0}
                />
                <GalleryChevron
                  direction="next"
                  label="Next photo"
                  onClick={() => view(selected + 1)}
                  disabled={selected === photos.length - 1}
                />
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
