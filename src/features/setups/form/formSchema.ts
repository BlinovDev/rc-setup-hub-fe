import { z } from "zod";

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
const axle = z.object({
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
const shock = z.object({
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
