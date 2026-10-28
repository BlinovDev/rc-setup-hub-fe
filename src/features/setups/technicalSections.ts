import { suspensionLengths } from "./suspensionLinks";
import { differentialLabels, manufacturerLabel } from "./differential";
import type { components } from "../../api/generated/schema";
export type TechnicalValue = [
  label: string,
  value: string | number | null | undefined,
  identity?: string | undefined,
  showMissing?: boolean | undefined,
  key?: string | undefined,
];
export type TechnicalSection = { title: string; values: TechnicalValue[] };
export type TechnicalProps = {
  data: components["schemas"]["SetupDataV1"];
  runningGearManufacturers?:
    components["schemas"]["RunningGearManufacturers"] | null;
  knuckleManufacturer?:
    components["schemas"]["DifferentialManufacturer"] | null;
  mountManufacturers?:
    components["schemas"]["LowerArmMountManufacturers"] | null;
  differentialManufacturer?:
    components["schemas"]["DifferentialManufacturer"] | null;
};
export function technicalSections({
  data,
  differentialManufacturer,
  mountManufacturers,
  runningGearManufacturers,
  knuckleManufacturer,
}: TechnicalProps) {
  const sections: {
    title: string;
    values: TechnicalValue[];
  }[] = [];
  for (const axle of ["front", "rear"] as const) {
    const suspension = data.suspension?.[axle];
    const shock = data.shocks?.[axle];
    const label = axle === "front" ? "Front" : "Rear";
    sections.push({
      title: `${label} suspension`,
      values: [
        ["Camber (deg)", suspension?.camber_deg],
        ["Caster (deg)", suspension?.caster_deg],
        ["Toe (deg)", suspension?.toe_deg],
        ...(() => {
          const links = suspension?.link_lengths ?? [];
          const standard = suspensionLengths(suspension, axle);
          const used = new Set(
            standard.flatMap((item) =>
              item.index === undefined ? [] : [item.index],
            ),
          );
          return [
            ...standard.map(
              (item) =>
                [
                  item.label,
                  item.value == null ? undefined : `${item.value} mm`,
                  undefined,
                  true,
                  `standard:${item.field}`,
                ] as TechnicalValue,
            ),
            ...links.flatMap((link, index) =>
              used.has(index)
                ? []
                : [
                    [
                      link.name,
                      link.length_mm == null
                        ? undefined
                        : `${link.length_mm} mm`,
                      undefined,
                      link.length_mm == null,
                    ] as TechnicalValue,
                  ],
            ),
          ];
        })(),
      ],
    });
    const gear = data.running_gear?.[axle];
    sections.push({
      title: `${label} hex`,
      values: [["Offset (mm)", gear?.hex?.offset_mm]],
    });
    for (const part of ["wheel", "tire"] as const) {
      const component = gear?.[part];
      sections.push({
        title: `${label} ${part}`,
        values: [
          [
            "Manufacturer",
            component?.manufacturer_id
              ? manufacturerLabel(
                  component.manufacturer_id,
                  runningGearManufacturers?.[axle]?.[part],
                )
              : undefined,
            component?.manufacturer_id?.toLowerCase(),
          ],
          ["Model", component?.model?.trim() || undefined],
          ...(part === "wheel"
            ? [
                ["Offset (mm)", gear?.wheel?.offset_mm] as [
                  string,
                  number | null | undefined,
                ],
              ]
            : []),
        ],
      });
    }
    const mount = suspension?.lower_arm_mount;
    sections.push({
      title: `${label} lower arm mount`,
      values: [
        [
          "Manufacturer",
          mount?.manufacturer_id
            ? manufacturerLabel(
                mount.manufacturer_id,
                mountManufacturers?.[axle],
              )
            : undefined,
          mount?.manufacturer_id?.toLowerCase(),
        ],
        ["Model / part number", mount?.model?.trim() || undefined],
        [
          "Configuration notes",
          mount?.configuration_notes?.trim() || undefined,
        ],
      ],
    });
    for (const arm of ["top_arm_spacing", "lower_arm_spacing"] as const) {
      const spacing = suspension?.[arm];
      sections.push({
        title: `${label} ${arm === "top_arm_spacing" ? "top" : "lower"} arm spacing`,
        values: [
          [
            "Front spacers (ahead of arm)",
            spacing?.front_mm == null ? undefined : `${spacing.front_mm} mm`,
          ],
          [
            "Rear spacers (behind arm)",
            spacing?.rear_mm == null ? undefined : `${spacing.rear_mm} mm`,
          ],
        ],
      });
    }
    sections.push({
      title: `${label} shocks`,
      values: [
        ["Manufacturer", shock?.manufacturer],
        ["Model", shock?.model],
        ["Spring manufacturer", shock?.spring?.manufacturer],
        ["Spring color", shock?.spring?.color],
        ["Oil (cSt)", shock?.oil_cst],
        ["Piston holes", shock?.piston?.holes],
        ["Piston hole diameter (mm)", shock?.piston?.hole_diameter_mm],
        ["Piston notes", shock?.piston?.notes?.trim() || undefined],
        [
          "Seal type",
          shock?.seal?.type === "o-ring"
            ? "O-ring"
            : shock?.seal?.type === "x-ring"
              ? "X-ring"
              : undefined,
        ],
        ["Seal description", shock?.seal?.description?.trim() || undefined],
      ],
    });
  }
  const knuckle = data.front_steering_knuckle;
  sections.push({
    title: "Front steering knuckle",
    values: [
      [
        "Manufacturer",
        knuckle?.manufacturer_id
          ? manufacturerLabel(knuckle.manufacturer_id, knuckleManufacturer)
          : undefined,
        knuckle?.manufacturer_id?.toLowerCase(),
      ],
      ["Part number / description", knuckle?.description?.trim() || undefined],
    ],
  });
  const differential = data.rear_differential;
  sections.push({
    title: "Rear differential",
    values: [
      [
        "Type",
        differential?.type ? differentialLabels[differential.type] : undefined,
      ],
      [
        "Manufacturer",
        differential?.manufacturer_id
          ? manufacturerLabel(
              differential.manufacturer_id,
              differentialManufacturer,
            )
          : undefined,
        differential?.manufacturer_id?.toLowerCase(),
      ],
      ["Model", differential?.model?.trim() || undefined],
      ["Tuning notes", differential?.tuning_notes?.trim() || undefined],
    ],
  });
  sections.push({
    title: "Electronics",
    values: (["motor", "esc", "servo", "gyro", "radio"] as const).map((key) => [
      key === "esc" ? "ESC" : key.charAt(0).toUpperCase() + key.slice(1),
      data.electronics?.[key],
    ]),
  });
  return sections;
}
