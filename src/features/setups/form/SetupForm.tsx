import { EditorPresentation, type FormIssue } from "./editorPresentation";
import { ComponentCard } from "./ComponentCard";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  sections,
  componentSpecs,
  sectionClearPaths,
  sectionClearDescription,
  valueAt,
  sectionForPath,
  focusPath,
  componentForPath,
  matchesPath,
  legacySection,
  type SectionId,
} from "./presentation";
import { SectionNavigation } from "./SectionNavigation";
import { Button } from "../../../shared/components/Button";
import {
  useForm,
  FormProvider,
  Controller,
  useWatch,
  type FieldPath,
} from "react-hook-form";
import type { components } from "../../../api/generated/schema";
import { ChassisSelector } from "../../chassis/ChassisSelector";
import { chassisLabel } from "../api";
import { setupFormSchema, type SetupFormValues } from "./formSchema";
import { setupToForm } from "./serialization";
import { SetupField } from "./SetupField";
import { SuspensionSection } from "./SuspensionSection";
import { ShockHardwareFields } from "./ShockHardwareFields";
import { FrontSteeringKnuckleSection } from "./FrontSteeringKnuckleSection";
import { RunningGearSection } from "./RunningGearSection";
import { RearDifferentialSection } from "./RearDifferentialSection";

