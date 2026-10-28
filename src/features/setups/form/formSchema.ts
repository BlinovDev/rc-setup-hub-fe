import { standardLinks } from "../suspensionLinks";
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
const spacerTotal = optionalMeasurement(
  parseArmSpacingNumber,
  "Enter a finite spacer total greater than or equal to zero.",
);
const armSpacing = z.object({ front_mm: spacerTotal, rear_mm: spacerTotal });
const length = z
  .string()
  .refine(
    (value) => validNumber(value, true, false, parseSuspensionNumber),
    "Enter a finite length greater than zero.",
  );
const axle = z
  .object({
    upper_arm_length_mm: length,
    lower_arm_length_mm: length,
    steering_tie_rod_length_mm: length,
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
          length_mm: z.string(),
          // Form-only provenance for the unique original legacy row. New custom
          // rows never acquire this marker through user-entered names.
          legacyStandard: z
            .object({
              field: z.enum([
                "upper_arm_length_mm",
                "lower_arm_length_mm",
                "steering_tie_rod_length_mm",
              ]),
              value: z.string(),
            })
            .optional(),
        }),
      )
      .max(100, "Use at most 100 links."),
  })
  .superRefine((value, context) => {
    value.link_lengths.forEach((link, index) => {
      const original = link.legacyStandard;
      const mapped = original && original.value === link.length_mm;
      // The visible fixed input validates mapped measurements and replacements.
      // Avoid duplicate errors on an uneditable source row; custom rows keep
      // their existing positive-length validation.
      if (!mapped && !length.safeParse(link.length_mm).success)
        context.addIssue({
          code: "custom",
          path: ["link_lengths", index, "length_mm"],
          message: "Enter a finite length greater than zero.",
        });
    });
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
    rear: axle.refine(
      (value) => value.steering_tie_rod_length_mm.trim() === "",
      {
        message: "Steering tie rod length is front only.",
        path: ["steering_tie_rod_length_mm"],
      },
    ),
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
  .superRefine((values, context) => {
    for (const side of ["front", "rear"] as const) {
      const value = values[side];
      for (const standard of standardLinks(side)) {
        const originalIndex = value.link_lengths.findIndex(
          (link) => link.legacyStandard?.field === standard.field,
        );
        const original =
          value.link_lengths[originalIndex]?.legacyStandard?.value;
        if (
          !value[standard.field].trim() &&
          (original === undefined || original === value[standard.field])
        )
          continue;
        const rows = value.link_lengths.flatMap((link, index) =>
          link.name.trim() === standard.name ? [index] : [],
        );
        if (
          !rows.length ||
          (rows.length === 1 &&
            rows[0] === originalIndex &&
            value.link_lengths[originalIndex]?.length_mm === original)
        )
          continue;
        context.addIssue({
          code: "custom",
          path: [side, "link_lengths", rows[rows.length - 1]!, "name"],
          message: `Rename this custom link before setting the standard ${standard.label.toLowerCase()} length.`,
        });
      }
    }
  })
  .refine(
    (value) =>
      !value.changeChassis ||
      value.selection.brandId === null ||
      value.selection.modelId !== null,
    { message: "Select a model for the chosen brand.", path: ["selection"] },
  );
export type SetupFormValues = z.infer<typeof setupFormSchema>;
