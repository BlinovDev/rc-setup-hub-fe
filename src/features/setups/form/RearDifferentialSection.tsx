import { useId } from "react";
import { useFormContext } from "react-hook-form";
import type { components } from "../../../api/generated/schema";
import { Button } from "../../../shared/components/Button";
import { InlineNotice } from "../../../shared/components/Feedback";
import { differentialLabels, differentialTypes } from "../differential";
import type { SetupFormValues } from "./formSchema";
import { ManufacturerField } from "./ManufacturerField";
import { SetupField } from "./SetupField";

export function RearDifferentialSection({
  setup,
}: {
  setup: components["schemas"]["Setup"] | undefined;
}) {
  const id = useId();
  const { register, setValue, clearErrors, formState } =
    useFormContext<SetupFormValues>();
  const errors = formState.errors.rearDifferential;
  return (
    <fieldset
      id="setup-rear-differential"
      className="space-y-3 rounded border p-4"
    >
      <legend className="font-semibold">Rear differential</legend>
      <p>Optional. Describe the differential and its tuning independently.</p>
      <div>
        <label htmlFor={`${id}-type`}>Rear differential type</label>
        <select
          id={`${id}-type`}
          className="mt-1 min-h-11 w-full rounded border p-2"
          aria-invalid={!!errors?.type}
          aria-describedby={errors?.type ? `${id}-type-error` : undefined}
          {...register("rearDifferential.type")}
        >
          <option value="">Not specified</option>
          {differentialTypes.map((type) => (
            <option key={type} value={type}>
              {differentialLabels[type]}
            </option>
          ))}
        </select>
        {errors?.type && (
          <InlineNotice tone="error" id={`${id}-type-error`}>
            {errors.type.message}
          </InlineNotice>
        )}
      </div>
      <ManufacturerField
        name="rearDifferential.manufacturerId"
        label="Rear differential manufacturer"
        action="differential"
        existing={!!setup}
        savedId={setup?.data.rear_differential?.manufacturer_id}
        display={setup?.rear_differential_manufacturer}
      />
      <SetupField
        name="rearDifferential.model"
        label="Rear differential model"
      />
      <SetupField
        name="rearDifferential.tuningNotes"
        label="Rear differential tuning notes"
        multiline
      />
      <Button
        type="button"
        onClick={() => {
          setValue(
            "rearDifferential",
            { type: "", manufacturerId: null, model: "", tuningNotes: "" },
            { shouldDirty: true },
          );
          clearErrors("rearDifferential");
        }}
      >
        Clear rear differential
      </Button>
    </fieldset>
  );
}
