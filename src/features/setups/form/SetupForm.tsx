import { EditorPresentation, type FormIssue } from "./editorPresentation";
import { AddComponent } from "./AddComponent";
import { ComponentCard } from "./ComponentCard";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  sections,
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
  generalPhotos,
  resetVersion = 0,
}: {
  setup?: components["schemas"]["Setup"];
  onSave: (values: SetupFormValues) => Promise<boolean | void>;
  pending: boolean;
  blocked?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSectionViewChange?: (editing: boolean) => void;
  onSaved?: () => void;
  generalPhotos?: ReactNode;
  resetVersion?: number;
}) {
  const isEdit = !!setup;
  const form = useForm<SetupFormValues>({ defaultValues: setupToForm(setup) });
  const root = useRef<HTMLFormElement>(null);
  const saving = useRef(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const [added, setAdded] = useState<Record<string, boolean>>({});
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
    if (setup) onSectionViewChange?.(section !== "general");
    setActive(section);
    setFocusRequest({ section });
  }
  function reveal(path: string) {
    if (setup) onSectionViewChange?.(sectionForPath(path) !== "general");
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
      if (isEdit) onSectionViewChange?.(section !== "general");
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
  const previousReset = useRef(resetVersion);
  useLayoutEffect(() => {
    if (previousReset.current === resetVersion) return;
    previousReset.current = resetVersion;
    form.reset(setupToForm(setup));
    setActive("general");
    setOpened({});
    setAdded({});
    setIssues([]);
    setFocusRequest(null);
    setSavedVersion((value) => value + 1);
  }, [resetVersion, form, setup]);
  const selectionError = form.formState.errors.selection;
  return (
    <FormProvider {...form}>
      <EditorPresentation.Provider
        value={{
          open: opened,
          added,
          setAdded: (id, value) => setAdded((old) => ({ ...old, [id]: value })),
          setOpen: (id, open) => {
            if (open) setAdded((old) => ({ ...old, [id]: true }));
            setOpened((current) => ({ ...current, [id]: open }));
          },
          issues,
          validate: validateComponent,
          setup,
          savedVersion,
        }}
      >
        <div className={setup ? "setup-edit-layout" : undefined}>
          {setup && (
            <SectionNavigation
              active={active}
              select={select}
              counts={counts}
              sticky
            />
          )}
          <div className={setup ? "setup-edit-content" : undefined}>
            {setup && (
              <div
                hidden={active !== "general"}
                className="general-photos"
                aria-label="General photos"
              >
                <h2 id="section-general" tabIndex={-1}>
                  General
                </h2>
                {generalPhotos}
              </div>
            )}
            <form
              key={resetVersion}
              ref={root}
              noValidate
              className={setup ? "edit-setup-form space-y-4" : "mt-6 space-y-6"}
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
                  hidden={!!setup && active !== "general"}
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
                        {changeChassis
                          ? "Cancel chassis change"
                          : "Change chassis"}
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
                  {setup && <SetupField name="notes" label="Notes" multiline />}
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
                    Private: only you. Friends: you and accepted friends.
                    Public: authenticated users.
                  </p>
                </fieldset>
                {issues.length > 0 && (
                  <section className="error-overview" aria-label="Setup errors">
                    <h2>Review {issues.length} errors</h2>
                    <ul>
                      {issues.map((issue) => (
                        <li key={issue.path}>
                          <button
                            type="button"
                            onClick={() => reveal(issue.path)}
                          >
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
                <div className="setup-workspace">
                  {!setup && (
                    <SectionNavigation
                      active={active}
                      select={select}
                      counts={counts}
                    />
                  )}
                  <div className="setup-section-pane">
                    <section
                      hidden={active !== "general"}
                      aria-labelledby="section-general"
                    >
                      {!setup && (
                        <>
                          <h2 id="section-general" tabIndex={-1}>
                            General
                          </h2>
                          <ComponentCard id="notes">
                            <SetupField name="notes" label="Notes" multiline />
                          </ComponentCard>
                        </>
                      )}
                    </section>
                    <section
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
                      {setup && <AddComponent section="front" />}
                    </section>
                    <section
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
                      {setup && <AddComponent section="rear" />}
                    </section>
                    <section
                      hidden={active !== "shocks"}
                      aria-labelledby="section-shocks"
                    >
                      <h2 id="section-shocks" tabIndex={-1}>
                        Shocks
                      </h2>
                      {(["frontShock", "rearShock"] as const).map(
                        (side, index) => (
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
                        ),
                      )}
                      {setup && <AddComponent section="shocks" />}
                    </section>
                    <section
                      hidden={active !== "wheels"}
                      aria-labelledby="section-wheels"
                    >
                      <h2 id="section-wheels" tabIndex={-1}>
                        Wheels &amp; tires
                      </h2>
                      <RunningGearSection side="front" setup={setup} />
                      <RunningGearSection side="rear" setup={setup} />
                      {setup && <AddComponent section="wheels" />}
                    </section>
                    <section
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
                      {setup && <AddComponent section="electronics" />}
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
                    {pending
                      ? "Saving…"
                      : setup
                        ? "Save setup"
                        : "Create setup"}
                  </Button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      </EditorPresentation.Provider>
    </FormProvider>
  );
}
