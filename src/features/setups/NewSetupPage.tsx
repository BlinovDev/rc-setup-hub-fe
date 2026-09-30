import { Link, useNavigate } from "react-router";
import { setupErrorMessage } from "./api";
import { useCreateSetup } from "./queries";
import { SetupForm } from "./form/SetupForm";
import { serializeCreate } from "./form/serialization";

export function NewSetupPage() {
  const create = useCreateSetup();
  const navigate = useNavigate();
  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold">New setup</h2>
      <Link to="/my/setups">Back to my setups</Link>
      {create.isError && (
        <p role="alert">{setupErrorMessage(create.error, "save")}</p>
      )}
      <SetupForm
        pending={create.isPending}
        onSave={async (values) => {
          try {
            await create.mutateAsync(serializeCreate(values));
            navigate("/my/setups", { state: { message: "Setup created." } });
          } catch {
            /* Safe error feedback comes from mutation state. */
          }
        }}
      />
    </section>
  );
}
