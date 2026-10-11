import { describe, expect, it } from "vitest";
import { parseSuspensionNumber, setupFormSchema } from "./formSchema";
import { serializeData, setupToForm } from "./serialization";

describe("suspension decimal parsing", () => {
  it.each([
    ["16.2", 16.2],
    ["16,2", 16.2],
    ["6.8", 6.8],
    ["6,8", 6.8],
    ["-1,5", -1.5],
    ["  +0,25  ", 0.25],
    [".25", 0.25],
    [",25", 0.25],
    ["16,", 16],
    ["0,123456789", 0.123456789],
    ["1,62e1", 16.2],
    ["0", 0],
    ["0,0", 0],
    ["", undefined],
    ["   ", undefined],
  ])("parses %s without rounding", (input, expected) => {
    expect(parseSuspensionNumber(String(input))).toBe(expected);
  });
  it.each([
    "16,2.3",
    "16.2,3",
    "16,,2",
    "16..2",
    "abc",
    "NaN",
    "Infinity",
    "-Infinity",
    "1e999",
    "1,2,3",
    "1 234,5",
    ",",
    ".",
    "-",
  ])("rejects the complete malformed/nonfinite input %s", (input) => {
    expect(() => parseSuspensionNumber(input)).toThrow();
  });
  for (const side of ["front", "rear"] as const) {
    for (const field of ["camber_deg", "caster_deg", "toe_deg"] as const) {
      it.each(["-1.5", "-1,5", "0", "0,25", "6.8", "", "  "])(
        `validates and serializes ${side}.${field}: %s`,
        (input) => {
          const values = setupToForm();
          values.title = "Decimal setup";
          values[side][field] = input;
          expect(setupFormSchema.safeParse(values).success).toBe(true);
          const number = parseSuspensionNumber(input);
          expect(serializeData(values)).toEqual(
            number === undefined
              ? {}
              : {
                  suspension: { [side]: { [field]: number } },
                },
          );
        },
      );
      it.each(["16,2.3", "NaN", "1e999"])(
        `rejects invalid ${side}.${field}: %s`,
        (input) => {
          const values = setupToForm();
          values.title = "Decimal setup";
          values[side][field] = input;
          expect(setupFormSchema.safeParse(values).success).toBe(false);
        },
      );
    }
    it.each(["16.2", "16,2", "0.25", "0,25"])(
      `serializes positive ${side} link lengths as numbers: %s`,
      (input) => {
        const values = setupToForm();
        values.title = "Decimal setup";
        values[side].link_lengths = [{ name: " Upper ", length_mm: input }];
        expect(setupFormSchema.safeParse(values).success).toBe(true);
        expect(serializeData(values)).toEqual({
          suspension: {
            [side]: {
              link_lengths: [
                { name: "Upper", length_mm: parseSuspensionNumber(input) },
              ],
            },
          },
        });
      },
    );
    it.each(["", "  ", "0", "0,0", "-0,25", "16,2.3", "Infinity", "1e999"])(
      `rejects invalid ${side} link lengths: %s`,
      (input) => {
        const values = setupToForm();
        values.title = "Decimal setup";
        values[side].link_lengths = [{ name: "Upper", length_mm: input }];
        expect(setupFormSchema.safeParse(values).success).toBe(false);
        expect(() => serializeData(values)).toThrow();
      },
    );
  }
  it("preserves the existing oil syntax outside this feature scope", () => {
    const values = setupToForm();
    values.title = "Decimal setup";
    values.frontShock.oil_cst = "100,5";
    expect(setupFormSchema.safeParse(values).success).toBe(false);
    values.frontShock.oil_cst = "100.5";
    expect(setupFormSchema.safeParse(values).success).toBe(true);
  });
});
