import { useFieldArray, useFormContext } from "react-hook-form";
import type { SetupFormValues } from "./formSchema";
import { SetupField } from "./SetupField";

export function SuspensionSection({ side }: { side: "front" | "rear" }) {
  const { control } = useFormContext<SetupFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${side}.link_lengths`,
  });
  const label = side === "front" ? "Front" : "Rear";
  return (
    <fieldset className="space-y-3 rounded border p-4">
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
      <h3>{label} link lengths</h3>
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-2 rounded border p-3">
          <SetupField
            name={`${side}.link_lengths.${index}.name`}
            label={`${label} link ${index + 1} name`}
          />
          <SetupField
            name={`${side}.link_lengths.${index}.length_mm`}
            label={`${label} link ${index + 1} length (mm)`}
            numeric
          />
          <button type="button" onClick={() => remove(index)}>
            Remove {label.toLowerCase()} link {index + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={fields.length >= 100}
        onClick={() => append({ name: "", length_mm: "" })}
      >
        Add {label.toLowerCase()} link
      </button>
    </fieldset>
  );
}
