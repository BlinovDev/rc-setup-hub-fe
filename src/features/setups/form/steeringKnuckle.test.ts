import type { components } from "../../../api/generated/schema";
import { expect, it } from "vitest";
import { testSetup } from "../testFixtures";
import { setupFormSchema } from "./formSchema";
import {
  serializeCreate,
  serializeData,
  serializePatch,
  setupToForm,
} from "./serialization";
type Schemas = components["schemas"];
const id = testSetup.chassis.brand_id;
it.each([undefined, null, {}, { manufacturer_id: null, description: null }])(
  "hydrates legacy/null/empty knuckles without defaults: %j",
  (knuckle) => {
    const setup: Schemas["Setup"] = {
      ...testSetup,
      data: knuckle === undefined ? {} : { front_steering_knuckle: knuckle },
    };
    const values = setupToForm(setup);
    expect(values.frontSteeringKnuckle).toEqual({
      manufacturerId: null,
      description: "",
    });
    expect(serializeData(values)).toEqual({});
  },
);
it.each([
  [{ manufacturerId: id }, { manufacturer_id: id }],
  [
    { description: " Part #42\nAluminum " },
    { description: "Part #42\nAluminum" },
  ],
  [
    { manufacturerId: id, description: "Part" },
    { manufacturer_id: id, description: "Part" },
  ],
] as const)(
  "serializes independent optional knuckle fields: %j",
  (input, expected) => {
    const values = setupToForm();
    values.title = "Title";
    Object.assign(values.frontSteeringKnuckle, input);
    expect(setupFormSchema.safeParse(values).success).toBe(true);
    expect(serializeCreate(values).data).toEqual({
      front_steering_knuckle: expected,
    });
  },
);
it("preserves complete data, zero and decimal precision on title-only edits and clears only the knuckle", () => {
  const data: Schemas["SetupDataV1"] = {
    ...testSetup.data,
    rear_differential: {
      type: "lsd",
      manufacturer_id: id,
      model: "Diff",
      tuning_notes: "Tuning",
    },
    shocks: {
      ...testSetup.data.shocks,
      front: {
        ...testSetup.data.shocks?.front,
        piston: { holes: 6, hole_diameter_mm: 1.23456789, notes: "Piston" },
        seal: { type: "x-ring", description: "Seal" },
      },
    },
    front_steering_knuckle: { manufacturer_id: id, description: "Part" },
  };
  const values = setupToForm({ ...testSetup, data });
  values.title = "Title only";
  expect(serializePatch(values).data).toEqual(data);
  expect(serializeCreate(values).data).toEqual(data);
  expect(serializePatch(values)).not.toHaveProperty("chassis_model_id");
  expect(serializePatch(values)).not.toHaveProperty(
    "front_steering_knuckle_manufacturer",
  );
  values.frontSteeringKnuckle = { manufacturerId: null, description: " \n " };
  const { front_steering_knuckle: removed, ...others } = data;
  expect(removed).toBeDefined();
  expect(serializeData(values)).toEqual(others);
});
it("accepts 200 Unicode codepoints without rounding/reinterpreting descriptions", () => {
  const values = setupToForm(testSetup);
  values.frontSteeringKnuckle.description = "😀".repeat(200);
  expect(setupFormSchema.safeParse(values).success).toBe(true);
  expect(serializeData(values).front_steering_knuckle?.description).toBe(
    "😀".repeat(200),
  );
});
it.each([
  { manufacturerId: "" },
  { manufacturerId: "bad" },
  { description: "😀".repeat(201) },
  { description: "bad\0text" },
])("rejects invalid knuckle values %#", (input) => {
  const values = setupToForm(testSetup);
  Object.assign(values.frontSteeringKnuckle, input);
  expect(setupFormSchema.safeParse(values).success).toBe(false);
});
