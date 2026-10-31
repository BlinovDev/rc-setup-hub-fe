import { InlineNotice } from "../../../shared/components/Feedback";
import { useId } from "react";
import { useFormContext, type FieldPathByValue } from "react-hook-form";
import type { SetupFormValues } from "./formSchema";

// Only setup-form string inputs; no application-wide form framework.
export function SetupField({
  name,
  label,
  numeric = false,
  multiline = false,
  required = false,
}: {
  name: FieldPathByValue<SetupFormValues, string | undefined>;
  label: string;
  numeric?: boolean;
  multiline?: boolean;
  required?: boolean;
}) {
  const id = useId();
  const { register, getFieldState, formState } =
    useFormContext<SetupFormValues>();
  const error = getFieldState(name, formState).error;
  const unitMatch = numeric ? /\s*\(([^()]*)\)$/.exec(label) : null;
  const visibleLabel = unitMatch ? label.slice(0, unitMatch.index) : label;
  const unit = unitMatch?.[1] === "degrees" ? "deg" : unitMatch?.[1];
  const props = {
    id,
    placeholder: " ",
    "aria-label": label,
    "aria-required": required || undefined,
    className: "setup-field-control",
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-error` : undefined,
    ...register(name),
  };
  return (
    <div className={`setup-field${unit ? " setup-field-has-unit" : ""}`}>
      {multiline ? (
        <textarea rows={4} {...props} />
      ) : (
        <input
          type="text"
          inputMode={numeric ? "decimal" : "text"}
          autoComplete={numeric ? "off" : undefined}
          {...props}
        />
      )}
      <label className="setup-field-label" htmlFor={id}>
        {visibleLabel}
      </label>
      {unit && (
        <span className="setup-field-unit" aria-hidden="true">
          {unit}
        </span>
      )}
      {required && <span className="setup-field-required">Required</span>}
      {error && (
        <InlineNotice id={`${id}-error`} tone="error">
          {error.message}
        </InlineNotice>
      )}
    </div>
  );
}
