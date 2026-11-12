import { isUuid } from "../search/filters";
import type { components } from "../../api/generated/schema";
import { chassisLabel } from "../setups/api";
import {
  calculateWeightDistribution,
  formatPercent,
} from "../setups/weightDistribution";
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
  const weight = setup.data.weight_distribution;
  const calculated = calculateWeightDistribution(weight);
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
    ...(weight && calculated
      ? [
          {
            title: "Weight Distribution",
            values: [
              [
                "Front left (g)",
                weight.front_left_g,
                undefined,
                undefined,
                "weight:grams:front-left",
              ],
              [
                "Front right (g)",
                weight.front_right_g,
                undefined,
                undefined,
                "weight:grams:front-right",
              ],
              [
                "Rear left (g)",
                weight.rear_left_g,
                undefined,
                undefined,
                "weight:grams:rear-left",
              ],
              [
                "Rear right (g)",
                weight.rear_right_g,
                undefined,
                undefined,
                "weight:grams:rear-right",
              ],
              ...(
                [
                  ["Front (%)", calculated.front, "front"],
                  ["Rear (%)", calculated.rear, "rear"],
                  ["Left (%)", calculated.left, "left"],
                  ["Right (%)", calculated.right, "right"],
                ] as const
              ).map(
                ([label, raw, key]) =>
                  [
                    label,
                    formatPercent(raw),
                    raw,
                    undefined,
                    `weight:percentages:${key}`,
                  ] as const,
              ),
              [
                "Total mass (g)",
                calculated.total,
                undefined,
                undefined,
                "weight:grams:total",
              ],
              [
                "Body installed",
                weight.body_installed ? "Installed" : "Not installed",
                undefined,
                undefined,
                "weight:conditions:body",
              ],
              [
                "Battery installed",
                weight.battery_installed ? "Installed" : "Not installed",
                undefined,
                undefined,
                "weight:conditions:battery",
              ],
            ] as TechnicalSection["values"],
          },
        ]
      : []),
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
  const leftSections = sections(left);
  const leftWeight = calculateWeightDistribution(left.data.weight_distribution);
  const rightWeight = calculateWeightDistribution(
    right.data.weight_distribution,
  );
  return [
    ...leftSections,
    ...rightSections.filter(
      (section) =>
        !leftSections.some((candidate) => candidate.title === section.title),
    ),
  ]
    .map((section) => {
      const rightSection = rightSections.find(
        (candidate) => candidate.title === section.title,
      );
      const a = entries(section),
        b = rightSection ? entries(rightSection) : new Map();
      const rows = [...new Set([...a.keys(), ...b.keys()])]
        .map((key) => {
          const l = a.get(key),
            r = b.get(key);
          const left = l?.value ?? null,
            right = r?.value ?? null;
          const different = (l?.identity ?? null) !== (r?.identity ?? null);
          return {
            key,
            label: l?.label ?? r!.label,
            left,
            right,
            different,
            leftNumber: typeof l?.identity === "number" ? l.identity : null,
            rightNumber: typeof r?.identity === "number" ? r.identity : null,
          };
        })
        .filter(
          (row) =>
            !onlyDifferences ||
            (section.title === "Weight Distribution" &&
              !!leftWeight &&
              !!rightWeight) ||
            (row.left !== null && row.right !== null && row.different),
        );
      return {
        title: section.title,
        rows,
        warning:
          section.title === "Weight Distribution" &&
          !!leftWeight &&
          !!rightWeight &&
          (left.data.weight_distribution!.body_installed !==
            right.data.weight_distribution!.body_installed ||
            left.data.weight_distribution!.battery_installed !==
              right.data.weight_distribution!.battery_installed),
      };
    })
    .filter(
      (section) =>
        section.rows.length > 0 &&
        (section.title !== "Weight Distribution" ||
          (!!leftWeight && !!rightWeight)),
    );
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
