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

export function SetupForm({
  setup,
  onSave,
  pending,
  blocked = false,
}: {
  setup?: components["schemas"]["Setup"];
  onSave: (values: SetupFormValues) => Promise<void>;
  pending: boolean;
  blocked?: boolean;
}) {
  const form = useForm<SetupFormValues>({ defaultValues: setupToForm(setup) });
  const changeChassis = useWatch({
    control: form.control,
    name: "changeChassis",
  });
  const selectionError = form.formState.errors.selection;
  return (
    <FormProvider {...form}>
      <form
        noValidate
        className="mt-6 space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          form.clearErrors();
          const parsed = setupFormSchema.safeParse(values);
          if (!parsed.success) {
            parsed.error.issues.forEach((issue, index) =>
              form.setError(
                issue.path.join(".") as FieldPath<SetupFormValues>,
                { type: "validate", message: issue.message },
                { shouldFocus: index === 0 },
              ),
            );
            return;
          }
          if (!pending && !blocked) await onSave(parsed.data);
        })}
      >
        <fieldset disabled={pending} className="space-y-6">
          <fieldset className="space-y-3 rounded border p-4">
            <legend className="font-semibold">General</legend>
            <SetupField name="title" label="Title" />
            {setup && (
              <>
                <p>Current chassis: {chassisLabel(setup)}</p>
                <button
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
                </button>
              </>
            )}
            {changeChassis && (
              <Controller
                control={form.control}
                name="selection"
                render={({ field }) => (
                  <ChassisSelector
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            )}
            {selectionError?.message && (
              <p role="alert">{selectionError.message}</p>
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
            <SetupField name="notes" label="Notes" multiline />
          </fieldset>
          <SuspensionSection side="front" />
          <SuspensionSection side="rear" />
          {(["frontShock", "rearShock"] as const).map((side, index) => (
            <fieldset key={side} className="space-y-3 rounded border p-4">
              <legend className="font-semibold">
                {index === 0 ? "Front" : "Rear"} shocks
              </legend>
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
            </fieldset>
          ))}
          <fieldset className="space-y-3 rounded border p-4">
            <legend className="font-semibold">Electronics</legend>
            {(["motor", "esc", "servo", "gyro", "radio"] as const).map(
              (key) => (
                <SetupField
                  key={key}
                  name={`electronics.${key}`}
                  label={
                    key === "esc"
                      ? "ESC"
                      : key.charAt(0).toUpperCase() + key.slice(1)
                  }
                />
              ),
            )}
          </fieldset>
          <button
            type="submit"
            disabled={pending || blocked}
            className="min-h-11 rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : setup ? "Save setup" : "Create setup"}
          </button>
        </fieldset>
      </form>
    </FormProvider>
  );
}
