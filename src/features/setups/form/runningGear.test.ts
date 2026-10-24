import { expect, it } from "vitest";
import type { components } from "../../../api/generated/schema";
import { testSetup } from "../testFixtures";
import { parseWheelOffset, setupFormSchema } from "./formSchema";
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
    { hex: null, wheel: null, tire: null },
    {
      hex: { offset_mm: null },
      wheel: { manufacturer_id: null, model: null, offset_mm: null },
      tire: { manufacturer_id: null, model: null },
    },
  ])(`${side} legacy and empty gear %j`, (gear) => {
    const values = setupToForm({
      ...testSetup,
      data: { running_gear: { [side]: gear } },
    });
    expect(values.runningGear[side]).toEqual({
      hexOffset: "",
      wheel: { manufacturerId: null, model: "", offset: "" },
      tire: { manufacturerId: null, model: "" },
    });
    expect(serializeData(values)).toEqual({});
  });
  it.each([
    ["hexOffset", "-2,123456789", { hex: { offset_mm: -2.123456789 } }],
    ["hexOffset", "0", { hex: { offset_mm: 0 } }],
    ["wheel.offset", "0", { wheel: { offset_mm: 0 } }],
    ["wheel.offset", "-2147483648", { wheel: { offset_mm: -2147483648 } }],
    ["wheel.offset", "2147483647", { wheel: { offset_mm: 2147483647 } }],
    ["wheel.model", " Wheel ", { wheel: { model: "Wheel" } }],
    ["tire.model", " Tire ", { tire: { model: "Tire" } }],
    ["wheel.manufacturerId", id, { wheel: { manufacturer_id: id } }],
    ["tire.manufacturerId", id, { tire: { manufacturer_id: id } }],
  ] as const)(`${side} independently optional %s`, (path, value, expected) => {
    const values = setupToForm();
    values.title = "Gear";
    const gear = values.runningGear[side];
    if (path === "hexOffset") gear.hexOffset = value;
    else if (path === "wheel.offset") gear.wheel.offset = value;
    else if (path === "wheel.model") gear.wheel.model = value;
    else if (path === "tire.model") gear.tire.model = value;
    else if (path === "wheel.manufacturerId") gear.wheel.manufacturerId = value;
    else gear.tire.manufacturerId = value;
    expect(setupFormSchema.safeParse(values).success).toBe(true);
    expect(serializeCreate(values).data).toEqual({
      running_gear: { [side]: expected },
    });
  });
  it.each([
    "1.5",
    "1,5",
    "2147483648",
    "-2147483649",
    "NaN",
    "Infinity",
    "1e2",
    "0x10",
    "--1",
  ])(`${side} invalid wheel offset %s`, (value) => {
    const values = setupToForm(testSetup);
    values.runningGear[side].wheel.offset = value;
    expect(setupFormSchema.safeParse(values).success).toBe(false);
    expect(() => serializeData(values)).toThrow();
  });
  it.each(["NaN", "Infinity", "1e400", "1,2.3", "--1"])(
    `${side} invalid hex offset %s`,
    (value) => {
      const values = setupToForm(testSetup);
      values.runningGear[side].hexOffset = value;
      expect(setupFormSchema.safeParse(values).success).toBe(false);
      expect(() => serializeData(values)).toThrow();
    },
  );
  for (const part of ["wheel", "tire"] as const) {
    it(`${side} ${part} Unicode bounds, NUL and manufacturer validation`, () => {
      const values = setupToForm(testSetup);
      values.runningGear[side][part].model = "😀".repeat(200);
      expect(setupFormSchema.safeParse(values).success).toBe(true);
      for (const invalid of ["😀".repeat(201), "bad\0text"]) {
        values.runningGear[side][part].model = invalid;
        expect(setupFormSchema.safeParse(values).success).toBe(false);
      }
      values.runningGear[side][part].model = "";
      values.runningGear[side][part].manufacturerId = "bad";
      expect(setupFormSchema.safeParse(values).success).toBe(false);
    });
  }
}
it("round trips full data, retains zero/precision and clears each component independently", () => {
  const data: Schemas["SetupDataV1"] = {
    ...testSetup.data,
    front_steering_knuckle: { manufacturer_id: id, description: "Knuckle" },
    rear_differential: { type: "gear", tuning_notes: "Oil\nGears" },
    suspension: {
      ...testSetup.data.suspension,
      front: {
        ...testSetup.data.suspension.front,
        lower_arm_mount: { model: "Mount", configuration_notes: "A\nB" },
        top_arm_spacing: { front_mm: 0, rear_mm: 5.23456789 },
      },
    },
    shocks: {
      front: {
        ...testSetup.data.shocks.front,
        piston: { holes: 4, hole_diameter_mm: 1.23456789, notes: "Piston" },
        seal: { type: "x-ring", description: "Seal" },
      },
    },
    running_gear: {
      front: {
        hex: { offset_mm: 0 },
        wheel: { manufacturer_id: id, model: "Wheel", offset_mm: -4 },
        tire: { model: "Tire" },
      },
      rear: {
        hex: { offset_mm: -2.123456789 },
        wheel: { model: "Rear wheel", offset_mm: 0 },
        tire: { manufacturer_id: id },
      },
    },
  };
  const values = setupToForm({ ...testSetup, data });
  values.title = "Title only";
  expect(serializePatch(values).data).toEqual(data);
  expect(serializeCreate(values).data).toEqual(data);
  expect(serializePatch(values)).not.toHaveProperty(
    "running_gear_manufacturers",
  );
  expect(serializePatch(values)).not.toHaveProperty("chassis_model_id");
  for (const side of ["front", "rear"] as const) {
    const expected = structuredClone(data);
    const cleared = setupToForm({ ...testSetup, data });
    cleared.runningGear[side].hexOffset = "";
    delete expected.running_gear?.[side]?.hex;
    expect(serializeData(cleared)).toEqual(expected);
    cleared.runningGear[side].wheel = {
      manufacturerId: null,
      model: " ",
      offset: "",
    };
    delete expected.running_gear?.[side]?.wheel;
    expect(serializeData(cleared)).toEqual(expected);
    cleared.runningGear[side].tire = { manufacturerId: null, model: " " };
    delete expected.running_gear?.[side];
    expect(serializeData(cleared)).toEqual(expected);
  }
});
it.each(["+4", "-0", " 0 ", "-4"])("parses signed whole offset %s", (value) =>
  expect(parseWheelOffset(value)).toBe(Number(value)),
);
