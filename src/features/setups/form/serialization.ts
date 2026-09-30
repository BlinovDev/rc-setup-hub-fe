import type { components } from "../../../api/generated/schema";
import { parseOptionalNumber, type SetupFormValues } from "./formSchema";

type Schemas = components["schemas"];
const optionalText = (value: string) =>
  value.trim() === "" ? undefined : value.trim();
const numberInput = (value: number | null | undefined) =>
  value == null ? "" : String(value);

export function setupToForm(setup?: Schemas["Setup"]): SetupFormValues {
  const axle = (value?: Schemas["AxleSuspension"] | null) => ({
    camber_deg: numberInput(value?.camber_deg),
    caster_deg: numberInput(value?.caster_deg),
    toe_deg: numberInput(value?.toe_deg),
    link_lengths: (value?.link_lengths ?? []).map((link) => ({
      name: link.name,
      length_mm: String(link.length_mm),
    })),
  });
  const shock = (value?: Schemas["Shock"] | null) => ({
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
    for (const key of ["camber_deg", "caster_deg", "toe_deg"] as const) {
      const number = parseOptionalNumber(value[key]);
      if (number !== undefined) result[key] = number;
    }
    if (value.link_lengths.length)
      result.link_lengths = value.link_lengths.map((link) => ({
        name: link.name.trim(),
        length_mm: Number(link.length_mm),
      }));
    return Object.keys(result).length ? result : undefined;
  }
  function shock(
    value: SetupFormValues["frontShock"],
  ): Schemas["Shock"] | undefined {
    const result: Schemas["Shock"] = {};
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