export function SetupForm({
  setup,
  onSave,
  pending,
  blocked = false,
  onDirtyChange,
  onSectionViewChange,
  onSaved,
}: {
  setup?: components["schemas"]["Setup"];
  onSave: (values: SetupFormValues) => Promise<boolean | void>;
  pending: boolean;
  blocked?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSectionViewChange?: (editing: boolean) => void;
  onSaved?: () => void;
}) {
  const isEdit = !!setup;
  const form = useForm<SetupFormValues>({ defaultValues: setupToForm(setup) });
  const root = useRef<HTMLFormElement>(null);
  const saving = useRef(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const [sectionView, setSectionView] = useState(false);
  const [clearSection, setClearSection] = useState<SectionId | null>(null);
  const [sectionVersions, setSectionVersions] = useState<
    Partial<Record<SectionId, number>>
  >({});
  const clearTrigger = useRef<HTMLButtonElement>(null);
  function showSection(editing: boolean) {
    setSectionView(editing);
    onSectionViewChange?.(editing);
  }
  const [active, setActive] = useState<SectionId>("general");
  const [focusRequest, setFocusRequest] = useState<{
    section?: SectionId;
    path?: string;
  } | null>(null);
  useLayoutEffect(() => {
    if (focusRequest?.path) focusPath(root.current, focusRequest.path);
    else if (focusRequest?.section)
      document.getElementById("section-" + focusRequest.section)?.focus();
  }, [focusRequest]);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);
  function select(section: SectionId) {
    if (setup) showSection(true);
    setClearSection(null);
    setActive(section);
    setFocusRequest({ section });
  }
  function reveal(path: string) {
    if (setup) showSection(true);
    setActive(sectionForPath(path));
    const component = componentForPath(path);
    if (component)
      setOpened((current) => ({ ...current, [component.id]: true }));
    setFocusRequest({ path });
  }
  function validateComponent(paths: string[]) {
    const parsed = setupFormSchema.safeParse(form.getValues());
    const next: FormIssue[] = parsed.success
      ? []
      : parsed.error.issues
          .map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          }))
          .filter((issue) =>
            paths.some((root) => matchesPath(issue.path, root)),
          );
    for (const path of paths)
      form.clearErrors(path as FieldPath<SetupFormValues>);
    setIssues((old) => [
      ...old.filter(
        (issue) => !paths.some((root) => matchesPath(issue.path, root)),
      ),
      ...next,
    ]);
    next.forEach((issue) =>
      form.setError(issue.path as FieldPath<SetupFormValues>, {
        type: "validate",
        message: issue.message,
      }),
    );
    if (next[0]) reveal(next[0].path);
    return !next.length;
  }
  const counts: Partial<Record<SectionId, number>> = {};
  for (const issue of issues) {
    const section = sectionForPath(issue.path);
    counts[section] = (counts[section] ?? 0) + 1;
  }
  useEffect(() => {
    const followAnchor = () => {
      const section = legacySection(window.location.hash);
      if (!section) return;
      if (isEdit) onSectionViewChange?.(true);
      if (isEdit) setSectionView(true);
      setActive(section);
      const id =
        window.location.hash === "#setup-front-knuckle"
          ? "knuckle"
          : window.location.hash === "#setup-rear-differential"
            ? "differential"
            : undefined;
      if (id) setOpened((current) => ({ ...current, [id]: true }));
      setFocusRequest({ section });
    };
    followAnchor();
    window.addEventListener("hashchange", followAnchor);
    return () => window.removeEventListener("hashchange", followAnchor);
  }, [isEdit, onSectionViewChange]);
  const changeChassis = useWatch({
    control: form.control,
    name: "changeChassis",
  });
  const selectionError = form.formState.errors.selection;
  return (
    <FormProvider {...form}>
      <EditorPresentation.Provider
        value={{
          open: opened,
          setOpen: (id, open) => {
            if (setup && open) showSection(true);
            setOpened((current) => ({ ...current, [id]: open }));
          },
          issues,
          validate: validateComponent,
          setup,
          savedVersion,
        }}
      >
        <form
          ref={root}
          noValidate
          className="mt-6 space-y-6"
          onSubmit={async (event) => {
            event.preventDefault();
            const values = form.getValues();
            form.clearErrors();
            const parsed = setupFormSchema.safeParse(values);
            if (!parsed.success) {
              const next = parsed.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
              }));
              setIssues(next);
              next.forEach((issue) =>
                form.setError(issue.path as FieldPath<SetupFormValues>, {
                  type: "validate",
                  message: issue.message,
                }),
              );
              if (next[0]) reveal(next[0].path);
              return;
            }
            setIssues([]);
            if (!pending && !blocked && !saving.current) {
              saving.current = true;
              try {
                const saved = await onSave(parsed.data);
                if (saved === true) {
                  form.reset(form.getValues());
                  setSavedVersion((n) => n + 1);
                  onSaved?.();
                }
              } finally {
                saving.current = false;
              }
            }
          }}
        >
          <fieldset disabled={pending} className="space-y-6">
            <fieldset
              id="setup-essentials"
              className="space-y-3 rounded border p-4"
            >
              <legend className="font-semibold">Setup essentials</legend>
              <SetupField name="title" label="Title" required />
              {setup && (
                <>
                  <p>Current chassis: {chassisLabel(setup)}</p>
                  <Button
                    type="button"
                    onClick={() => {
                      form.setValue("changeChassis", !changeChassis);
                      form.setValue("selection", {
                        brandId: null,
                        modelId: null,
                      });
                      form.clearErrors("selection");
                    }}
                  >
                    {changeChassis ? "Cancel chassis change" : "Change chassis"}
                  </Button>
                </>
              )}
              {changeChassis && (
                <Controller
                  control={form.control}
                  name="selection"
                  render={({ field }) => (
                    <ChassisSelector
                      error={selectionError?.message}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              )}
              <label className="block" htmlFor="setup-visibility">
                Visibility
              </label>
              <select
                id="setup-visibility"
                className="min-h-11 w-full rounded border p-2"
                {...form.register("visibility")}
              >
                <option value="private">Private</option>
                <option value="friends">Friends</option>
                <option value="public">Public</option>
              </select>
              <p>
                Private: only you. Friends: you and accepted friends. Public:
                authenticated users.
              </p>
            </fieldset>
            {issues.length > 0 && (
              <section className="error-overview" aria-label="Setup errors">
                <h2>Review {issues.length} errors</h2>
                <ul>
                  {issues.map((issue) => (
                    <li key={issue.path}>
                      <button type="button" onClick={() => reveal(issue.path)}>
                        {
                          sections.find(
                            ([id]) => id === sectionForPath(issue.path),
                          )?.[1]
                        }
                        : {issue.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {setup && (
              <Button
                type="button"
                onClick={() => {
                  if (sectionView) {
                    showSection(false);
                    setClearSection(null);
                    document
                      .getElementById("setup-essentials")
                      ?.scrollIntoView?.({ block: "start" });
                  } else select(active);
                }}
              >
                {sectionView ? "Back to edit overview" : "Edit sections"}
              </Button>
            )}
            <div
              className={`setup-workspace${setup ? " edit-sections-workspace" : ""}`}
            >
              <SectionNavigation
                active={active}
                select={select}
                counts={counts}
                sticky={!!setup}
              />
              <div
                className="setup-section-pane"
                hidden={!!setup && !sectionView}
              >
                {setup && sectionView && (
                  <div className="section-clear">
                    <Button
                      ref={clearTrigger}
                      type="button"
                      className="subdued-destructive"
                      onClick={() => setClearSection(active)}
                    >
                      Clear current section:{" "}
                      {sections.find(([id]) => id === active)?.[1]}
                    </Button>
                    {clearSection === active && (
                      <div
                        role="group"
                        aria-label="Clear current section?"
                        className="inline-confirmation"
                      >
                        <p>
                          Clear only{" "}
                          {sections.find(([id]) => id === active)?.[1]}?{" "}
                          {sectionClearDescription[active]} Other sections,
                          setup essentials and photos stay unchanged. Save setup
                          to persist this removal.
                        </p>
                        <Button
                          type="button"
                          autoFocus
                          onClick={() => {
                            setClearSection(null);
                            clearTrigger.current?.focus();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="subdued-destructive"
                          onClick={() => {
                            const paths = sectionClearPaths[active];
                            const defaults = setupToForm();
                            for (const path of paths) {
                              form.setValue(
                                path,
                                structuredClone(
                                  valueAt(defaults, path),
                                ) as never,
                                { shouldDirty: true },
                              );
                              form.clearErrors(path);
                            }
                            setIssues((old) =>
                              old.filter(
                                (issue) =>
                                  !paths.some((path) =>
                                    matchesPath(issue.path, path),
                                  ),
                              ),
                            );
                            setOpened((old) =>
                              Object.fromEntries(
                                Object.entries(old).filter(
                                  ([id]) =>
                                    componentSpecs.find((c) => c.id === id)
                                      ?.section !== active,
                                ),
                              ),
                            );
                            setSectionVersions((old) => ({
                              ...old,
                              [active]: (old[active] ?? 0) + 1,
                            }));
                            setClearSection(null);
                            clearTrigger.current?.focus();
                          }}
                        >
                          Confirm clear current section
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <section
                  key={"general-" + (sectionVersions.general ?? 0)}
                  hidden={active !== "general"}
                  aria-labelledby="section-general"
                >
                  <h2 id="section-general" tabIndex={-1}>
                    General
                  </h2>
                  <ComponentCard id="notes">
                    <SetupField name="notes" label="Notes" multiline />
                  </ComponentCard>
                </section>
                <section
                  key={"front-" + (sectionVersions.front ?? 0)}
                  hidden={active !== "front"}
                  aria-labelledby="section-front"
                >
                  <h2 id="section-front" tabIndex={-1}>
                    Front
                  </h2>
                  <SuspensionSection side="front" setup={setup} />
                  <ComponentCard id="knuckle">
                    <FrontSteeringKnuckleSection setup={setup} />
                  </ComponentCard>
                </section>
                <section
                  key={"rear-" + (sectionVersions.rear ?? 0)}
                  hidden={active !== "rear"}
                  aria-labelledby="section-rear"
                >
                  <h2 id="section-rear" tabIndex={-1}>
                    Rear
                  </h2>
                  <SuspensionSection side="rear" setup={setup} />
                  <ComponentCard id="differential">
                    <RearDifferentialSection setup={setup} />
                  </ComponentCard>
                </section>
                <section
                  key={"shocks-" + (sectionVersions.shocks ?? 0)}
                  hidden={active !== "shocks"}
                  aria-labelledby="section-shocks"
                >
                  <h2 id="section-shocks" tabIndex={-1}>
                    Shocks
                  </h2>
                  {(["frontShock", "rearShock"] as const).map((side, index) => (
                    <fieldset
                      id={`setup-${index === 0 ? "front" : "rear"}-shocks`}
                      key={side}
                      className="space-y-3 rounded border p-4"
                    >
                      <legend className="font-semibold">
                        {index === 0 ? "Front" : "Rear"} shocks
                      </legend>

                      <ComponentCard
                        id={index === 0 ? "front-shock" : "rear-shock"}
                      >
                        <SetupField
                          name={`${side}.manufacturer`}
                          label={`${index === 0 ? "Front" : "Rear"} shock manufacturer`}
                        />
                        <SetupField
                          name={`${side}.model`}
                          label={`${index === 0 ? "Front" : "Rear"} shock model`}
                        />
                        <SetupField
                          name={`${side}.springManufacturer`}
                          label={`${index === 0 ? "Front" : "Rear"} spring manufacturer`}
                        />
                        <SetupField
                          name={`${side}.springColor`}
                          label={`${index === 0 ? "Front" : "Rear"} spring color`}
                        />
                        <SetupField
                          name={`${side}.oil_cst`}
                          label={`${index === 0 ? "Front" : "Rear"} shock oil (cSt)`}
                          numeric
                        />
                      </ComponentCard>
                      <ShockHardwareFields side={side} />
                    </fieldset>
                  ))}
                </section>
                <section
                  key={"wheels-" + (sectionVersions.wheels ?? 0)}
                  hidden={active !== "wheels"}
                  aria-labelledby="section-wheels"
                >
                  <h2 id="section-wheels" tabIndex={-1}>
                    Wheels &amp; tires
                  </h2>
                  <RunningGearSection side="front" setup={setup} />
                  <RunningGearSection side="rear" setup={setup} />
                </section>
                <section
                  key={"electronics-" + (sectionVersions.electronics ?? 0)}
                  hidden={active !== "electronics"}
                  aria-labelledby="section-electronics"
                >
                  <h2 id="section-electronics" tabIndex={-1}>
                    Electronics
                  </h2>
                  <ComponentCard id="electronics">
                    <fieldset
                      id="setup-electronics"
                      className="space-y-3 rounded border p-4"
                    >
                      <legend className="font-semibold">Electronics</legend>
                      {(
                        ["motor", "esc", "servo", "gyro", "radio"] as const
                      ).map((key) => (
                        <SetupField
                          key={key}
                          name={`electronics.${key}`}
                          label={
                            key === "esc"
                              ? "ESC"
                              : key.charAt(0).toUpperCase() + key.slice(1)
                          }
                        />
                      ))}
                    </fieldset>
                  </ComponentCard>
                </section>
              </div>
            </div>
            <div className="form-actions">
              <Button
                variant="primary"
                type="submit"
                disabled={pending || blocked}
                className="min-h-11 rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : setup ? "Save setup" : "Create setup"}
              </Button>
            </div>
          </fieldset>
        </form>
      </EditorPresentation.Provider>
    </FormProvider>
  );
}
