import { useRef, useState, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "../../../shared/components/Button";
import { componentSpecs, hasValue, valueAt } from "./presentation";
import { setupToForm } from "./serialization";
import type { SetupFormValues } from "./formSchema";
import { useEditorPresentation } from "./editorPresentation";

export function ComponentCard({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const spec = componentSpecs.find((component) => component.id === id)!;
  const {
    control,
    getValues,
    setValue,
    clearErrors,
    getFieldState,
    formState,
  } = useFormContext<SetupFormValues>();
  useWatch({ control, name: spec.paths });
  const { removeIssues } = useEditorPresentation();
  const [confirm, setConfirm] = useState(false);
  const removeButton = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLElement>(null);
  const configured = spec.paths.some((path) =>
    hasValue(valueAt(getValues(), path)),
  );
  const dirty = spec.paths.some(
    (path) => getFieldState(path, formState).isDirty,
  );

  function clear() {
    const defaults = setupToForm();
    const clearValue = (path: string, current: unknown) => {
      if (current && typeof current === "object") {
        for (const [key, child] of Object.entries(current))
          clearValue(`${path}.${key}`, child);
        return;
      }
      const initial = valueAt(defaults, path);
      setValue(
        path as never,
        (initial === undefined && typeof current === "string"
          ? ""
          : initial) as never,
        {
          shouldDirty: true,
        },
      );
      clearErrors(path as never);
    };
    for (const path of spec.paths) {
      clearValue(path, valueAt(getValues(), path));
    }
    removeIssues(spec.paths);
    setConfirm(false);
    requestAnimationFrame(() =>
      container.current
        ?.querySelector<HTMLElement>(
          'input:not([type="hidden"]), textarea, select, button',
        )
        ?.focus(),
    );
  }

  return (
    <section
      ref={container}
      className="component-card"
      aria-label={spec.label}
      data-component={id}
    >
      {configured && (
        <Button
          ref={removeButton}
          type="button"
          className="component-remove-icon"
          aria-label={`Remove ${spec.label}`}
          title={`Remove ${spec.label}`}
          onClick={() => setConfirm(true)}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Button>
      )}
      {confirm && (
        <div
          role="group"
          aria-label={`Remove ${spec.label}?`}
          className="inline-confirmation"
        >
          <p>Clear only {spec.label}? Save setup to persist this removal.</p>
          <Button
            type="button"
            autoFocus
            onClick={() => {
              setConfirm(false);
              requestAnimationFrame(() => removeButton.current?.focus());
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="subdued-destructive"
            onClick={clear}
          >
            Confirm remove {spec.label}
          </Button>
        </div>
      )}
      {dirty && <p className="component-status">Unsaved changes</p>}
      {children}
    </section>
  );
}
