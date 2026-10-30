import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { brandsOptions } from "../../chassis/queries";
import { Button } from "../../../shared/components/Button";
import { componentSpecs, hasValue, matchesPath, valueAt } from "./presentation";
import { useEditorPresentation } from "./editorPresentation";
import { setupToForm } from "./serialization";
import type { SetupFormValues } from "./formSchema";

const labels: Record<string, string> = {
  manufacturerId: "Manufacturer",
  manufacturer: "Manufacturer",
  model: "Model",
  description: "Description",
  configurationNotes: "Configuration",
  tuningNotes: "Tuning",
  front_mm: "Ahead (mm)",
  rear_mm: "Behind (mm)",
  hexOffset: "Offset (mm)",
  offset: "Offset (mm)",
  length_mm: "Length (mm)",
  name: "Link",
  pistonHoles: "Holes",
  pistonDiameter: "Hole diameter (mm)",
  pistonNotes: "Notes",
  sealType: "Seal",
  sealDescription: "Description",
  oil_cst: "Oil (cSt)",
  springManufacturer: "Spring manufacturer",
  springColor: "Spring color",
};
export function ComponentCard({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const spec = componentSpecs.find((c) => c.id === id)!;
  const {
    control,
    getValues,
    setValue,
    clearErrors,
    getFieldState,
    formState,
  } = useFormContext<SetupFormValues>();
  useWatch({ control, name: spec.paths });
  const presentation = useEditorPresentation();
  const [confirm, setConfirm] = useState(false),
    [generation, setGeneration] = useState(0);
  const opener = useRef<HTMLButtonElement | null>(null);
  const removalTrigger = useRef<HTMLButtonElement | null>(null);
  const brands = useQuery({ ...brandsOptions, enabled: false });
  const values = getValues();
  const configured = spec.paths.some((path) => hasValue(valueAt(values, path)));
  const expanded = !!presentation.open[id];
  const mounted = id in presentation.open;
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded) {
      const target =
        editor.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        editor.current?.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)',
        );
      target?.focus();
    }
  }, [expanded]);
  const dirty = spec.paths.some(
    (path) => getFieldState(path, formState).isDirty,
  );
  const errors = presentation.issues.filter((issue) =>
    spec.paths.some((path) => matchesPath(issue.path, path)),
  );
  const displayNames = new Map<string, string>(
    brands.data?.map((brand) => [brand.id.toLowerCase(), brand.name]),
  );
  const collect = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if ("id" in value && "name" in value)
      displayNames.set(String(value.id).toLowerCase(), String(value.name));
    else Object.values(value).forEach(collect);
  };
  const setup = presentation.setup;
  collect(setup?.front_steering_knuckle_manufacturer);
  collect(setup?.rear_differential_manufacturer);
  collect(setup?.lower_arm_mount_manufacturers);
  collect(setup?.running_gear_manufacturers);
  const summarize = (
    value: unknown,
    key: string,
  ): { label: string; value: string }[] => {
    if (!hasValue(value)) return [];
    if (typeof value === "object" && value !== null)
      return Object.entries(value).flatMap(([key, v]) => summarize(v, key));
    const text = String(value).trim();
    return [
      {
        label: labels[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
        value:
          key === "manufacturerId"
            ? (displayNames.get(text.toLowerCase()) ??
              "Saved manufacturer (name unavailable)")
            : text,
      },
    ];
  };
  const summary = spec.paths.flatMap((path) =>
    summarize(valueAt(values, path), path.split(".").at(-1)!),
  );
  const open = () => {
    if (id.endsWith("-spacing") && !getValues(spec.paths[0]!))
      setValue(spec.paths[0]!, { front_mm: "", rear_mm: "" } as never);
    presentation.setOpen(id, true);
  };
  const close = () => {
    presentation.setOpen(id, false);
    requestAnimationFrame(() => opener.current?.focus());
  };
  const done = () => {
    if (presentation.validate(spec.paths)) close();
  };
  const requestRemove = () => {
    if (configured) setConfirm(true);
    else clear();
  };
  const clear = () => {
    const defaults = setupToForm();
    for (const path of spec.paths) {
      setValue(path, structuredClone(valueAt(defaults, path)) as never, {
        shouldDirty: true,
      });
      clearErrors(path);
    }
    presentation.validate(spec.paths);
    presentation.remove(id);
    setConfirm(false);
    setGeneration((n) => n + 1);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          `[data-add-section="${spec.section}"]`,
        )
        ?.focus();
    });
  };
  const confirmation = confirm && (
    <div
      role="group"
      aria-label={`Remove ${spec.label}?`}
      className="inline-confirmation"
    >
      <p>Clear only {spec.label}? Save setup to persist this removal.</p>
      <Button
        type="button"
        autoFocus
        onClick={() => {
          setConfirm(false);
          removalTrigger.current?.focus();
        }}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="subdued-destructive"
        onClick={clear}
      >
        Confirm remove {spec.label}
      </Button>
    </div>
  );
  if (!configured && !expanded && !mounted && !errors.length) return null;
  return (
    <section
      className="component-card compact-component"
      aria-label={spec.label}
      data-component={id}
    >
      <div className="component-preview" hidden={expanded}>
        <div className="component-heading">
          <h3>{spec.label}</h3>
          <span className="component-edit-hint" aria-hidden="true">
            Edit ↗
          </span>
        </div>
        {dirty && <span className="component-status">Unsaved changes</span>}
        {errors.length > 0 && (
          <span role="status" className="component-status">
            {errors.length} errors
          </span>
        )}
        {!expanded && (
          <div className="component-summary">
            {configured ? (
              <dl className="component-summary-rows">
                {summary.map((row, index) => (
                  <div key={index}>
                    <dt>{row.label}: </dt>
                    <dd title={row.value}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              "Not added"
            )}
          </div>
        )}
        <button
          ref={opener}
          type="button"
          className="component-edit-target"
          aria-label={`Edit ${spec.label}`}
          aria-expanded={expanded}
          onClick={open}
        />
      </div>
      <Button
        type="button"
        className="component-remove-icon"
        ref={removalTrigger}
        aria-label={`Remove ${spec.label}`}
        title={`Remove ${spec.label}`}
        onClick={requestRemove}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </Button>
      {confirmation}
      <div ref={editor} hidden={!expanded} className="component-editor">
        {(expanded || mounted) && <div key={generation}>{children}</div>}
        <p className="component-help">Changes are saved with the setup.</p>
        <div className="component-editor-actions">
          <Button type="button" onClick={done}>
            Done {spec.label}
          </Button>
        </div>
      </div>
    </section>
  );
}
