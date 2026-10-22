import type { components } from "../../../api/generated/schema";
import { LowerArmMountFields } from "./LowerArmMountFields";
import { Button } from "../../../shared/components/Button";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import type { SetupFormValues } from "./formSchema";
import { SetupField } from "./SetupField";

export function SuspensionSection({
  side,
  setup,
}: {
  side: "front" | "rear";
  setup?: components["schemas"]["Setup"] | undefined;
}) {
  const { control, setValue, clearErrors } = useFormContext<SetupFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${side}.link_lengths`,
  });
  const spacing = useWatch({ control, name: side });
  const label = side === "front" ? "Front" : "Rear";
  return (
    <fieldset id={`setup-${side}`} className="space-y-3 rounded border p-4">
      <legend className="font-semibold">{label} suspension</legend>
      <SetupField
        name={`${side}.camber_deg`}
        label={`${label} camber (degrees)`}
        numeric
      />
      <SetupField
        name={`${side}.caster_deg`}
        label={`${label} caster (degrees)`}
        numeric
      />
      <SetupField
        name={`${side}.toe_deg`}
        label={`${label} toe (degrees)`}
        numeric
      />
      <LowerArmMountFields side={side} setup={setup} />
      <p>
        Arm spacers are totals ahead of and behind an arm, relative to vehicle
        direction. The same totals apply on both left and right sides.
      </p>
      {(["top_arm_spacing", "lower_arm_spacing"] as const).map((arm) => {
        const armLabel = arm === "top_arm_spacing" ? "top" : "lower";
        const name = `${side}.${arm}` as const;
        return spacing[arm] ? (
          <fieldset key={arm} className="min-w-0 space-y-2 rounded border p-3">
            <legend className="font-semibold">
              {label} {armLabel} arm spacing
            </legend>
            <SetupField
              name={`${name}.front_mm`}
              label={`${label} ${armLabel} arm — Front spacers (mm)`}
              numeric
            />
            <SetupField
              name={`${name}.rear_mm`}
              label={`${label} ${armLabel} arm — Rear spacers (mm)`}
              numeric
            />
            <Button
              type="button"
              onClick={() => {
                setValue(name, undefined, { shouldDirty: true });
                clearErrors(name);
              }}
            >
              Remove {label.toLowerCase()} {armLabel} arm spacing
            </Button>
          </fieldset>
        ) : (
          <Button
            key={arm}
            type="button"
            onClick={() =>
              setValue(
                name,
                { front_mm: "", rear_mm: "" },
                { shouldDirty: true },
              )
            }
          >
            Add {armLabel} arm spacing — {label.toLowerCase()} suspension
          </Button>
        );
      })}
      <h3>{label} link lengths</h3>
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-2 rounded border p-3">
          <h4 className="font-semibold">Link {index + 1}</h4>
          <SetupField
            name={`${side}.link_lengths.${index}.name`}
            label={`${label} link ${index + 1} name`}
          />
          <SetupField
            name={`${side}.link_lengths.${index}.length_mm`}
            label={`${label} link ${index + 1} length (mm)`}
            numeric
          />
          <Button type="button" onClick={() => remove(index)}>
            Remove {label.toLowerCase()} link {index + 1}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        disabled={fields.length >= 100}
        onClick={() => append({ name: "", length_mm: "" })}
      >
        Add {label.toLowerCase()} link
      </Button>
    </fieldset>
  );
}
