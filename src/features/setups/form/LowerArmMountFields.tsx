import { useFormContext } from "react-hook-form";
import type { components } from "../../../api/generated/schema";
import { Button } from "../../../shared/components/Button";
import type { SetupFormValues } from "./formSchema";
import { ManufacturerField } from "./ManufacturerField";
import { SetupField } from "./SetupField";

export function LowerArmMountFields({
  side,
  setup,
}: {
  side: "front" | "rear";
  setup: components["schemas"]["Setup"] | undefined;
}) {
  const { setValue, clearErrors } = useFormContext<SetupFormValues>();
  const label = side === "front" ? "Front" : "Rear";
  const name = `${side}.lowerArmMount` as const;
  return (
    <fieldset className="space-y-3 rounded border p-3">
      <legend className="font-semibold">{label} lower arm mount</legend>
      <p>Optional. Describe one mount configuration for this axle.</p>
      <ManufacturerField
        name={`${name}.manufacturerId`}
        label={`${label} lower arm mount manufacturer`}
        action={`${side} lower arm mount`}
        existing={!!setup}
        savedId={
          setup?.data.suspension?.[side]?.lower_arm_mount?.manufacturer_id
        }
        display={setup?.lower_arm_mount_manufacturers?.[side]}
        displayLabel={`${label} lower arm mount manufacturer`}
      />
      <SetupField
        name={`${name}.model`}
        label={`${label} lower arm mount model / part number`}
      />
      <SetupField
        name={`${name}.configurationNotes`}
        label={`${label} lower arm mount configuration notes`}
        multiline
      />
      <Button
        type="button"
        onClick={() => {
          setValue(
            name,
            { manufacturerId: null, model: "", configurationNotes: "" },
            { shouldDirty: true },
          );
          clearErrors(name);
        }}
      >
        Clear {side} lower arm mount
      </Button>
    </fieldset>
  );
}
