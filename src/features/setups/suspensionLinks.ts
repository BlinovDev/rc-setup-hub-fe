import type { components } from "../../api/generated/schema";
export type SuspensionSide = "front" | "rear";
export const standardLinks = (side: SuspensionSide) => [
  {
    name: "upper_arm",
    field: "upper_arm_length_mm" as const,
    label: "Upper arm",
  },
  {
    name: "lower_arm",
    field: "lower_arm_length_mm" as const,
    label: "Lower arm",
  },
  ...(side === "front"
    ? [
        {
          name: "steering_tie_rod",
          field: "steering_tie_rod_length_mm" as const,
          label: "Steering tie rod",
        },
      ]
    : []),
];
// Only unique, exact historical keys can represent a standard field. All other
// names and duplicates remain ordered custom data, with no inferred aliases.
export function standardLinkIndices(
  links: readonly { name: string }[],
  side: SuspensionSide,
) {
  const result = new Map<string, number>();
  for (const standard of standardLinks(side)) {
    const matches = links.flatMap((link, index) =>
      link.name === standard.name ? [index] : [],
    );
    if (matches.length === 1) result.set(standard.name, matches[0]!);
  }
  return result;
}
export function suspensionLengths(
  value: components["schemas"]["AxleSuspension"] | null | undefined,
  side: SuspensionSide,
) {
  const indices = standardLinkIndices(value?.link_lengths ?? [], side);
  return standardLinks(side).map((standard) => {
    const index =
      value?.[standard.field] == null ? indices.get(standard.name) : undefined;
    return {
      ...standard,
      index,
      value:
        value?.[standard.field] ??
        (index === undefined
          ? undefined
          : value?.link_lengths?.[index]?.length_mm),
    };
  });
}
export type SuspensionView = "angles" | "links";
export function preferredSuspensionView(value: {
  camber_deg: string;
  caster_deg: string;
  toe_deg: string;
  upper_arm_length_mm?: string;
  lower_arm_length_mm?: string;
  steering_tie_rod_length_mm?: string;
  link_lengths: readonly { name: string }[];
}): SuspensionView {
  const angles = [value.camber_deg, value.caster_deg, value.toe_deg].some(
    (v) => v.trim() !== "",
  );
  const lengths =
    value.link_lengths.length > 0 ||
    [
      value.upper_arm_length_mm,
      value.lower_arm_length_mm,
      value.steering_tie_rod_length_mm,
    ].some((v) => v?.trim());
  return angles || !lengths ? "angles" : "links";
}
