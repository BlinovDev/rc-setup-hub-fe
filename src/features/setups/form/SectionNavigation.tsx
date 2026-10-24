import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { sections, type SectionId } from "./presentation";
export function SectionNavigation({
  active,
  select,
  counts,
}: {
  active: SectionId;
  select: (id: SectionId) => void;
  counts: Partial<Record<SectionId, number>>;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const destination = useRef<SectionId | null>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 768px)");
    const resize = () => {
      if (media?.matches) setOpen(false);
    };
    media?.addEventListener("change", resize);
    return () => media?.removeEventListener("change", resize);
  }, []);
  const links = () =>
    sections.map(([key, label]) => (
      <Button
        key={key}
        type="button"
        aria-current={active === key ? "location" : undefined}
        onClick={() => {
          if (open) {
            destination.current = key;
            setOpen(false);
          } else select(key);
        }}
      >
        {label}
        {counts[key] ? <span> · {counts[key]} errors</span> : null}
      </Button>
    ));
  return (
    <>
      <Button
        ref={trigger}
        className="sections-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
      >
        Sections · {sections.find(([key]) => key === active)?.[1]}
      </Button>
      <nav className="section-sidebar" aria-label="Setup sections">
        {links()}
      </nav>
      <dialog
        ref={dialog}
        id={id}
        className="sections-sheet"
        aria-labelledby={id + "-title"}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClose={() => {
          setOpen(false);
          if (destination.current) {
            const next = destination.current;
            destination.current = null;
            select(next);
          } else trigger.current?.focus();
        }}
      >
        <div className="sheet-heading">
          <h2 id={id + "-title"}>Setup sections</h2>
          <Button type="button" autoFocus onClick={() => setOpen(false)}>
            Close sections
          </Button>
        </div>
        <nav aria-label="Choose setup section">{links()}</nav>
      </dialog>
    </>
  );
}
