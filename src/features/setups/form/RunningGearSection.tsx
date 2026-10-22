import { useFormContext } from "react-hook-form";
import type { components } from "../../../api/generated/schema";
import { Button } from "../../../shared/components/Button";
import type { SetupFormValues } from "./formSchema";
import { ManufacturerField } from "./ManufacturerField";
import { SetupField } from "./SetupField";

export function RunningGearSection({
  side,
  setup,
}: {
  side: "front" | "rear";
  setup?: components["schemas"]["Setup"] | undefined;
}) {
  const { setValue, clearErrors } = useFormContext<SetupFormValues>();
  const label = side === "front" ? "Front" : "Rear";
  const name = `runningGear.${side}` as const;
  return (
    <fieldset
      id={`setup-${side}-running-gear`}
      className="space-y-4 rounded border p-4"
    >
      <legend className="font-semibold">{label} hex, wheel and tire</legend>
      <p>
        All fields are optional. Hex and wheel offsets are separate
        measurements.
      </p>
      <fieldset className="space-y-3 rounded border p-3">
        <legend className="font-semibold">{label} hex</legend>
        <SetupField
          name={`${name}.hexOffset`}
          label={`${label} hex offset (mm)`}
          numeric
        />
        <Button
          type="button"
          onClick={() => {
            setValue(`${name}.hexOffset`, "", { shouldDirty: true });
            clearErrors(`${name}.hexOffset`);
          }}
        >
          Clear {side} hex
        </Button>
      </fieldset>
      {(["wheel", "tire"] as const).map((part) => (
        <fieldset key={part} className="space-y-3 rounded border p-3">
          <legend className="font-semibold">
            {label} {part}
          </legend>
          <ManufacturerField
            name={`${name}.${part}.manufacturerId`}
            label={`${label} ${part} manufacturer`}
            action={`${side} ${part}`}
            existing={!!setup}
            savedId={setup?.data.running_gear?.[side]?.[part]?.manufacturer_id}
            display={setup?.running_gear_manufacturers?.[side]?.[part]}
            displayLabel={`${label} ${part} manufacturer`}
          />
          <SetupField
            name={`${name}.${part}.model`}
            label={`${label} ${part} model`}
          />
          {part === "wheel" && (
            <SetupField
              name={`${name}.wheel.offset`}
              label={`${label} wheel offset (mm)`}
              numeric
            />
          )}
          <Button
            type="button"
            onClick={() => {
              if (part === "wheel")
                setValue(
                  `${name}.wheel`,
                  { manufacturerId: null, model: "", offset: "" },
                  { shouldDirty: true },
                );
              else
                setValue(
                  `${name}.tire`,
                  { manufacturerId: null, model: "" },
                  { shouldDirty: true },
                );
              clearErrors(`${name}.${part}`);
            }}
          >
            Clear {side} {part}
          </Button>
        </fieldset>
      ))}
    </fieldset>
  );
}
