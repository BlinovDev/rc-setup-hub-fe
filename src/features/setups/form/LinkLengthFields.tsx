import { useId, useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Button } from "../../../shared/components/Button";
import { InlineNotice } from "../../../shared/components/Feedback";
import {
  standardLinks,
  standardLinkIndices,
  type SuspensionSide,
} from "../suspensionLinks";
import type { SetupFormValues } from "./formSchema";
import { SetupField } from "./SetupField";
import { hasValue } from "./presentation";
export function LinkLengthFields({ side }: { side: SuspensionSide }) {
  const { control, register, getValues, getFieldState, formState } =
    useFormContext<SetupFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${side}.link_lengths`,
  });
  const values = useWatch({ control, name: `${side}.link_lengths` });
  const indices = standardLinkIndices(fields, side),
    used = new Set(indices.values());
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
      <p>
        Lengths are optional. Named links with a blank length stay Not
        specified. Saved names and extra links are retained.
      </p>
      {aggregate?.message && (
        <InlineNotice tone="error" id={`${id}-error`}>
          {aggregate.message}
        </InlineNotice>
      )}
      {standardLinks(side).map((standard) => {
        const index = indices.get(standard.name);
        const path =
          index === undefined
            ? undefined
            : (`${side}.link_lengths.${index}.length_mm` as const);
        const error = path ? getFieldState(path, formState).error : undefined;
        return (
          <div key={standard.name} className="space-y-2 rounded border p-3">
            <label htmlFor={`${id}-${standard.name}`}>
              {label} {standard.label} length (mm)
            </label>
            <input
              id={`${id}-${standard.name}`}
              className="mt-1 min-h-11 w-full rounded border p-2"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={
                index === undefined ? "" : (values[index]?.length_mm ?? "")
              }
              {...(path
                ? register(path)
                : {
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                      append(
                        { name: standard.name, length_mm: event.target.value },
                        { shouldFocus: false },
                      ),
                  })}
              aria-invalid={!!error}
              aria-describedby={
                error ? `${id}-${standard.name}-error` : undefined
              }
            />
            {error && (
              <InlineNotice id={`${id}-${standard.name}-error`} tone="error">
                {error.message}
              </InlineNotice>
            )}
            {index !== undefined && (
              <>
                <details>
                  <summary className="min-h-11 cursor-pointer break-words py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-700">
                    Saved link name: {values[index]?.name}
                  </summary>
                  <SetupField
                    name={`${side}.link_lengths.${index}.name`}
                    label={`${label} link ${index + 1} name`}
                  />
                  <p>
                    Names are preserved as entered. Renamed links are matched
                    again when you reopen the setup.
                  </p>
                </details>
                {removal(index)}
              </>
            )}
          </div>
        );
      })}
      {fields.map((field, index) =>
        used.has(index) ? null : (
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
