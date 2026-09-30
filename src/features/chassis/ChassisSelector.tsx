import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChassisError } from "./api";
import { brandsOptions, modelsOptions } from "./queries";
import type { ChassisSelection } from "./selection";

export function ChassisSelector({
  value,
  onChange,
}: {
  value: ChassisSelection;
  onChange: (value: ChassisSelection) => void;
}) {
  const id = useId();
  const brands = useQuery(brandsOptions);
  const models = useQuery(modelsOptions(value.brandId));
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">Chassis</legend>
      <label className="block" htmlFor={`${id}-brand`}>
        Brand
      </label>
      <select
        id={`${id}-brand`}
        className="min-h-11 w-full rounded border p-2"
        value={value.brandId ?? ""}
        onChange={(event) =>
          onChange({ brandId: event.target.value || null, modelId: null })
        }
      >
        <option value="">Custom / not listed</option>
        {!brands.isError &&
          brands.data?.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
      </select>
      {brands.isPending && <LoadingState>Loading brands…</LoadingState>}
      {brands.isError && (
        <div>
          <InlineNotice tone="error">Unable to load brands.</InlineNotice>
          <Button
            type="button"
            disabled={brands.isFetching}
            onClick={() => void brands.refetch()}
          >
            Retry brands
          </Button>
        </div>
      )}
      {brands.isSuccess && brands.data.length === 0 && (
        <p>No active brands available.</p>
      )}
      {value.brandId !== null && (
        <>
          <label className="block" htmlFor={`${id}-model`}>
            Model
          </label>
          <select
            id={`${id}-model`}
            className="min-h-11 w-full rounded border p-2"
            value={value.modelId ?? ""}
            disabled={
              models.isPending || models.isError || !models.data?.length
            }
            onChange={(event) =>
              onChange({
                brandId: value.brandId,
                modelId: event.target.value || null,
              })
            }
          >
            <option value="">Select a model</option>
            {!models.isError &&
              models.data?.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
          </select>
          {models.isPending && <LoadingState>Loading models…</LoadingState>}
          {models.isError && (
            <div>
              <InlineNotice tone="error">
                {models.error instanceof ChassisError &&
                models.error.status === 404
                  ? "This brand is no longer available. Choose another brand or retry."
                  : "Unable to load models."}
              </InlineNotice>
              <Button
                type="button"
                disabled={models.isFetching}
                onClick={() => void models.refetch()}
              >
                Retry models
              </Button>
            </div>
          )}
          {models.isSuccess && models.data.length === 0 && (
            <p>No active models for this brand.</p>
          )}
        </>
      )}
    </fieldset>
  );
}
