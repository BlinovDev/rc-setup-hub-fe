import { ComponentCard } from "./ComponentCard";
import type { components } from "../../../api/generated/schema";
import { ManufacturerField } from "./ManufacturerField";
import { SetupField } from "./SetupField";

export function RunningGearSection({
  side,
  setup,
}: {
  side: "front" | "rear";
  setup?: components["schemas"]["Setup"] | undefined;
}) {
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
      <ComponentCard id={`${side}-hex`}>
        <fieldset className="space-y-3 rounded border p-3">
          <legend className="font-semibold">{label} hex</legend>
          <SetupField
            name={`${name}.hexOffset`}
            label={`${label} hex offset (mm)`}
            numeric
          />
        </fieldset>
      </ComponentCard>
      {(["wheel", "tire"] as const).map((part) => (
        <ComponentCard key={part} id={`${side}-${part}`}>
          <fieldset className="space-y-3 rounded border p-3">
            <legend className="font-semibold">
              {label} {part}
            </legend>
            <ManufacturerField
              name={`${name}.${part}.manufacturerId`}
              label={`${label} ${part} manufacturer`}
              action={`${side} ${part}`}
              existing={!!setup}
              savedId={
                setup?.data.running_gear?.[side]?.[part]?.manufacturer_id
              }
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
          </fieldset>
        </ComponentCard>
      ))}
    </fieldset>
  );
}
