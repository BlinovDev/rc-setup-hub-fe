import type { components } from "../../../api/generated/schema";
import { LowerArmMountFields } from "./LowerArmMountFields";
import { Button } from "../../../shared/components/Button";
import { InlineNotice } from "../../../shared/components/Feedback";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useId, useRef, useState } from "react";
import type { SetupFormValues } from "./formSchema";
import { SetupField } from "./SetupField";
import { ComponentCard } from "./ComponentCard";
import { hasValue } from "./presentation";
export function SuspensionSection({
  side,
  setup,
}: {
  side: "front" | "rear";
  setup?: components["schemas"]["Setup"] | undefined;
}) {
  const { control, getValues, getFieldState, formState } =
    useFormContext<SetupFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${side}.link_lengths`,
  });
  const [confirm, setConfirm] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const errorId = useId();
  const aggregate = getFieldState(`${side}.link_lengths`, formState).error;
  const label = side === "front" ? "Front" : "Rear";
  return (
    <fieldset id={`setup-${side}`} className="space-y-4 rounded border p-4">
      <legend className="font-semibold">{label} suspension</legend>
      <div className="related-fields">
        {(["camber", "caster", "toe"] as const).map((key) => (
          <SetupField
            key={key}
            name={`${side}.${key}_deg`}
            label={`${label} ${key} (degrees)`}
            numeric
          />
        ))}
      </div>
      <ComponentCard id={`${side}-mount`}>
        <LowerArmMountFields side={side} setup={setup} />
      </ComponentCard>
      {(["top", "lower"] as const).map((arm) => (
        <ComponentCard key={arm} id={`${side}-${arm}-spacing`}>
          <fieldset className="space-y-3 rounded border p-3">
            <legend>
              {label} {arm} arm spacing
            </legend>
            <p>
              Totals ahead of and behind the arm, in vehicle direction;
              symmetric left and right.
            </p>
            <div className="related-fields">
              {(["front", "rear"] as const).map((position) => (
                <SetupField
                  key={position}
                  name={`${side}.${arm}_arm_spacing.${position}_mm`}
                  label={`${label} ${arm} arm — ${position === "front" ? "Front" : "Rear"} spacers (mm)`}
                  numeric
                />
              ))}
            </div>
          </fieldset>
        </ComponentCard>
      ))}
      <ComponentCard id={`${side}-links`}>
        <h3>{label} link lengths</h3>
        {aggregate?.message && (
          <InlineNotice tone="error" id={errorId}>
            {aggregate.message}
          </InlineNotice>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded border p-3">
            <h4>Link {index + 1}</h4>
            <div className="related-fields">
              <SetupField
                name={`${side}.link_lengths.${index}.name`}
                label={`${label} link ${index + 1} name`}
              />
              <SetupField
                name={`${side}.link_lengths.${index}.length_mm`}
                label={`${label} link ${index + 1} length (mm)`}
                numeric
              />
            </div>
            {confirm === field.id ? (
              <div
                className="inline-confirmation"
                role="group"
                aria-label={`Remove ${label.toLowerCase()} link ${index + 1}?`}
              >
                <Button
                  type="button"
                  autoFocus
                  onClick={() => {
                    setConfirm(null);
                    opener.current?.focus();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    remove(index);
                    setConfirm(null);
                  }}
                >
                  Confirm remove {label.toLowerCase()} link {index + 1}
                </Button>
              </div>
            ) : null}
            <Button
              type="button"
              onClick={(event) => {
                if (hasValue(getValues(`${side}.link_lengths.${index}`))) {
                  opener.current = event.currentTarget;
                  setConfirm(field.id);
                } else remove(index);
              }}
            >
              Remove {label.toLowerCase()} link {index + 1}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          data-error-path={`${side}.link_lengths`}
          aria-invalid={!!aggregate?.message}
          aria-describedby={aggregate?.message ? errorId : undefined}
          onClick={() => append({ name: "", length_mm: "" })}
        >
          Add {label.toLowerCase()} link
        </Button>
      </ComponentCard>
    </fieldset>
  );
}
