import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Button } from "./Button";

// Native modal dialogs provide background inertness, focus trapping and Escape.
export function NavigationDrawer({
  id,
  open,
  onClose,
  triggerRef,
  identity,
  children,
  footer,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  identity: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const desktop = window.matchMedia?.("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop?.matches) onClose();
    };
    desktop?.addEventListener("change", closeOnDesktop);
    return () => desktop?.removeEventListener("change", closeOnDesktop);
  }, [onClose]);
  return (
    <dialog
      ref={dialogRef}
      id={id}
      className="navigation-drawer"
      aria-label="Account and navigation"
      onCancel={onClose}
      onClose={() => {
        onClose();
        triggerRef.current?.focus();
      }}
    >
      {open && (
        <div className="drawer-content">
          <div className="drawer-heading">
            {identity}
            <Button autoFocus onClick={onClose} aria-label="Close account menu">
              Close
            </Button>
          </div>
          <div className="drawer-navigation">{children}</div>
          <div className="drawer-footer">{footer}</div>
        </div>
      )}
    </dialog>
  );
}
