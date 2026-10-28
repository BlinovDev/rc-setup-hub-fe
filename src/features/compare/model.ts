import { isUuid } from "../search/filters";
import type { components } from "../../api/generated/schema";
import { chassisLabel } from "../setups/api";
import {
  technicalSections,
  type TechnicalSection,
} from "../setups/technicalSections";
export type Setup = components["schemas"]["Setup"];
export const notSpecified = "Not specified";
export function normalize(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value?.normalize("NFC").replace(/\r\n?/g, "\n").trim() || null;
}
function sections(setup: Setup): TechnicalSection[] {
  return [
    {
      title: "General",
      values: [
        [
          "Chassis",
          chassisLabel(setup),
          setup.chassis_model_id?.toLowerCase() ?? "custom",
        ],
        ["Notes", setup.notes],
      ],
    },
    ...technicalSections({
      data: setup.data,
      runningGearManufacturers: setup.running_gear_manufacturers,
      differentialManufacturer: setup.rear_differential_manufacturer,
      mountManufacturers: setup.lower_arm_mount_manufacturers,
      knuckleManufacturer: setup.front_steering_knuckle_manufacturer,
    }),
  ];
}
function entries(section: TechnicalSection) {
  const groups = new Map<
    string,
    {
      label: string;
      value: ReturnType<typeof normalize>;
      identity: string | number | null;
    }[]
  >();
  section.values.forEach(([label, raw, canonical, , stableKey], index) => {
    const link = section.title.endsWith(" suspension") && index >= 3;
    const key =
      stableKey ??
      (link
        ? `link:${label.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()}`
        : label);
    const value = normalize(raw);
    const group = groups.get(key) ?? [];
    group.push({
      label: link ? `${label.trim()} (mm)` : label,
      value:
        link && typeof value === "string" ? value.replace(/ mm$/, "") : value,
      identity: canonical ?? value,
    });
    groups.set(key, group);
  });
  // Duplicate names have no unique backend ID: sort their values before pairing,
  // so reordering an otherwise identical array cannot manufacture differences.
  return new Map(
    [...groups].flatMap(([key, group]) =>
      group
        .sort((a, b) => String(a.identity).localeCompare(String(b.identity)))
        .map((value, index) => [`${key}:${index}`, value] as const),
    ),
  );
}
export function comparisonSections(
  left: Setup,
  right: Setup,
  onlyDifferences: boolean,
) {
  const rightSections = sections(right);
  return sections(left)
    .map((section, i) => {
      const a = entries(section),
        b = entries(rightSections[i]!);
      const rows = [...new Set([...a.keys(), ...b.keys()])]
        .map((key) => {
          const l = a.get(key),
            r = b.get(key);
          const left = l?.value ?? null,
            right = r?.value ?? null;
          const different = (l?.identity ?? null) !== (r?.identity ?? null);
          return { key, label: l?.label ?? r!.label, left, right, different };
        })
        .filter(
          (row) =>
            !onlyDifferences ||
            (row.left !== null && row.right !== null && row.different),
        );
      return { title: section.title, rows };
    })
    .filter((section) => section.rows.length > 0);
}
export function chassisWarning(left: Setup, right: Setup) {
  return (
    !left.chassis ||
    !right.chassis ||
    left.chassis_model_id?.toLowerCase() !==
      right.chassis_model_id?.toLowerCase()
  );
}

export function readPair(params: URLSearchParams) {
  const left = params.get("left_id")?.toLowerCase() ?? "";
  const right = params.get("right_id")?.toLowerCase() ?? "";
  return {
    left,
    right,
    valid:
      ["left_id", "right_id"].every((key) => params.getAll(key).length <= 1) &&
      (!left || isUuid(left)) &&
      (!right || isUuid(right)) &&
      (!left || !right || left !== right),
  };
}
