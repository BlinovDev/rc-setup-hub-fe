import {
  preferredSuspensionView,
  type SuspensionView,
} from "../suspensionLinks";
import { EditorPresentation, type FormIssue } from "./editorPresentation";
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
import { AxleTabs, type Axle } from "./AxleTabs";
import { ComponentCard } from "./ComponentCard";

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
  const [suspensionViews, setSuspensionViews] = useState<
    Record<"front" | "rear", SuspensionView>
  >(() => ({
    front: preferredSuspensionView(form.getValues().front),
    rear: preferredSuspensionView(form.getValues().rear),
  }));
  const root = useRef<HTMLFormElement>(null);
  const saving = useRef(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const [shockAxle, setShockAxle] = useState<Axle>("front");
  const [wheelAxle, setWheelAxle] = useState<Axle>("front");
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
    const side = path.startsWith("front.")
      ? "front"
      : path.startsWith("rear.")
        ? "rear"
        : null;
    if (
      side &&
      /\.(?:link_lengths|upper_arm_length_mm|lower_arm_length_mm|steering_tie_rod_length_mm|camber_deg|caster_deg|toe_deg)(?:\.|$)/.test(
        path,
      )
    )
      setSuspensionViews((old) => ({
        ...old,
        [side]:
          path.includes(".link_lengths") || path.endsWith("_length_mm")
            ? "links"
            : "angles",
      }));
    if (path.startsWith("frontShock.")) setShockAxle("front");
    if (path.startsWith("rearShock.")) setShockAxle("rear");
    if (path.startsWith("runningGear.front.")) setWheelAxle("front");
    if (path.startsWith("runningGear.rear.")) setWheelAxle("rear");
    if (setup) onSectionViewChange?.(sectionForPath(path) !== "general");
    setActive(sectionForPath(path));
    setFocusRequest({ path });
  }
  function validationIssues(
    parsed: ReturnType<typeof setupFormSchema.safeParse>,
  ): FormIssue[] {
    return parsed.success
      ? []
      : parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));
  }
  function showIssues(next: FormIssue[]) {
    next.forEach((issue) =>
      form.setError(issue.path as FieldPath<SetupFormValues>, {
        type: "validate",
        message: issue.message,
      }),
    );
    if (next[0]) reveal(next[0].path);
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
      if (window.location.hash === "#setup-rear-shocks") setShockAxle("rear");
      if (window.location.hash === "#setup-rear-running-gear")
        setWheelAxle("rear");
      if (isEdit) onSectionViewChange?.(section !== "general");
      setActive(section);
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
    setSuspensionViews({
      front: preferredSuspensionView(form.getValues().front),
      rear: preferredSuspensionView(form.getValues().rear),
    });
    setShockAxle("front");
    setWheelAxle("front");
    setActive("general");
    setIssues([]);
    setFocusRequest(null);
    setSavedVersion((value) => value + 1);
  }, [resetVersion, form, setup]);
  const selectionError = form.formState.errors.selection;
  return (
    <FormProvider {...form}>
      <EditorPresentation.Provider
        value={{
          savedVersion,
          removeIssues: (paths) =>
            setIssues((current) =>
              current.filter(
                (issue) => !paths.some((path) => matchesPath(issue.path, path)),
              ),
            ),
        }}
      >
        <div className="setup-edit-layout">
          <SectionNavigation
            active={active}
            select={select}
            counts={counts}
            sticky
          />
          <div className="setup-edit-content">
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
            <form
              key={resetVersion}
              ref={root}
              noValidate
              className="edit-setup-form space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const values = form.getValues();
                form.clearErrors();
                const parsed = setupFormSchema.safeParse(values);
                if (!parsed.success) {
                  const next = validationIssues(parsed);
                  setIssues(next);
                  showIssues(next);
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
                  hidden={active !== "general"}
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
                          if (changeChassis) {
                            const values = form.getValues();
                            form.reset(
                              {
                                ...values,
                                changeChassis: false,
                                selection: { brandId: null, modelId: null },
                              },
                              { keepDefaultValues: true },
                            );
                            form.clearErrors("selection");
                            return;
                          }
                          form.setValue("changeChassis", !changeChassis, {
                            shouldDirty: true,
                          });
                          form.setValue(
                            "selection",
                            {
                              brandId: null,
                              modelId: null,
                            },
                            { shouldDirty: true },
                          );
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
                  <SetupField name="notes" label="Notes" multiline />
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
                  <div className="setup-section-pane">
                    <section
                      hidden={active !== "front"}
                      aria-labelledby="section-front"
                    >
                      <h2 id="section-front" tabIndex={-1}>
                        Front
                      </h2>
                      <SuspensionSection
                        side="front"
                        setup={setup}
                        view={suspensionViews.front}
                        onViewChange={(view) =>
                          setSuspensionViews((old) => ({ ...old, front: view }))
                        }
                      />
                      <ComponentCard id="knuckle">
                        <FrontSteeringKnuckleSection setup={setup} />
                      </ComponentCard>
                    </section>
                    <section
                      hidden={active !== "rear"}
                      aria-labelledby="section-rear"
                    >
                      <h2 id="section-rear" tabIndex={-1}>
                        Rear
                      </h2>
                      <SuspensionSection
                        side="rear"
                        setup={setup}
                        view={suspensionViews.rear}
                        onViewChange={(view) =>
                          setSuspensionViews((old) => ({ ...old, rear: view }))
                        }
                      />
                      <ComponentCard id="differential">
                        <RearDifferentialSection setup={setup} />
                      </ComponentCard>
                    </section>
                    <section
                      hidden={active !== "shocks"}
                      aria-labelledby="section-shocks"
                    >
                      <h2 id="section-shocks" tabIndex={-1}>
                        Shocks
                      </h2>
                      <AxleTabs
                        label="Shock"
                        idPrefix="shock-axle"
                        panelIds={{
                          front: "setup-front-shocks",
                          rear: "setup-rear-shocks",
                        }}
                        value={shockAxle}
                        onChange={setShockAxle}
                      />
                      {(["frontShock", "rearShock"] as const).map((side) => {
                        const axle = side === "frontShock" ? "front" : "rear";
                        const label = axle === "front" ? "Front" : "Rear";
                        return (
                          <div
                            id={`setup-${axle}-shocks`}
                            key={side}
                            className="space-y-3 rounded border p-4"
                            role="tabpanel"
                            aria-labelledby={`shock-axle-${axle}-tab`}
                            hidden={shockAxle !== axle}
                          >
                            <ComponentCard id={`${axle}-shock`}>
                              <fieldset className="space-y-3 rounded border p-4">
                                <legend className="font-semibold">
                                  {label} shock setup
                                </legend>
                                <div className="related-fields">
                                  <SetupField
                                    name={`${side}.manufacturer`}
                                    label={`${label} shock manufacturer`}
                                  />
                                  <SetupField
                                    name={`${side}.model`}
                                    label={`${label} shock model`}
                                  />
                                  <SetupField
                                    name={`${side}.springManufacturer`}
                                    label={`${label} spring manufacturer`}
                                  />
                                  <SetupField
                                    name={`${side}.springColor`}
                                    label={`${label} spring color`}
                                  />
                                  <SetupField
                                    name={`${side}.oil_cst`}
                                    label={`${label} shock oil (cSt)`}
                                    numeric
                                  />
                                  <ShockHardwareFields side={side} />
                                </div>
                              </fieldset>
                            </ComponentCard>
                          </div>
                        );
                      })}
                    </section>
                    <section
                      hidden={active !== "wheels"}
                      aria-labelledby="section-wheels"
                    >
                      <h2 id="section-wheels" tabIndex={-1}>
                        Wheels &amp; tires
                      </h2>
                      <AxleTabs
                        label="Wheels and tires"
                        idPrefix="wheel-axle"
                        panelIds={{
                          front: "setup-front-running-gear",
                          rear: "setup-rear-running-gear",
                        }}
                        value={wheelAxle}
                        onChange={setWheelAxle}
                      />
                      {(["front", "rear"] as const).map((side) => (
                        <div
                          key={side}
                          id={`setup-${side}-running-gear`}
                          role="tabpanel"
                          aria-labelledby={`wheel-axle-${side}-tab`}
                          hidden={wheelAxle !== side}
                        >
                          <RunningGearSection side={side} setup={setup} />
                        </div>
                      ))}
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
                    </section>
                  </div>
                </div>
                <div className="form-actions">
                  <p className="form-save-status" role="status">
                    {pending
                      ? "Saving your setup…"
                      : form.formState.isDirty
                        ? "Unsaved setup changes"
                        : "Setup details"}
                  </p>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={pending || blocked}
                    className="min-h-11 rounded px-4 py-2 disabled:opacity-60"
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
