import { useRef, useState, type ReactNode } from "react";
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
  const [mounted, setMounted] = useState(false),
    [confirm, setConfirm] = useState(false),
    [generation, setGeneration] = useState(0);
  const opener = useRef<HTMLButtonElement | null>(null);
  const removalTrigger = useRef<HTMLButtonElement | null>(null);
  const brands = useQuery({ ...brandsOptions, enabled: false });
  const values = getValues();
  const configured = spec.paths.some((path) => hasValue(valueAt(values, path)));
  const expanded = !!presentation.open[id];
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
        label:
          labels[key] ??
          (setup ? key.charAt(0).toUpperCase() + key.slice(1) : key),
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
    setMounted(true);
    presentation.setOpen(id, true);
  };
  const close = () => {
    setMounted(true);
    presentation.setOpen(id, false);
    requestAnimationFrame(() => opener.current?.focus());
  };
  const done = () => {
    setMounted(true);
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
    presentation.setOpen(id, false);
    presentation.setAdded(id, false);
    setConfirm(false);
    setMounted(false);
    setGeneration((n) => n + 1);
    requestAnimationFrame(() => {
      if (setup)
        document
          .querySelector<HTMLButtonElement>(
            `[data-add-section="${spec.section}"]`,
          )
          ?.focus();
      else opener.current?.focus();
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
        variant={setup ? "secondary" : "danger"}
        className={setup ? "subdued-destructive" : undefined}
        onClick={clear}
      >
        Confirm remove {spec.label}
      </Button>
    </div>
  );
  if (setup) {
    if (
      !configured &&
      !expanded &&
      !mounted &&
      !presentation.added[id] &&
      !errors.length
    )
      return null;
    return (
      <section
        className="component-card compact-component"
        aria-label={spec.label}
        data-component={id}
      >
        <div className="component-preview">
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
            autoFocus={!!presentation.added[id] && !mounted}
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
            <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
          </svg>
        </Button>
        {confirmation}
        <div hidden={!expanded} className="component-editor">
          {(expanded || mounted || presentation.added[id]) && (
            <div key={generation}>{children}</div>
          )}
          <p className="component-help">
            Close retains your draft. Done checks this component. Save setup
            saves all sections.
          </p>
          <div className="component-editor-actions">
            <Button type="button" onClick={close}>
              Close {spec.label} editor
            </Button>
            <Button type="button" onClick={done}>
              Done {spec.label}
            </Button>
          </div>
        </div>
      </section>
    );
  }
  if (!configured && !expanded && !mounted && !dirty && !errors.length)
    return (
      <section
        className="component-card component-add"
        aria-label={spec.label}
        data-component={id}
      >
        <Button ref={opener} type="button" aria-expanded={false} onClick={open}>
          Add component: {spec.label}
        </Button>
      </section>
    );
  return (
    <section
      className="component-card"
      aria-label={spec.label}
      data-component={id}
    >
      <div className="component-heading">
        <h3>{spec.label}</h3>
        {dirty && <span>Unsaved changes</span>}
        {errors.length > 0 && <span role="status">{errors.length} errors</span>}
      </div>
      {!expanded && (
        <div className="component-summary">
          {configured
            ? summary
                .map(
                  (row) =>
                    `${row.label}: ${row.value.length > 120 ? row.value.slice(0, 120) + "…" : row.value}`,
                )
                .join(" · ")
            : "Not added"}
        </div>
      )}
      <div className="component-actions">
        <Button
          ref={opener}
          type="button"
          aria-expanded={expanded}
          onClick={open}
        >
          {configured || mounted ? "Edit" : "Add component:"} {spec.label}
        </Button>
        {(configured || expanded || mounted) && (
          <Button
            type="button"
            variant="danger"
            ref={removalTrigger}
            onClick={requestRemove}
          >
            Remove {spec.label}
          </Button>
        )}
      </div>
      {confirmation}
      <div hidden={!expanded} className="component-editor">
        {(expanded || mounted) && <div key={generation}>{children}</div>}
        <p>Done closes this editor. Save setup saves your changes.</p>
        <Button type="button" onClick={done}>
          Done {spec.label}
        </Button>
      </div>
    </section>
  );
}
