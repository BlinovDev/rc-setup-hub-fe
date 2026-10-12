import type { components } from "../../../api/generated/schema";
import { describe, expect, it } from "vitest";
import { testSetup } from "../testFixtures";
import { parseArmSpacingNumber, setupFormSchema } from "./formSchema";
import { serializeData, serializePatch, setupToForm } from "./serialization";

describe("optional arm spacer totals", () => {
  it.each(["", "  ", "0", "0.0", "5.2", "5,2", "0,123456789", "1e-8"])(
    "parses %s without rounding",
    (input) => {
      expect(parseArmSpacingNumber(input)).toBe(
        input.trim() === "" ? undefined : Number(input.replace(",", ".")),
      );
    },
  );
  for (const axle of ["front", "rear"] as const) {
    for (const arm of ["top_arm_spacing", "lower_arm_spacing"] as const) {
      it(`${axle} ${arm} supports empty, partial and all-zero totals independently`, () => {
        const values = setupToForm();
        values.title = "Setup";
        expect(values[axle][arm]).toBeUndefined();
        values[axle][arm] = { front_mm: "", rear_mm: "" };
        expect(setupFormSchema.safeParse(values).success).toBe(true);
        expect(serializeData(values)).toEqual({});
        values[axle][arm] = { front_mm: "0", rear_mm: "5,2" };
        expect(serializeData(values)).toEqual({
          suspension: { [axle]: { [arm]: { front_mm: 0, rear_mm: 5.2 } } },
        });
        values[axle][arm] = { front_mm: "", rear_mm: "0" };
        expect(serializeData(values)).toEqual({
          suspension: { [axle]: { [arm]: { rear_mm: 0 } } },
        });
        values[axle][arm] = { front_mm: "0", rear_mm: "0" };
        const data = serializeData(values);
        const hydrated = setupToForm({ ...testSetup, data });
        expect(hydrated[axle][arm]).toEqual({ front_mm: "0", rear_mm: "0" });
        expect(serializeData(hydrated)).toEqual(data);
        values[axle][arm] = undefined;
        expect(serializeData(values)).toEqual({});
      });
      for (const position of ["front_mm", "rear_mm"] as const) {
        it.each([
          "-0.1",
          "-0,1",
          "NaN",
          "Infinity",
          "-Infinity",
          "1e999",
          "1,2.3",
          "1,,2",
          "bad",
        ])(`${axle} ${arm} ${position} rejects %s`, (input) => {
          const values = setupToForm();
          values.title = "Setup";
          values[axle][arm] = { front_mm: "", rear_mm: "", [position]: input };
          expect(setupFormSchema.safeParse(values).success).toBe(false);
          expect(() => serializeData(values)).toThrow();
        });
      }
    }
  }
  it("hydrates null/empty blocks as absent, and preserves legacy technical values", () => {
    const legacy = setupToForm(testSetup);
    expect(legacy.front.top_arm_spacing).toBeUndefined();
    expect(serializeData(legacy)).toEqual(testSetup.data);
    const values = setupToForm({
      ...testSetup,
      data: {
        suspension: {
          front: {
            top_arm_spacing: null,
            lower_arm_spacing: { front_mm: null, rear_mm: null },
          },
        },
      },
    });
    expect(values.front.top_arm_spacing).toBeUndefined();
    expect(values.front.lower_arm_spacing).toBeUndefined();
    expect(serializeData(values)).toEqual({});
  });
  it("unrelated edits and removal/clearing retain sibling blocks and measurements", () => {
    const data: components["schemas"]["SetupDataV1"] = structuredClone(
      testSetup.data,
    );
    data.suspension!.front!.top_arm_spacing = { front_mm: 0, rear_mm: 5.2 };
    data.suspension!.front!.lower_arm_spacing = { front_mm: 1.2, rear_mm: 0 };
    data.suspension!.rear!.top_arm_spacing = { rear_mm: 0.123456789 };
    const values = setupToForm({ ...testSetup, data });
    values.title += " renamed";
    expect(serializePatch(values).data).toEqual(data);
    values.front.top_arm_spacing = undefined;
    values.front.lower_arm_spacing!.front_mm = "";
    const expected = structuredClone(data);
    delete expected.suspension!.front!.top_arm_spacing;
    delete expected.suspension!.front!.lower_arm_spacing!.front_mm;
    expect(serializePatch(values).data).toEqual(expected);
  });
});
