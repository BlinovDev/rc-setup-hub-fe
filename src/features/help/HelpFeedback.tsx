import { useEffect, useId, useRef } from "react";
import { Button } from "../../shared/components/Button";
import { helpCopy } from "./copy";

export function HelpFeedback() {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const emailLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const dismiss = dialog.current?.close.bind(dialog.current);
    return () => dismiss?.();
  }, []);
  function close() {
    dialog.current?.close();
  }
  return (
    <>
      <Button
        ref={trigger}
        className="help-trigger"
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => {
          dialog.current?.showModal();
          closeButton.current?.focus();
        }}
      >
        {helpCopy.title}
      </Button>
      <dialog
        ref={dialog}
        id={id}
        className="help-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onCancel={(event) => {
          event.stopPropagation();
          event.preventDefault();
          close();
        }}
        onClose={(event) => {
          // React dialog events bubble; leave the containing account menu open.
          event.stopPropagation();
          if (trigger.current?.isConnected) trigger.current.focus();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            close();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const active = document.activeElement;
          const next = event.shiftKey
            ? active === closeButton.current
              ? emailLink.current
              : closeButton.current
            : active === emailLink.current
              ? closeButton.current
              : emailLink.current;
          // Own both transitions so nested native dialogs behave the same in Safari.
          event.preventDefault();
          next?.focus();
        }}
      >
        <div className="help-heading">
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            {helpCopy.title}
          </h2>
          <Button ref={closeButton} onClick={close}>
            {helpCopy.close}
          </Button>
        </div>
        <p id={`${id}-description`}>{helpCopy.description}</p>
        <p className="help-email">{helpCopy.email}</p>
        <a
          ref={emailLink}
          className="help-email-action"
          href={`mailto:${helpCopy.email}`}
        >
          {helpCopy.send}
        </a>
      </dialog>
    </>
  );
}
