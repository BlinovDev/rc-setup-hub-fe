import { describe, expect, it } from "vitest";
import { testSetup } from "../testFixtures";
import { parseOptionalNumber, setupFormSchema } from "./formSchema";
import {
  serializeCreate,
  serializeData,
  serializePatch,
  setupToForm,
} from "./serialization";

describe("setup input semantics", () => {
  it.each([
    ["", undefined],
    ["  ", undefined],
    ["0", 0],
    ["-1.5", -1.5],
  ])("parses %s explicitly", (input, expected) =>
    expect(parseOptionalNumber(String(input))).toBe(expected),
  );
  it.each(["NaN", "Infinity", "-Infinity", "1e999", "invalid"])(
    "rejects %s",
    (value) => expect(() => parseOptionalNumber(value)).toThrow(),
  );
  it("prunes all empty nested sections into an empty data document", () => {
    const values = setupToForm();
    values.frontShock.manufacturer = "  ";
    values.electronics.motor = "  ";
    expect(serializeData(values)).toEqual({});
    expect(serializeCreate(values)).toEqual({
      title: "",
      visibility: "private",
      notes: null,
      data: {},
      chassis_model_id: null,
    });
  });
  it("preserves zero without creating other empty axle or spring objects", () => {
    const values = setupToForm();
    values.front.toe_deg = "0";
    values.frontShock.model = "  Big bore  ";
    expect(serializeData(values)).toEqual({
      suspension: { front: { toe_deg: 0 } },
      shocks: { front: { model: "Big bore" } },
    });
  });
  it("maps every schema-v1 field to inputs and serializes the full technical document", () => {
    const values = setupToForm(testSetup);
    expect(values.front.toe_deg).toBe("0");
    expect(values.front.caster_deg).toBe("");
    expect(values.front.link_lengths).toEqual([
      { name: "Upper", length_mm: "25" },
    ]);
    expect(serializeData(values)).toEqual(testSetup.data);
    values.front.toe_deg = "1";
    expect(serializePatch(values).data?.electronics).toEqual(
      testSetup.data.electronics,
    );
  });
  it("omits unchanged historical chassis, and explicitly clears chassis and notes", () => {
    const values = setupToForm(testSetup);
    values.notes = "";
    expect(serializePatch(values)).not.toHaveProperty("chassis_model_id");
    expect(serializePatch(values).notes).toBeNull();
    values.changeChassis = true;
    expect(serializePatch(values).chassis_model_id).toBeNull();
    expect(serializePatch(values)).not.toHaveProperty("owner_id");
    expect(serializePatch(values)).not.toHaveProperty("schema_version");
    expect(serializePatch(values)).not.toHaveProperty("chassis");
  });
  it("keeps incomplete brand choice distinct from Custom", () => {
    const values = setupToForm();
    values.title = "Title";
    values.selection.brandId = testSetup.chassis.brand_id;
    expect(setupFormSchema.safeParse(values).success).toBe(false);
    expect(() => serializeCreate(values)).toThrow();
    expect(() => serializePatch(values)).toThrow();
  });
  it.each(["", "  ", "a".repeat(151), "Bad\0title"])(
    "rejects invalid title",
    (title) => {
      const values = setupToForm();
      values.title = title;
      expect(setupFormSchema.safeParse(values).success).toBe(false);
    },
  );
  it.each(["0", "-1", "Infinity"])(
    "rejects nonpositive or nonfinite oil/length",
    (value) => {
      const values = setupToForm();
      values.title = "Title";
      values.frontShock.oil_cst = value;
      expect(setupFormSchema.safeParse(values).success).toBe(false);
      values.frontShock.oil_cst = "";
      values.front.link_lengths = [{ name: "Upper", length_mm: value }];
      expect(setupFormSchema.safeParse(values).success).toBe(false);
    },
  );
  it("rejects invalid technical strings, notes and link names", () => {
    const values = setupToForm(testSetup);
    values.electronics.motor = "a".repeat(201);
    expect(setupFormSchema.safeParse(values).success).toBe(false);
    values.electronics.motor = "Bad\0text";
    expect(setupFormSchema.safeParse(values).success).toBe(false);
    values.electronics.motor = "";
    values.notes = "a".repeat(10001);
    expect(setupFormSchema.safeParse(values).success).toBe(false);
    values.notes = "";
    values.front.link_lengths = [{ name: "  ", length_mm: "25" }];
    expect(setupFormSchema.safeParse(values).success).toBe(false);
  });
});
