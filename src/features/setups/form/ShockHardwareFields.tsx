import { useId } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "../../../shared/components/Button";
import { InlineNotice } from "../../../shared/components/Feedback";
import type { SetupFormValues } from "./formSchema";
import { SetupField } from "./SetupField";

export function ShockHardwareFields({
  side,
}: {
  side: "frontShock" | "rearShock";
}) {
  const { register, getFieldState, formState, setValue, clearErrors } =
    useFormContext<SetupFormValues>();
  const label = side === "frontShock" ? "Front" : "Rear";
  const id = useId();
  const name = `${side}.sealType` as const;
  const error = getFieldState(name, formState).error;
  return (
    <>
      <fieldset className="space-y-3 rounded border p-3">
        <legend>{label} shock piston (optional)</legend>
        <SetupField
          name={`${side}.pistonHoles`}
          label={`${label} piston hole count`}
          numeric
        />
        <SetupField
          name={`${side}.pistonDiameter`}
          label={`${label} piston hole diameter (mm)`}
          numeric
        />
        <SetupField
          name={`${side}.pistonNotes`}
          label={`${label} piston notes`}
          multiline
        />
        <Button
          type="button"
          onClick={() => {
            for (const key of [
              "pistonHoles",
              "pistonDiameter",
              "pistonNotes",
            ] as const) {
              setValue(`${side}.${key}`, "", { shouldDirty: true });
              clearErrors(`${side}.${key}`);
            }
          }}
        >
          Clear {label.toLowerCase()} piston
        </Button>
      </fieldset>
      <fieldset className="space-y-3 rounded border p-3">
        <legend>{label} shock seal (optional)</legend>
        <label className="block" htmlFor={id}>
          {label} seal type
        </label>
        <select
          id={id}
          className="min-h-11 w-full rounded border p-2"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...register(name)}
        >
          <option value="">Not specified</option>
          <option value="o-ring">O-ring</option>
          <option value="x-ring">X-ring</option>
        </select>
        {error && (
          <InlineNotice id={`${id}-error`} tone="error">
            {error.message}
          </InlineNotice>
        )}
        <SetupField
          name={`${side}.sealDescription`}
          label={`${label} seal description`}
        />
        <Button
          type="button"
          onClick={() => {
            setValue(name, "", { shouldDirty: true });
            setValue(`${side}.sealDescription`, "", { shouldDirty: true });
            clearErrors([name, `${side}.sealDescription`]);
          }}
        >
          Clear {label.toLowerCase()} seal
        </Button>
      </fieldset>
    </>
  );
}
