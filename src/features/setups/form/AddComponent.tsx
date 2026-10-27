import { Chevron } from "../../../shared/components/Chevron";
import { useId, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "../../../shared/components/Button";
import {
  componentSpecs,
  hasValue,
  valueAt,
  type SectionId,
} from "./presentation";
import { useEditorPresentation } from "./editorPresentation";
import type { SetupFormValues } from "./formSchema";

export function AddComponent({ section }: { section: SectionId }) {
  const { control, getValues, setValue } = useFormContext<SetupFormValues>();
  useWatch({ control });
  const presentation = useEditorPresentation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const values = getValues();
  const available = componentSpecs.filter(
    (spec) =>
      spec.section === section &&
      spec.id !== "notes" &&
      !spec.id.endsWith("-links") &&
      !presentation.added[spec.id] &&
      !spec.paths.some((path) => hasValue(valueAt(values, path))),
  );
  return (
    <div
      className="add-component-chooser"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <Button
        ref={trigger}
        type="button"
        data-add-section={section}
        title={
          !available.length
            ? "All components in this section are already added"
            : undefined
        }
        aria-expanded={open}
        aria-controls={id}
        disabled={!available.length}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">+ </span>Add component
        <Chevron className="add-component-chevron" up={open} />
      </Button>
      <div
        hidden={!open}
        id={id}
        role="group"
        aria-label="Available components"
        className="available-components"
      >
        {available.map((spec) => (
          <Button
            key={spec.id}
            type="button"
            onClick={() => {
              if (spec.id.endsWith("-spacing") && !getValues(spec.paths[0]!))
                setValue(spec.paths[0]!, {
                  front_mm: "",
                  rear_mm: "",
                } as never);
              presentation.setAdded(spec.id, true);
              presentation.setOpen(spec.id, true);
              setOpen(false);
            }}
          >
            {spec.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
