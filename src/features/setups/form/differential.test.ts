import type { components } from "../../../api/generated/schema";
import { describe, expect, it } from "vitest";
import { testSetup } from "../testFixtures";
import { differentialTypes } from "../differential";
import { setupFormSchema } from "./formSchema";
import {
  serializeCreate,
  serializeData,
  serializePatch,
  setupToForm,
} from "./serialization";

type Schemas = components["schemas"];
const id = testSetup.chassis.brand_id;

describe("optional rear differential", () => {
  it.each([
    undefined,
    null,
    {},
    { type: null, manufacturer_id: null, model: null, tuning_notes: null },
  ])("prunes legacy/empty/null data without defaults: %j", (differential) => {
    const setup: Schemas["Setup"] = {
      ...testSetup,
      data:
        differential === undefined ? {} : { rear_differential: differential },
    };
    const values = setupToForm(setup);
    expect(values.rearDifferential).toEqual({
      type: "",
      manufacturerId: null,
      model: "",
      tuningNotes: "",
    });
    expect(serializeData(values)).toEqual({});
  });
  it.each(differentialTypes)(
    "round trips %s and preserves the full document on unrelated edits",
    (type) => {
      const data = {
        ...testSetup.data,
        rear_differential: {
          type,
          manufacturer_id: id,
          model: "Diff",
          tuning_notes: "Oil 10000\nTwo gears",
        },
      };
      const values = setupToForm({ ...testSetup, data });
      values.title = "Unrelated title";
      expect(setupFormSchema.safeParse(values).success).toBe(true);
      expect(serializePatch(values).data).toEqual(data);
      expect(serializeCreate(values).data).toEqual(data);
      expect(serializePatch(values)).not.toHaveProperty(
        "rear_differential_manufacturer",
      );
      expect(serializePatch(values)).not.toHaveProperty("chassis_model_id");
    },
  );
  it.each([
    [{ type: "gear" as const }, { type: "gear" }],
    [{ manufacturerId: id }, { manufacturer_id: id }],
    [{ model: " Model " }, { model: "Model" }],
    [
      { tuningNotes: " Spring preload\nTwo gears " },
      { tuning_notes: "Spring preload\nTwo gears" },
    ],
  ])("supports each field independently: %j", (input, expected) => {
    const values = setupToForm();
    values.title = "Title";
    Object.assign(values.rearDifferential, input);
    expect(setupFormSchema.safeParse(values).success).toBe(true);
    expect(serializeCreate(values).data).toEqual({
      rear_differential: expected,
    });
  });
  it("removes the entire block while preserving zero, decimals, chassis, notes and other sections", () => {
    const values = setupToForm(testSetup);
    values.rearDifferential.model = "  ";
    values.rearDifferential.tuningNotes = "\n ";
    values.front.camber_deg = "-6,8";
    values.front.top_arm_spacing = { front_mm: "0", rear_mm: "5,2" };
    const body = serializePatch(values);
    expect(body.data).not.toHaveProperty("rear_differential");
    expect(body.data?.suspension?.front).toMatchObject({
      toe_deg: 0,
      camber_deg: -6.8,
      top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
    });
    expect(body.data?.shocks).toEqual(testSetup.data.shocks);
    expect(body.data?.electronics).toEqual(testSetup.data.electronics);
    expect(body.notes).toBe(testSetup.notes);
    expect(body).not.toHaveProperty("chassis_model_id");
  });
  it("accepts Unicode codepoint boundaries and free-form multiline notes", () => {
    const values = setupToForm(testSetup);
    values.rearDifferential.model = "界".repeat(200);
    values.rearDifferential.tuningNotes = "😀".repeat(10000);
    expect(setupFormSchema.safeParse(values).success).toBe(true);
    expect(serializeData(values).rear_differential?.tuning_notes).toBe(
      values.rearDifferential.tuningNotes,
    );
  });
  it.each([
    { type: "spul" },
    { type: "other" },
    { type: "Gear" },
    { manufacturerId: "" },
    { manufacturerId: "not-a-uuid" },
    { model: "x".repeat(201) },
    { model: "bad\0text" },
    { tuningNotes: "x".repeat(10001) },
    { tuningNotes: "bad\0text" },
  ])("rejects invalid differential input %#", (input) => {
    const values = setupToForm(testSetup);
    Object.assign(values.rearDifferential, input);
    expect(setupFormSchema.safeParse(values).success).toBe(false);
  });
});
