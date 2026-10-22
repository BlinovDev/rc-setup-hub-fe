import { z } from "zod";
import { differentialTypes } from "../differential";

export function parseOptionalNumber(input: string): number | undefined {
  const value = input.trim();
  if (value === "") return undefined;
  const number = Number(value);
  if (
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ||
    !Number.isFinite(number)
  ) {
    throw new Error("Enter a finite number.");
  }
  return number;
}

// Locale keyboards can insert a comma. Keep the form text untouched and
// normalize only suspension measurements at the validation/request boundary.
export function parseSuspensionNumber(input: string): number | undefined {
  return parseOptionalNumber(input.replace(",", "."));
}

function validNumber(
  value: string,
  positive: boolean,
  required: boolean,
  parse = parseOptionalNumber,
) {
  try {
    const number = parse(value);
    return number === undefined ? !required : !positive || number > 0;
  } catch {
    return false;
  }
}
const text = (max: number, required = false) =>
  z
    .string()
    .refine(
      (value) => !value.includes("\0"),
      "Null characters are not allowed.",
    )
    .refine(
      (value) => Array.from(value.trim()).length <= max,
      `Use at most ${max} characters.`,
    )
    .refine(
      (value) => !required || value.trim().length > 0,
      "This field is required.",
    );
const angle = z
  .string()
  .refine(
    (value) => validNumber(value, false, false, parseSuspensionNumber),
    "Enter a finite number.",
  );
const oil = z
  .string()
  .refine(
    (value) => validNumber(value, true, false),
    "Enter a finite number greater than zero.",
  );
export function parseArmSpacingNumber(input: string): number | undefined {
  const value = parseSuspensionNumber(input);
  if (value !== undefined && value < 0)
    throw new Error(
      "Enter a finite spacer total greater than or equal to zero.",
    );
  return value;
}
const spacerTotal = z.string().refine((value) => {
  try {
    parseArmSpacingNumber(value);
    return true;
  } catch {
    return false;
  }
}, "Enter a finite spacer total greater than or equal to zero.");
const armSpacing = z.object({ front_mm: spacerTotal, rear_mm: spacerTotal });
const axle = z.object({
  lowerArmMount: z.object({
    manufacturerId: z.string().uuid().nullable(),
    model: text(200),
    configurationNotes: text(10000),
  }),
  top_arm_spacing: armSpacing.optional(),
  lower_arm_spacing: armSpacing.optional(),
  camber_deg: angle,
  caster_deg: angle,
  toe_deg: angle,
  link_lengths: z
    .array(
      z.object({
        name: text(200, true),
        length_mm: z
          .string()
          .refine(
            (value) => validNumber(value, true, true, parseSuspensionNumber),
            "Enter a finite length greater than zero.",
          ),
      }),
    )
    .max(100, "Use at most 100 links."),
});
export function parsePistonHoles(input: string): number | undefined {
  const value = input.trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 2147483647)
    throw new Error("Enter a whole hole count from 1 to 2147483647.");
  return Number(value);
}
export function parsePistonDiameter(input: string): number | undefined {
  const value = parseSuspensionNumber(input);
  if (value !== undefined && value <= 0)
    throw new Error("Enter a finite diameter greater than zero.");
  return value;
}
const optionalMeasurement = (
  parse: (value: string) => number | undefined,
  message: string,
) =>
  z.string().refine((value) => {
    try {
      parse(value);
      return true;
    } catch {
      return false;
    }
  }, message);
export function parseWheelOffset(input: string): number | undefined {
  const value = input.trim();
  if (!value) return undefined;
  if (
    !/^[+-]?\d+$/.test(value) ||
    Number(value) < -2147483648 ||
    Number(value) > 2147483647
  )
    throw new Error("Enter whole millimetres from -2147483648 to 2147483647.");
  return Number(value);
}
const runningGearAxle = z.object({
  hexOffset: angle,
  wheel: z.object({
    manufacturerId: z.string().uuid().nullable(),
    model: text(200),
    offset: optionalMeasurement(
      parseWheelOffset,
      "Enter whole millimetres from -2147483648 to 2147483647.",
    ),
  }),
  tire: z.object({
    manufacturerId: z.string().uuid().nullable(),
    model: text(200),
  }),
});
const shock = z.object({
  pistonHoles: optionalMeasurement(
    parsePistonHoles,
    "Enter a whole hole count from 1 to 2147483647.",
  ),
  pistonDiameter: optionalMeasurement(
    parsePistonDiameter,
    "Enter a finite diameter greater than zero.",
  ),
  pistonNotes: text(10000),
  sealType: z.enum(["", "o-ring", "x-ring"]),
  sealDescription: text(200),
  manufacturer: text(200),
  model: text(200),
  springManufacturer: text(200),
  springColor: text(200),
  oil_cst: oil,
});
export const setupFormSchema = z
  .object({
    title: text(150, true),
    visibility: z.enum(["public", "friends", "private"]),
    notes: text(10000),
    changeChassis: z.boolean(),
    selection: z.object({
      brandId: z.string().uuid().nullable(),
      modelId: z.string().uuid().nullable(),
    }),
    frontSteeringKnuckle: z.object({
      manufacturerId: z.string().uuid().nullable(),
      description: text(200),
    }),
    rearDifferential: z.object({
      type: z.enum(["", ...differentialTypes]),
      manufacturerId: z.string().uuid().nullable(),
      model: text(200),
      tuningNotes: text(10000),
    }),
    runningGear: z.object({ front: runningGearAxle, rear: runningGearAxle }),
    front: axle,
    rear: axle,
    frontShock: shock,
    rearShock: shock,
    electronics: z.object({
      motor: text(200),
      esc: text(200),
      servo: text(200),
      gyro: text(200),
      radio: text(200),
    }),
  })
  .refine(
    (value) =>
      !value.changeChassis ||
      value.selection.brandId === null ||
      value.selection.modelId !== null,
    { message: "Select a model for the chosen brand.", path: ["selection"] },
  );
export type SetupFormValues = z.infer<typeof setupFormSchema>;
