export type SuspensionSide = "front" | "rear";
export const standardLinks = (side: SuspensionSide) => [
  { name: "upper_arm", label: "Upper arm" },
  { name: "lower_arm", label: "Lower arm" },
  ...(side === "front"
    ? [{ name: "steering_tie_rod", label: "Steering tie rod" }]
    : []),
];
// Match established human-readable names, but never rewrite saved names/order.
// A duplicate match remains a separate custom row; no entries are merged.
export function standardLinkName(name: string, side: SuspensionSide) {
  const key = name
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
  if (["upper", "upper arm", "top arm"].includes(key)) return "upper_arm";
  if (["lower", "lower arm"].includes(key)) return "lower_arm";
  if (
    side === "front" &&
    ["steering tie rod", "tie rod", "steering rod"].includes(key)
  )
    return "steering_tie_rod";
  return undefined;
}
export function standardLinkIndices(
  links: readonly { name: string }[],
  side: SuspensionSide,
) {
  const result = new Map<string, number>();
  links.forEach((link, index) => {
    const key = standardLinkName(link.name, side);
    if (key && !result.has(key)) result.set(key, index);
  });
  return result;
}
export function linkLabel(name: string, side: SuspensionSide) {
  return (
    standardLinks(side).find(
      (link) => link.name === standardLinkName(name, side),
    )?.label ?? name.trim()
  );
}
export type SuspensionView = "angles" | "links";
export function preferredSuspensionView(value: {
  camber_deg: string;
  caster_deg: string;
  toe_deg: string;
  link_lengths: readonly { name: string }[];
}): SuspensionView {
  return [value.camber_deg, value.caster_deg, value.toe_deg].some(
    (v) => v.trim() !== "",
  ) || !value.link_lengths.length
    ? "angles"
    : "links";
}
