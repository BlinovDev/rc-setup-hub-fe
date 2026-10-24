import type { components } from "../../../api/generated/schema";
import { ManufacturerField } from "./ManufacturerField";
import { SetupField } from "./SetupField";

export function FrontSteeringKnuckleSection({
  setup,
}: {
  setup: components["schemas"]["Setup"] | undefined;
}) {
  return (
    <fieldset id="setup-front-knuckle" className="space-y-3 rounded border p-4">
      <legend className="font-semibold">Front steering knuckle</legend>
      <p>
        Optional. Record the manufacturer and part number or description
        independently.
      </p>
      <ManufacturerField
        name="frontSteeringKnuckle.manufacturerId"
        label="Front knuckle manufacturer"
        action="knuckle"
        existing={!!setup}
        savedId={setup?.data.front_steering_knuckle?.manufacturer_id}
        display={setup?.front_steering_knuckle_manufacturer}
        displayLabel="Front knuckle manufacturer"
      />
      <SetupField
        name="frontSteeringKnuckle.description"
        label="Front knuckle part number / description"
        multiline
      />
    </fieldset>
  );
}
