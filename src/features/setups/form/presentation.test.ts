import { expect, it } from "vitest";
import {
  componentForPath,
  componentSpecs,
  hasValue,
  legacySection,
  sectionForPath,
  valueAt,
} from "./presentation";
import { setupToForm, serializePatch } from "./serialization";
import { testSetup } from "../testFixtures";
it("maps every component and aggregate error to a section and reveal destination", () => {
  for (const spec of componentSpecs)
    for (const path of spec.paths) {
      expect(componentForPath(path)?.id).toBe(spec.id);
      expect(sectionForPath(path + ".nested")).toBe(spec.section);
    }
  expect(sectionForPath("front.link_lengths")).toBe("front");
  expect(sectionForPath("selection")).toBe("general");
  expect(sectionForPath("rear.toe_deg")).toBe("rear");
});
it.each([
  0,
  "0",
  { manufacturerId: "historical" },
  { notes: "Only notes" },
  { front_mm: "0", rear_mm: "" },
  ["-"],
])("detects configured partial/zero/draft %j", (v) =>
  expect(hasValue(v)).toBe(true),
);
it.each([null, undefined, "  ", {}, [], { model: "", manufacturerId: null }])(
  "detects unconfigured %j",
  (v) => expect(hasValue(v)).toBe(false),
);
it("presentation never enters serialization and incomplete text remains untouched", () => {
  const values = setupToForm(testSetup);
  values.front.camber_deg = "-";
  values.runningGear.front.hexOffset = "1,";
  const draft = structuredClone(values);
  const expanded = new Set(["front-hex"]);
  expanded.clear();
  expect(values).toEqual(draft);
  expect(valueAt(values, "runningGear.front.hexOffset")).toBe("1,");
  values.front.camber_deg = "-1,23456789";
  values.runningGear.front.hexOffset = "0";
  expect(serializePatch(values).data).toMatchObject({
    suspension: { front: { camber_deg: -1.23456789 } },
    running_gear: { front: { hex: { offset_mm: 0 } } },
  });
});

it("maps old section/part anchors without changing values", () => {
  expect(legacySection("#setup-front-knuckle")).toBe("front");
  expect(legacySection("#setup-rear-differential")).toBe("rear");
  expect(legacySection("#setup-rear-shocks")).toBe("shocks");
  expect(legacySection("#setup-front-running-gear")).toBe("wheels");
  expect(legacySection("#unknown")).toBeUndefined();
});
