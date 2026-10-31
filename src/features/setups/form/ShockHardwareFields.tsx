import { useId } from "react";
import { useFormContext } from "react-hook-form";
import { InlineNotice } from "../../../shared/components/Feedback";
import type { SetupFormValues } from "./formSchema";
import { SetupField } from "./SetupField";

export function ShockHardwareFields({
  side,
}: {
  side: "frontShock" | "rearShock";
}) {
  const { register, getFieldState, formState } =
    useFormContext<SetupFormValues>();
  const label = side === "frontShock" ? "Front" : "Rear";
  const id = useId();
  const name = `${side}.sealType` as const;
  const error = getFieldState(name, formState).error;
  return (
    <>
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
      <div className="space-y-2">
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
      </div>
      <SetupField
        name={`${side}.sealDescription`}
        label={`${label} seal description`}
      />
    </>
  );
}
