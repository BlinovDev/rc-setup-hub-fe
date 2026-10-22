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
import { manufacturerLabel } from "../differential";
import type { SetupFormValues } from "./formSchema";

// Shared by catalog-backed component selectors; chassis keeps its model selector.
export function ManufacturerField({
  name,
  label,
  action,
  existing,
  savedId,
  display,
  displayLabel = "Manufacturer",
}: {
  name:
    | `runningGear.${"front" | "rear"}.${"wheel" | "tire"}.manufacturerId`
    | "frontSteeringKnuckle.manufacturerId"
    | "rearDifferential.manufacturerId"
    | `${"front" | "rear"}.lowerArmMount.manufacturerId`;
  label: string;
  action:
    | "differential"
    | "knuckle"
    | `${"front" | "rear"} lower arm mount`
    | `${"front" | "rear"} ${"wheel" | "tire"}`;
  existing: boolean;
  savedId?: string | null | undefined;
  display?:
    components["schemas"]["DifferentialManufacturer"] | null | undefined;
  displayLabel?: string;
}) {
  const id = useId();
  const { control, setValue, clearErrors, getFieldState, formState } =
    useFormContext<SetupFormValues>();
  const [choosing, setChoosing] = useState(!existing);
  const [previousSelection, setPreviousSelection] = useState(savedId ?? null);
  const brands = useQuery({ ...brandsOptions, enabled: choosing });
  const activeBrands = brands.isError ? [] : (brands.data ?? []);
  const selected = useWatch({ control, name });
  const error = getFieldState(name, formState).error;
  return (
    <div className="space-y-2">
      {!choosing ? (
        <>
          <p>
            {displayLabel}: {manufacturerLabel(selected, display)}
          </p>
          <Button
            type="button"
            onClick={() => {
              setPreviousSelection(selected);
              setChoosing(true);
            }}
          >
            Change {action} manufacturer
          </Button>
        </>
      ) : (
        <>
          <label htmlFor={id}>{label}</label>
          <Controller
            control={control}
            name={name}
            render={({ field }) => (
              <select
                {...field}
                id={id}
                value={field.value ?? ""}
                className="min-h-11 w-full rounded border p-2"
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(event) => field.onChange(event.target.value || null)}
              >
                <option value="">Not specified</option>
                {savedId &&
                  !activeBrands.some((brand) => brand.id === savedId) && (
                    <option value={savedId}>
                      {manufacturerLabel(savedId, display)} (current)
                    </option>
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
                Retry {action} manufacturers
              </Button>
            </div>
          )}
          {brands.isSuccess && brands.data.length === 0 && (
            <p>No active manufacturers available.</p>
          )}
          {existing && (
            <Button
              type="button"
              onClick={() => {
                setValue(name, previousSelection);
                clearErrors(name);
                setChoosing(false);
              }}
            >
              Cancel manufacturer change
            </Button>
          )}
        </>
      )}
      {error && (
        <InlineNotice tone="error" id={`${id}-error`}>
          {error.message}
        </InlineNotice>
      )}
    </div>
  );
}
