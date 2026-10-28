import { useId, useRef, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "../../../shared/components/Button";
import { InlineNotice } from "../../../shared/components/Feedback";
import { standardLinks, type SuspensionSide } from "../suspensionLinks";
import type { SetupFormValues } from "./formSchema";
import { SetupField } from "./SetupField";
import { hasValue } from "./presentation";
export function LinkLengthFields({ side }: { side: SuspensionSide }) {
  const { control, getValues, getFieldState, formState } =
    useFormContext<SetupFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${side}.link_lengths`,
  });
  const label = side === "front" ? "Front" : "Rear",
    id = useId();
  const aggregate = getFieldState(`${side}.link_lengths`, formState).error;
  const [confirm, setConfirm] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null),
    add = useRef<HTMLButtonElement | null>(null);
  const removal = (index: number) => (
    <>
      {confirm === fields[index]!.id && (
        <div
          role="group"
          className="inline-confirmation"
          aria-label={`Remove ${side} link ${index + 1}?`}
        >
          <Button
            autoFocus
            onClick={() => {
              setConfirm(null);
              opener.current?.focus();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              remove(index);
              setConfirm(null);
              requestAnimationFrame(() => add.current?.focus());
            }}
          >
            Confirm remove {side} link {index + 1}
          </Button>
        </div>
      )}
      <Button
        onClick={(event) => {
          if (hasValue(getValues(`${side}.link_lengths.${index}`))) {
            opener.current = event.currentTarget;
            setConfirm(fields[index]!.id);
          } else remove(index);
        }}
      >
        Remove {side} link {index + 1}
      </Button>
    </>
  );
  return (
    <div className="space-y-3">
      <div className="related-fields">
        {standardLinks(side).map((standard) => (
          <SetupField
            key={standard.field}
            name={`${side}.${standard.field}`}
            label={`${label} ${standard.label} length (mm)`}
            numeric
          />
        ))}
      </div>
      <p>Additional custom links</p>
      {aggregate?.message && (
        <InlineNotice tone="error" id={`${id}-error`}>
          {aggregate.message}
        </InlineNotice>
      )}
      {fields.map((field, index) =>
        field.legacyStandard ? null : (
          <div key={field.id} className="space-y-2 rounded border p-3">
            <h4>Custom link {index + 1}</h4>
            <SetupField
              name={`${side}.link_lengths.${index}.name`}
              label={`${label} link ${index + 1} name`}
            />
            <SetupField
              name={`${side}.link_lengths.${index}.length_mm`}
              label={`${label} link ${index + 1} length (mm)`}
              numeric
            />
            {removal(index)}
          </div>
        ),
      )}
      <Button
        ref={add}
        data-error-path={`${side}.link_lengths`}
        aria-invalid={!!aggregate?.message}
        aria-describedby={aggregate?.message ? `${id}-error` : undefined}
        onClick={() => append({ name: "", length_mm: "" })}
      >
        Add {side} link
      </Button>
    </div>
  );
}
