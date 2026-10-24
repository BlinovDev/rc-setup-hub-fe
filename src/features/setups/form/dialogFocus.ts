import type { KeyboardEvent } from "react";
// Explicit boundaries complement native modal inertness; some browser versions
// otherwise place focus on the document between the last and first controls.
export function trapDialogTab(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const controls = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
    ),
  ).filter((el) => !el.closest("[hidden]"));
  const first = controls[0],
    last = controls.at(-1),
    active = document.activeElement;
  if (!first || !last) return;
  if (
    event.shiftKey &&
    (active === first || !event.currentTarget.contains(active))
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (active === last || !event.currentTarget.contains(active))
  ) {
    event.preventDefault();
    first.focus();
  }
}
