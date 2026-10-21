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
for (const side of ["front", "rear"] as const) {
  it.each([
    undefined,
    null,
    {},
    { manufacturer_id: null, model: null, configuration_notes: null },
  ])(`${side} legacy/null/empty mounts remain blank: %j`, (lower_arm_mount) => {
    const axle = lower_arm_mount === undefined ? {} : { lower_arm_mount };
    const values = setupToForm({
      ...testSetup,
      data: { suspension: { [side]: axle } },
    });
    expect(values[side].lowerArmMount).toEqual({
      manufacturerId: null,
      model: "",
      configurationNotes: "",
    });
    expect(serializeData(values)).toEqual({});
  });
  it.each([
    [{ manufacturerId: id }, { manufacturer_id: id }],
    [{ model: " Part #42 " }, { model: "Part #42" }],
    [
      { configurationNotes: " Inserts A\nMount B " },
      { configuration_notes: "Inserts A\nMount B" },
    ],
  ] as const)(
    `${side} supports independently optional %j`,
    (input, expected) => {
      const values = setupToForm();
      values.title = "Title";
      Object.assign(values[side].lowerArmMount, input);
      expect(setupFormSchema.safeParse(values).success).toBe(true);
      expect(serializeCreate(values).data).toEqual({
        suspension: { [side]: { lower_arm_mount: expected } },
      });
    },
  );
  it(`${side} round trips the complete document and clears only its mount`, () => {
    const mount = {
      manufacturer_id: id,
      model: "Part",
      configuration_notes: "Inserts A\nMount B",
    };
    const data: Schemas["SetupDataV1"] = {
      ...testSetup.data,
      rear_differential: {
        type: "lsd",
        manufacturer_id: id,
        model: "Diff",
        tuning_notes: "Diff notes",
      },
      suspension: {
        front: {
          ...testSetup.data.suspension?.front,
          lower_arm_mount: mount,
          top_arm_spacing: { front_mm: 0, rear_mm: 5.23456789 },
        },
        rear: { ...testSetup.data.suspension?.rear, lower_arm_mount: mount },
      },
      shocks: {
        ...testSetup.data.shocks,
        front: {
          ...testSetup.data.shocks?.front,
          piston: { holes: 6, hole_diameter_mm: 1.23456789, notes: "Piston" },
          seal: { type: "x-ring", description: "Seal" },
        },
      },
    };
    const values = setupToForm({ ...testSetup, data });
    values.title = "Title only";
    expect(serializePatch(values).data).toEqual(data);
    expect(serializeCreate(values).data).toEqual(data);
    expect(serializePatch(values)).not.toHaveProperty(
      "lower_arm_mount_manufacturers",
    );
    expect(serializePatch(values)).not.toHaveProperty("chassis_model_id");
    values[side].lowerArmMount = {
      manufacturerId: null,
      model: " ",
      configurationNotes: "\n ",
    };
    const expected = structuredClone(data);
    delete expected.suspension?.[side]?.lower_arm_mount;
    expect(serializeData(values)).toEqual(expected);
  });
  it(`${side} accepts Unicode boundaries and preserves nonnumeric free text`, () => {
    const values = setupToForm(testSetup);
    values[side].lowerArmMount = {
      manufacturerId: null,
      model: "😀".repeat(200),
      configurationNotes: "界".repeat(10000),
    };
    expect(setupFormSchema.safeParse(values).success).toBe(true);
    expect(serializeData(values).suspension?.[side]?.lower_arm_mount).toEqual({
      model: "😀".repeat(200),
      configuration_notes: "界".repeat(10000),
    });
  });
  it.each([
    { manufacturerId: "" },
    { manufacturerId: "bad" },
    { model: "😀".repeat(201) },
    { model: "bad\0text" },
    { configurationNotes: "界".repeat(10001) },
    { configurationNotes: "bad\0text" },
  ])(`${side} rejects invalid input %#`, (input) => {
    const values = setupToForm(testSetup);
    Object.assign(values[side].lowerArmMount, input);
    expect(setupFormSchema.safeParse(values).success).toBe(false);
  });
}
