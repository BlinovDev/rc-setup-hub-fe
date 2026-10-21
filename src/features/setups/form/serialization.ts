import type { components } from "../../../api/generated/schema";
import {
  parseOptionalNumber,
  parsePistonHoles,
  parsePistonDiameter,
  parseArmSpacingNumber,
  parseSuspensionNumber,
  type SetupFormValues,
} from "./formSchema";

type Schemas = components["schemas"];
const optionalText = (value: string) =>
  value.trim() === "" ? undefined : value.trim();
const numberInput = (value: number | null | undefined) =>
  value == null ? "" : String(value);

export function setupToForm(setup?: Schemas["Setup"]): SetupFormValues {
  const spacing = (value?: Schemas["ArmSpacing"] | null) =>
    value == null || (value.front_mm == null && value.rear_mm == null)
      ? undefined
      : {
          front_mm: numberInput(value.front_mm),
          rear_mm: numberInput(value.rear_mm),
        };
  const axle = (value?: Schemas["AxleSuspension"] | null) => ({
    lowerArmMount: {
      manufacturerId: value?.lower_arm_mount?.manufacturer_id ?? null,
      model: value?.lower_arm_mount?.model ?? "",
      configurationNotes: value?.lower_arm_mount?.configuration_notes ?? "",
    },
    top_arm_spacing: spacing(value?.top_arm_spacing),
    lower_arm_spacing: spacing(value?.lower_arm_spacing),
    camber_deg: numberInput(value?.camber_deg),
    caster_deg: numberInput(value?.caster_deg),
    toe_deg: numberInput(value?.toe_deg),
    link_lengths: (value?.link_lengths ?? []).map((link) => ({
      name: link.name,
      length_mm: String(link.length_mm),
    })),
  });
  const shock = (
    value?: Schemas["Shock"] | null,
  ): SetupFormValues["frontShock"] => ({
    pistonHoles: numberInput(value?.piston?.holes),
    pistonDiameter: numberInput(value?.piston?.hole_diameter_mm),
    pistonNotes: value?.piston?.notes ?? "",
    sealType: value?.seal?.type ?? "",
    sealDescription: value?.seal?.description ?? "",
    manufacturer: value?.manufacturer ?? "",
    model: value?.model ?? "",
    springManufacturer: value?.spring?.manufacturer ?? "",
    springColor: value?.spring?.color ?? "",
    oil_cst: numberInput(value?.oil_cst),
  });
  return {
    title: setup?.title ?? "",
    visibility: setup?.visibility ?? "private",
    notes: setup?.notes ?? "",
    changeChassis: !setup,
    selection: { brandId: null, modelId: null },
    rearDifferential: {
      type: setup?.data.rear_differential?.type ?? "",
      manufacturerId: setup?.data.rear_differential?.manufacturer_id ?? null,
      model: setup?.data.rear_differential?.model ?? "",
      tuningNotes: setup?.data.rear_differential?.tuning_notes ?? "",
    },
    front: axle(setup?.data.suspension?.front),
    rear: axle(setup?.data.suspension?.rear),
    frontShock: shock(setup?.data.shocks?.front),
    rearShock: shock(setup?.data.shocks?.rear),
    electronics: {
      motor: setup?.data.electronics?.motor ?? "",
      esc: setup?.data.electronics?.esc ?? "",
      servo: setup?.data.electronics?.servo ?? "",
      gyro: setup?.data.electronics?.gyro ?? "",
      radio: setup?.data.electronics?.radio ?? "",
    },
  };
}
export function serializeData(values: SetupFormValues): Schemas["SetupDataV1"] {
  function axle(
    value: SetupFormValues["front"],
  ): Schemas["AxleSuspension"] | undefined {
    const result: Schemas["AxleSuspension"] = {};
    const mount: Schemas["LowerArmMount"] = {};
    if (value.lowerArmMount.manufacturerId !== null)
      mount.manufacturer_id = value.lowerArmMount.manufacturerId;
    const model = optionalText(value.lowerArmMount.model),
      notes = optionalText(value.lowerArmMount.configurationNotes);
    if (model !== undefined) mount.model = model;
    if (notes !== undefined) mount.configuration_notes = notes;
    if (Object.keys(mount).length) result.lower_arm_mount = mount;
    for (const arm of ["top_arm_spacing", "lower_arm_spacing"] as const) {
      const block = value[arm];
      if (!block) continue;
      const totals: Schemas["ArmSpacing"] = {};
      for (const position of ["front_mm", "rear_mm"] as const) {
        const number = parseArmSpacingNumber(block[position]);
        if (number !== undefined) totals[position] = number;
      }
      if (Object.keys(totals).length) result[arm] = totals;
    }
    for (const key of ["camber_deg", "caster_deg", "toe_deg"] as const) {
      const number = parseSuspensionNumber(value[key]);
      if (number !== undefined) result[key] = number;
    }
    if (value.link_lengths.length)
      result.link_lengths = value.link_lengths.map((link) => {
        const length = parseSuspensionNumber(link.length_mm);
        if (length === undefined || length <= 0)
          throw new Error("Enter a finite length greater than zero.");
        return { name: link.name.trim(), length_mm: length };
      });
    return Object.keys(result).length ? result : undefined;
  }
  function shock(
    value: SetupFormValues["frontShock"],
  ): Schemas["Shock"] | undefined {
    const result: Schemas["Shock"] = {};
    const piston: Schemas["ShockPiston"] = {};
    const holes = parsePistonHoles(value.pistonHoles);
    const diameter = parsePistonDiameter(value.pistonDiameter);
    const notes = optionalText(value.pistonNotes);
    if (holes !== undefined) piston.holes = holes;
    if (diameter !== undefined) piston.hole_diameter_mm = diameter;
    if (notes !== undefined) piston.notes = notes;
    if (Object.keys(piston).length) result.piston = piston;
    const seal: Schemas["ShockSeal"] = {};
    if (value.sealType) seal.type = value.sealType;
    const description = optionalText(value.sealDescription);
    if (description !== undefined) seal.description = description;
    if (Object.keys(seal).length) result.seal = seal;
    const manufacturer = optionalText(value.manufacturer),
      model = optionalText(value.model);
    if (manufacturer !== undefined) result.manufacturer = manufacturer;
    if (model !== undefined) result.model = model;
    const spring: Schemas["Spring"] = {};
    const springManufacturer = optionalText(value.springManufacturer),
      springColor = optionalText(value.springColor);
    if (springManufacturer !== undefined)
      spring.manufacturer = springManufacturer;
    if (springColor !== undefined) spring.color = springColor;
    if (Object.keys(spring).length) result.spring = spring;
    const oil = parseOptionalNumber(value.oil_cst);
    if (oil !== undefined) result.oil_cst = oil;
    return Object.keys(result).length ? result : undefined;
  }
  const data: Schemas["SetupDataV1"] = {};
  const differential: Schemas["RearDifferential"] = {};
  const diff = values.rearDifferential;
  if (diff.type) differential.type = diff.type;
  if (diff.manufacturerId !== null)
    differential.manufacturer_id = diff.manufacturerId;
  const model = optionalText(diff.model),
    tuning = optionalText(diff.tuningNotes);
  if (model !== undefined) differential.model = model;
  if (tuning !== undefined) differential.tuning_notes = tuning;
  if (Object.keys(differential).length) data.rear_differential = differential;
  const suspension: Schemas["Suspension"] = {},
    shocks: Schemas["Shocks"] = {},
    electronics: Schemas["Electronics"] = {};
  const front = axle(values.front),
    rear = axle(values.rear),
    frontShock = shock(values.frontShock),
    rearShock = shock(values.rearShock);
  if (front) suspension.front = front;
  if (rear) suspension.rear = rear;
  if (frontShock) shocks.front = frontShock;
  if (rearShock) shocks.rear = rearShock;
  for (const key of ["motor", "esc", "servo", "gyro", "radio"] as const) {
    const value = optionalText(values.electronics[key]);
    if (value !== undefined) electronics[key] = value;
  }
  if (Object.keys(suspension).length) data.suspension = suspension;
  if (Object.keys(shocks).length) data.shocks = shocks;
  if (Object.keys(electronics).length) data.electronics = electronics;
  return data;
}
function common(values: SetupFormValues) {
  return {
    title: values.title.trim(),
    visibility: values.visibility,
    notes: optionalText(values.notes) ?? null,
    data: serializeData(values),
  };
}
export function serializeCreate(
  values: SetupFormValues,
): Schemas["CreateSetup"] {
  if (values.selection.brandId !== null && values.selection.modelId === null)
    throw new Error("Select a model.");
  return {
    ...common(values),
    chassis_model_id:
      values.selection.brandId === null ? null : values.selection.modelId,
  };
}
export function serializePatch(values: SetupFormValues): Schemas["PatchSetup"] {
  const body: Schemas["PatchSetup"] = common(values);
  if (values.changeChassis) {
    if (values.selection.brandId !== null && values.selection.modelId === null)
      throw new Error("Select a model.");
    body.chassis_model_id =
      values.selection.brandId === null ? null : values.selection.modelId;
  }
  return body;
}
