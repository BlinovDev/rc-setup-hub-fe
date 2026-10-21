import type { components } from "../../api/generated/schema";

type DifferentialType = NonNullable<
  components["schemas"]["RearDifferential"]["type"]
>;
export const differentialTypes = [
  "gear",
  "lsd",
  "ball",
  "spool",
] as const satisfies readonly DifferentialType[];
export const differentialLabels: Record<DifferentialType, string> = {
  gear: "Gear",
  lsd: "LSD",
  ball: "Ball",
  spool: "Spool",
};

export function manufacturerLabel(
  id: string | null | undefined,
  display?: components["schemas"]["DifferentialManufacturer"] | null,
) {
  if (!id) return "Not specified";
  return display?.id.toLowerCase() === id.toLowerCase()
    ? display.name
    : "Saved manufacturer (name unavailable)";
}
