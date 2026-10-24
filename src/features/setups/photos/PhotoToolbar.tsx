import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../../shared/components/Button";

export function PhotoToolbar({
  count,
  saved,
  disabled,
  accept,
  onSelect,
  countStatus = "loaded",
}: {
  count: number;
  saved: boolean;
  disabled: boolean;
  accept: string;
  onSelect: (files: File[]) => void;
  countStatus?: "loaded" | "loading" | "unavailable";
}) {
  const input = useRef<HTMLInputElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      // Restore focus only if it was in this popover, not elsewhere on the page.
      if (
        trigger.current?.contains(document.activeElement) ||
        panel.current?.contains(document.activeElement)
      )
        trigger.current?.focus();
      setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      ref={info}
      onMouseLeave={() => {
        if (!info.current?.contains(document.activeElement)) setOpen(false);
      }}
      onBlur={(event) => {
        if (
          !trigger.current?.contains(event.relatedTarget) &&
          !panel.current?.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <div className="photo-toolbar">
        <h3 className="font-semibold">Photos</h3>
        <p role="status">
          {countStatus === "loaded"
            ? `${count}/10 photo slots used (saved and queued).`
            : countStatus === "loading"
              ? "Loading photo count…"
              : "Photo count unavailable."}
        </p>
        <div className="photo-toolbar-actions">
          <Button
            aria-label="Choose photos"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9a7 7 0 0 1 10 10l-9 9" />
            </svg>
          </Button>
          <input
            ref={input}
            id={`${id}-files`}
            aria-label="Photo files"
            type="file"
            accept={accept}
            multiple
            hidden
            disabled={disabled}
            onChange={(event) => {
              onSelect(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <div className="photo-info" onMouseEnter={() => setOpen(true)}>
            <Button
              ref={trigger}
              aria-label="Photo information"
              aria-expanded={open}
              aria-controls={`${id}-info`}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v6M12 7v2" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
      <p className="text-sm">
        {countStatus === "loaded"
          ? `${Math.max(0, 10 - count)} photo slots remaining.`
          : "Load saved photos before adding more."}{" "}
        {saved
          ? "Photo changes save immediately."
          : "Queued photos upload after Create setup."}
      </p>
      {open && (
        <div
          ref={panel}
          id={`${id}-info`}
          className="photo-info-panel"
          role="region"
          aria-label="Photo information details"
        >
          <p>
            JPEG, PNG, WebP or HEIC/HEIF · 25 MiB per file · up to 10 photos.
            The server limits decoded images to 50 MP, converts the first still
            image, corrects orientation and removes metadata.
          </p>
          <p>
            {saved
              ? "Photo uploads, cover changes and deletions save immediately. Setup fields use Save setup separately. Leaving editing does not undo saved photo changes. Unsaved queued files are lost if you leave."
              : "Photos are queued locally. Create setup saves your setup once, then uploads the queue. Completed uploads are retained if another file fails. Queued files are lost if you leave."}
          </p>
          <Button
            onClick={() => {
              trigger.current?.focus();
              setOpen(false);
            }}
          >
            Close photo information
          </Button>
        </div>
      )}
    </div>
  );
}
