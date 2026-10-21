import { expect, it } from "vitest";
import { testSetup } from "../testFixtures";
import { setupFormSchema } from "./formSchema";
import {
  serializeCreate,
  serializeData,
  serializePatch,
  setupToForm,
} from "./serialization";

for (const side of ["front", "rear"] as const) {
  const field = side === "front" ? "frontShock" : "rearShock";
  it(`${side} hardware round trips without losing existing full data`, () => {
    const data = {
      ...testSetup.data,
      rear_differential: { type: "ball" as const },
      shocks: {
        ...testSetup.data.shocks,
        [side]: {
          ...testSetup.data.shocks?.[side],
          piston: {
            holes: 2147483647,
            hole_diameter_mm: 1.23456789,
            notes: "Two stages\nSoft",
          },
          seal: { type: "x-ring" as const, description: "Product" },
        },
      },
    };
    const values = setupToForm({ ...testSetup, data });
    values.title = "Title only";
    expect(setupFormSchema.safeParse(values).success).toBe(true);
    expect(serializePatch(values).data).toEqual(data);
    expect(serializeCreate(values).data).toEqual(data);
  });
  it.each([
    ["pistonHoles", "6", { piston: { holes: 6 } }],
    [
      "pistonDiameter",
      "1,23456789",
      { piston: { hole_diameter_mm: 1.23456789 } },
    ],
    ["pistonNotes", " Notes\nOnly ", { piston: { notes: "Notes\nOnly" } }],
    ["sealType", "o-ring", { seal: { type: "o-ring" } }],
    ["sealDescription", " Product ", { seal: { description: "Product" } }],
  ] as const)(`${side} independent optional %s`, (key, input, expected) => {
    const values = setupToForm();
    values.title = "Title";
    Object.assign(values[field], { [key]: input });
    expect(setupFormSchema.safeParse(values).success).toBe(true);
    expect(serializeCreate(values).data).toEqual({
      shocks: { [side]: expected },
    });
  });
  it.each([
    undefined,
    null,
    {},
    { piston: null, seal: null },
    { piston: {}, seal: {} },
  ])(`${side} legacy/null/empty hardware prunes %j`, (shock) => {
    const values = setupToForm({
      ...testSetup,
      data: { shocks: { [side]: shock } },
    });
    expect(serializeData(values)).toEqual({});
  });
  it.each([
    { pistonHoles: "0" },
    { pistonHoles: "-1" },
    { pistonHoles: "1.5" },
    { pistonHoles: "1,5" },
    { pistonHoles: "1e2" },
    { pistonHoles: "2147483648" },
    { pistonHoles: "NaN" },
    { pistonDiameter: "0" },
    { pistonDiameter: "-1" },
    { pistonDiameter: "Infinity" },
    { pistonDiameter: "1e999" },
    { pistonDiameter: "1,2,3" },
    { pistonNotes: "x".repeat(10001) },
    { pistonNotes: "bad\0text" },
    { sealDescription: "😀".repeat(201) },
    { sealDescription: "bad\0text" },
    { sealType: "other" },
  ])(`${side} rejects invalid hardware %#`, (input) => {
    const values = setupToForm(testSetup);
    Object.assign(values[field], input);
    expect(setupFormSchema.safeParse(values).success).toBe(false);
  });
  it(`${side} accepts Unicode boundaries and prunes cleared hardware only`, () => {
    const values = setupToForm(testSetup);
    values[field].pistonNotes = "😀".repeat(10000);
    values[field].sealDescription = "😀".repeat(200);
    expect(setupFormSchema.safeParse(values).success).toBe(true);
    values[field].pistonNotes = "\n ";
    values[field].sealDescription = " ";
    expect(serializeData(values)).toEqual(testSetup.data);
  });
}
