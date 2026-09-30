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
}: {
  name: FieldPathByValue<SetupFormValues, string>;
  label: string;
  numeric?: boolean;
  multiline?: boolean;
}) {
  const id = useId();
  const { register, getFieldState, formState } =
    useFormContext<SetupFormValues>();
  const error = getFieldState(name, formState).error;
  const props = {
    id,
    className: "mt-1 min-h-11 w-full rounded border p-2",
    "aria-label": label,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-error` : undefined,
    ...register(name),
  };
  return (
    <div>
      <label htmlFor={id}>
        {numeric
          ? label.replace(/^(Front|Rear) /, "").replace("(degrees)", "(°)")
          : label}
      </label>
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
      {error && (
        <InlineNotice id={`${id}-error`} tone="error">
          {error.message}
        </InlineNotice>
      )}
    </div>
  );
}
