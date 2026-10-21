import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import type { components } from "../../../api/generated/schema";
import { Button } from "../../../shared/components/Button";
import {
  InlineNotice,
  LoadingState,
} from "../../../shared/components/Feedback";
import { brandsOptions } from "../../chassis/queries";
import {
  differentialLabels,
  differentialTypes,
  manufacturerLabel,
} from "../differential";
import type { SetupFormValues } from "./formSchema";
import { SetupField } from "./SetupField";

export function RearDifferentialSection({
  setup,
}: {
  setup: components["schemas"]["Setup"] | undefined;
}) {
  const id = useId();
  const { register, control, setValue, clearErrors, formState } =
    useFormContext<SetupFormValues>();
  const [choosing, setChoosing] = useState(!setup);
  const [previousSelection, setPreviousSelection] = useState(
    setup?.data.rear_differential?.manufacturer_id ?? null,
  );
  const brands = useQuery({ ...brandsOptions, enabled: choosing });
  const activeBrands = brands.isError ? [] : (brands.data ?? []);
  const selected = useWatch({
    control,
    name: "rearDifferential.manufacturerId",
  });
  const savedId = setup?.data.rear_differential?.manufacturer_id;
  const savedLabel = manufacturerLabel(
    savedId,
    setup?.rear_differential_manufacturer,
  );
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
      {!choosing ? (
        <div className="space-y-2">
          <p>
            Manufacturer:{" "}
            {manufacturerLabel(selected, setup?.rear_differential_manufacturer)}
          </p>
          <Button
            type="button"
            onClick={() => {
              setPreviousSelection(selected);
              setChoosing(true);
            }}
          >
            Change differential manufacturer
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`${id}-manufacturer`}>
            Rear differential manufacturer
          </label>
          <Controller
            control={control}
            name="rearDifferential.manufacturerId"
            render={({ field }) => (
              <select
                {...field}
                ref={field.ref}
                id={`${id}-manufacturer`}
                value={field.value ?? ""}
                className="min-h-11 w-full rounded border p-2"
                aria-invalid={!!errors?.manufacturerId}
                aria-describedby={
                  errors?.manufacturerId
                    ? `${id}-manufacturer-error`
                    : undefined
                }
                onChange={(event) => field.onChange(event.target.value || null)}
              >
                <option value="">Not specified</option>
                {savedId &&
                  !activeBrands.some((brand) => brand.id === savedId) && (
                    <option value={savedId}>{savedLabel} (current)</option>
                  )}
                {selected &&
                  selected !== savedId &&
                  !activeBrands.some((brand) => brand.id === selected) && (
                    <option value={selected}>
                      Selected manufacturer (catalog unavailable)
                    </option>
                  )}
                {activeBrands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            )}
          />
          {brands.isLoading && (
            <LoadingState>Loading manufacturers…</LoadingState>
          )}
          {brands.isError && (
            <div>
              <InlineNotice tone="error">
                Unable to load manufacturers. Your selection is retained.
              </InlineNotice>
              <Button
                type="button"
                disabled={brands.isFetching}
                onClick={() => void brands.refetch()}
              >
                Retry differential manufacturers
              </Button>
            </div>
          )}
          {brands.isSuccess && brands.data.length === 0 && (
            <p>No active manufacturers available.</p>
          )}
          {setup && (
            <Button
              type="button"
              onClick={() => {
                setValue("rearDifferential.manufacturerId", previousSelection);
                clearErrors("rearDifferential.manufacturerId");
                setChoosing(false);
              }}
            >
              Cancel manufacturer change
            </Button>
          )}
        </div>
      )}
      {errors?.manufacturerId && (
        <InlineNotice tone="error" id={`${id}-manufacturer-error`}>
          {errors.manufacturerId.message}
        </InlineNotice>
      )}
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
