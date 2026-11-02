import { useFormContext, useWatch } from "react-hook-form";
import type { ReactNode, Ref } from "react";
import { componentSpecs, hasValue, valueAt } from "./presentation";
import type { SetupFormValues } from "./formSchema";

export function OptionalComponentDisclosure({
  id,
  reference,
  children,
}: {
  id: string;
  reference?: Ref<HTMLDetailsElement>;
  children: ReactNode;
}) {
  const spec = componentSpecs.find((component) => component.id === id)!;
  const { control, getValues } = useFormContext<SetupFormValues>();
  useWatch({ control, name: spec.paths });
  const configured = spec.paths.some((path) =>
    hasValue(valueAt(getValues(), path)),
  );

  return (
    <details
      ref={reference}
      className="optional-component-disclosure"
      data-component-disclosure={id}
    >
      <summary>
        <span>{spec.label}</span>
        <span className="optional-component-status">
          {configured ? "Configured" : "Optional"}
        </span>
      </summary>
      {children}
    </details>
  );
}
