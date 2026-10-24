import { useEffect, useRef, type RefObject } from "react";
import { useBlocker } from "react-router";
import { Button } from "../../../shared/components/Button";
export function DraftGuard({
  dirty,
  allowExit,
}: {
  dirty: boolean;
  allowExit: RefObject<boolean>;
}) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !allowExit.current &&
      nextLocation.pathname !== "/login" &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (blocker.state === "blocked" && !dialog.current?.open) {
      opener.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    }
    if (blocker.state !== "blocked" && dialog.current?.open)
      dialog.current.close();
  }, [blocker.state]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!allowExit.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, allowExit]);
  const cancel = () => {
    if (blocker.state === "blocked") blocker.reset();
  };
  return (
    <dialog
      ref={dialog}
      className="draft-dialog"
      aria-labelledby="draft-exit-title"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      onClose={() => opener.current?.focus()}
    >
      <h2 id="draft-exit-title">Leave unsaved changes?</h2>
      <p>
        Unsaved setup fields and queued photos will be lost. Already saved photo
        changes are retained.
      </p>
      <Button type="button" autoFocus onClick={cancel}>
        Keep editing
      </Button>
      <Button
        type="button"
        variant="danger"
        onClick={() => {
          if (blocker.state === "blocked") blocker.proceed();
        }}
      >
        Discard draft and leave
      </Button>
    </dialog>
  );
}
