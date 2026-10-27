import { describe, expect, it } from "vitest";
import { testSetup } from "../setups/testFixtures";
import {
  chassisWarning,
  comparisonSections,
  normalize,
  type Setup,
} from "./model";
const setup = (
  data: Setup["data"] = {},
  extra: Partial<Setup> = {},
): Setup => ({ ...testSetup, data, ...extra });
const flat = (a: Setup, b: Setup, only = false) =>
  comparisonSections(a, b, only).flatMap((s) => s.rows);
const row = (a: Setup, b: Setup, label: string) =>
  flat(a, b).find((r) => r.label === label)!;
it.each([undefined, null, "", "  \r\n", Number.NaN, Infinity])(
  "normalizes missing %s without inventing zero",
  (value) => expect(normalize(value)).toBeNull(),
);
it.each([0, -0, -1.23456789, 0.00000001, 2147483647])(
  "preserves specified number %s",
  (value) => expect(normalize(value)).toBe(value),
);
it("normalizes only text boundaries, line endings and Unicode, not meaningful case or numeric precision", () => {
  expect(normalize(" e\u0301\r\ntrim \r ")).toBe("é\ntrim");
  expect(normalize("ABC")).not.toBe(normalize("abc"));
  expect(normalize(1.00000001)).not.toBe(normalize(1.00000002));
});
it("keeps absent vs explicit zero distinct and excludes either missing side from only-differences", () => {
  const a = setup({ suspension: { front: { camber_deg: 0, toe_deg: 0 } } });
  const b = setup({ suspension: { front: { toe_deg: 1 } } });
  expect(row(a, b, "Camber (deg)")).toMatchObject({
    left: 0,
    right: null,
    different: true,
  });
  const differences = flat(a, b, true);
  expect(differences.map((r) => r.label)).toEqual(["Toe (deg)"]);
  expect(differences[0]).toMatchObject({ left: 0, right: 1 });
  expect(flat(b, a, true).map((r) => r.label)).toEqual(["Toe (deg)"]);
});
it("aligns links by normalized semantic names instead of array order, including duplicates", () => {
  const a = setup({
    suspension: {
      front: {
        link_lengths: [
          { name: "Upper", length_mm: 25 },
          { name: "Tie rod", length_mm: 16.23456789 },
          { name: "Upper", length_mm: 26 },
        ],
      },
    },
  });
  const b = setup({
    suspension: {
      front: {
        link_lengths: [
          { name: " upper ", length_mm: 26 },
          { name: "UPPER", length_mm: 25 },
          { name: "Tie   rod", length_mm: 16.23456789 },
        ],
      },
    },
  });
  expect(flat(a, b, true)).toEqual([]);
  b.data.suspension!.front!.link_lengths!.push({
    name: "Only right",
    length_mm: 19,
  });
  expect(row(a, b, "Only right (mm)")).toMatchObject({
    left: null,
    right: "19",
  });
  expect(flat(a, b, true)).toEqual([]);
});
it("includes every optional numeric field with precision and zero preserved", () => {
  const data: Setup["data"] = {
    suspension: {
      front: {
        camber_deg: 0,
        caster_deg: 1.12345678,
        toe_deg: -0.05,
        top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
        lower_arm_spacing: { front_mm: 0.000001, rear_mm: 0 },
        lower_arm_mount: { model: "Mount", configuration_notes: "note" },
      },
      rear: { camber_deg: -1, lower_arm_spacing: { front_mm: 2, rear_mm: 0 } },
    },
    shocks: {
      front: {
        manufacturer: "A",
        model: "B",
        spring: { manufacturer: "C", color: "Red" },
        oil_cst: 100,
        piston: { holes: 3, hole_diameter_mm: 1.12345678, notes: "Piston" },
        seal: { type: "x-ring", description: "seal" },
      },
      rear: { piston: { holes: 4 }, seal: { type: "o-ring" } },
    },
    running_gear: {
      front: {
        hex: { offset_mm: 0 },
        wheel: { model: "W", offset_mm: -2 },
        tire: { model: "T" },
      },
      rear: { hex: { offset_mm: -1 }, wheel: { offset_mm: 0 } },
    },
    rear_differential: { type: "lsd", model: "Diff", tuning_notes: "Oil" },
    front_steering_knuckle: { description: "Knuckle" },
    electronics: {
      motor: "10.5T",
      esc: "ESC",
      servo: "S",
      gyro: "G",
      radio: "R",
    },
  };
  const a = setup(data, { notes: "Notes" });
  const b = structuredClone(a);
  expect(flat(a, b, true)).toEqual([]);
  const values = flat(a, b).map((r) => r.left);
  for (const value of [
    0,
    1.12345678,
    -0.05,
    "0 mm",
    "5.2 mm",
    "0.000001 mm",
    "Mount",
    "note",
    "A",
    "B",
    "C",
    "Red",
    100,
    3,
    "Piston",
    "X-ring",
    "seal",
    -2,
    "W",
    "T",
    "LSD",
    "Diff",
    "Oil",
    "Knuckle",
    "10.5T",
    "ESC",
    "S",
    "G",
    "R",
    "Notes",
  ])
    expect(values).toContain(value);
});
it("compares historical manufacturers by catalog identity even if names are unavailable", () => {
  const a = setup({ rear_differential: { manufacturer_id: testSetup.id } });
  const b = setup({
    rear_differential: { manufacturer_id: testSetup.owner_id },
  });
  expect(flat(a, b, true).map((r) => r.label)).toEqual(["Manufacturer"]);
  b.data.rear_differential!.manufacturer_id = testSetup.id.toUpperCase();
  expect(flat(a, b, true)).toEqual([]);
});
describe("section filtering and chassis", () => {
  it("removes whole equal/unknown sections, restores them when disabled and returns one empty result", () => {
    const a = setup(),
      b = setup();
    expect(comparisonSections(a, b, true)).toEqual([]);
    expect(comparisonSections(a, b, false).length).toBeGreaterThan(15);
    b.data = { electronics: { motor: "Motor" } };
    expect(comparisonSections(a, b, true)).toEqual([]);
    a.data = { electronics: { motor: "Other" } };
    expect(comparisonSections(a, b, true).map((s) => s.title)).toEqual([
      "Electronics",
    ]);
  });
  it("warns about different catalog models and either custom chassis", () => {
    expect(chassisWarning(setup(), setup())).toBe(false);
    expect(
      chassisWarning(setup(), setup({}, { chassis_model_id: testSetup.id })),
    ).toBe(true);
    expect(
      chassisWarning(
        setup(),
        setup({}, { chassis: null, chassis_model_id: null }),
      ),
    ).toBe(true);
    expect(
      chassisWarning(
        setup({}, { chassis: null }),
        setup({}, { chassis: null }),
      ),
    ).toBe(true);
  });
});

it("renders a malformed missing link measurement as missing rather than text or zero", () => {
  const a = setup({
    suspension: {
      front: { link_lengths: [{ name: "Upper", length_mm: null }] },
    },
  } as unknown as Setup["data"]);
  const b = setup({
    suspension: { front: { link_lengths: [{ name: "Upper", length_mm: 25 }] } },
  });
  expect(row(a, b, "Upper (mm)")).toMatchObject({ left: null, right: "25" });
  expect(flat(a, b, true)).toEqual([]);
});
