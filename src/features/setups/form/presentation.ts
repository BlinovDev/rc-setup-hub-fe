import type { FieldPath } from "react-hook-form";
import type { SetupFormValues } from "./formSchema";
export const sections = [
  ["general", "General"],
  ["front", "Front"],
  ["rear", "Rear"],
  ["shocks", "Shocks"],
  ["wheels", "Wheels & tires"],
  ["electronics", "Electronics"],
] as const;
export type SectionId = (typeof sections)[number][0];
export type ComponentSpec = {
  id: string;
  section: SectionId;
  label: string;
  paths: FieldPath<SetupFormValues>[];
};
export const componentSpecs: ComponentSpec[] = [
  { id: "notes", section: "general", label: "Setup notes", paths: ["notes"] },
  {
    id: "knuckle",
    section: "front",
    label: "Front steering knuckle",
    paths: ["frontSteeringKnuckle"],
  },
  {
    id: "differential",
    section: "rear",
    label: "Rear differential",
    paths: ["rearDifferential"],
  },
  ...(["front", "rear"] as const).flatMap((side) => {
    const label = side === "front" ? "Front" : "Rear";
    return [
      {
        id: `${side}-mount`,
        section: side,
        label: `${label} lower arm mount`,
        paths: [`${side}.lowerArmMount`],
      },
      ...(["top", "lower"] as const).map((arm) => ({
        id: `${side}-${arm}-spacing`,
        section: side,
        label: `${label} ${arm} arm spacing`,
        paths: [`${side}.${arm}_arm_spacing`],
      })),
      {
        id: `${side}-links`,
        section: side,
        label: `${label} link lengths`,
        paths: [`${side}.link_lengths`],
      },
      {
        id: `${side}-shock`,
        section: "shocks",
        label: `${label} shock setup`,
        paths: [
          "manufacturer",
          "model",
          "springManufacturer",
          "springColor",
          "oil_cst",
          "pistonHoles",
          "pistonDiameter",
          "pistonNotes",
          "sealType",
          "sealDescription",
        ].map((key) => `${side}Shock.${key}`),
      },
      {
        id: `${side}-hex`,
        section: "wheels",
        label: `${label} hex`,
        paths: [`runningGear.${side}.hexOffset`],
      },
      ...(["wheel", "tire"] as const).map((part) => ({
        id: `${side}-${part}`,
        section: "wheels",
        label: `${label} ${part}`,
        paths: [`runningGear.${side}.${part}`],
      })),
    ] as ComponentSpec[];
  }),
  {
    id: "electronics",
    section: "electronics",
    label: "Electronics",
    paths: ["electronics"],
  },
];
export const matchesPath = (path: string, root: string) =>
  path === root || path.startsWith(root + ".");
export function componentForPath(path: string) {
  return componentSpecs.find((c) =>
    c.paths.some((root) => matchesPath(path, root)),
  );
}
export function sectionForPath(path: string): SectionId {
  const component = componentForPath(path);
  if (component) return component.section;
  if (path.startsWith("front.")) return "front";
  if (path.startsWith("rear.")) return "rear";
  return "general";
}
export function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "object") return Object.values(value).some(hasValue);
  return true; // Explicit numeric zero is configured.
}
export function valueAt(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (v, key) =>
        v != null && typeof v === "object" ? Reflect.get(v, key) : undefined,
      value,
    );
}
export function focusPath(root: HTMLFormElement | null, path: string) {
  const named = Array.from(
    root?.querySelectorAll<HTMLElement>("[name]") ?? [],
  ).find(
    (el) =>
      el.getAttribute("name") === path &&
      !el.closest("[hidden]") &&
      !el.hasAttribute("disabled"),
  );
  const destination =
    named ??
    Array.from(
      root?.querySelectorAll<HTMLElement>("[data-error-path]") ?? [],
    ).find((el) => el.dataset.errorPath === path);
  destination?.closest("details")?.setAttribute("open", "");
  destination?.focus();
  destination?.scrollIntoView?.({ block: "center" });
}

export function legacySection(hash: string): SectionId | undefined {
  const key = hash.replace(/^#/, "");
  if (key === "setup-general" || key === "setup-essentials") return "general";
  if (key === "setup-front" || key === "setup-front-knuckle") return "front";
  if (key === "setup-rear" || key === "setup-rear-differential") return "rear";
  if (key === "setup-front-shocks" || key === "setup-rear-shocks")
    return "shocks";
  if (key === "setup-front-running-gear" || key === "setup-rear-running-gear")
    return "wheels";
  if (key === "setup-electronics") return "electronics";
  return undefined;
}
