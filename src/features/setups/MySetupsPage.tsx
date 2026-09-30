import { VisibilityBadge } from "../../shared/components/VisibilityBadge";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { Link, useLocation } from "react-router";
import { chassisLabel, setupErrorMessage } from "./api";
import { useMySetups } from "./queries";
import { DeleteSetupButton } from "./DeleteSetupButton";

export function MySetupsPage() {
  const setups = useMySetups();
  const location = useLocation();
  const message: unknown = location.state?.message;
  return (
    <section className="mt-8" aria-labelledby="my-setups-title">
      <h2 id="my-setups-title" className="text-2xl font-semibold">
        My setups
      </h2>
      <Link
        className="my-4 inline-block min-h-11 underline"
        to="/my/setups/new"
      >
        New setup
      </Link>
      {typeof message === "string" && <InlineNotice>{message}</InlineNotice>}
      {setups.isPending ? (
        <LoadingState>Loading setups…</LoadingState>
      ) : setups.isError ? (
        <div>
          <InlineNotice tone="error">
            {setupErrorMessage(setups.error, "load")}
          </InlineNotice>
          <Button
            type="button"
            disabled={setups.isFetching}
            onClick={() => void setups.refetch()}
          >
            Retry setups
          </Button>
        </div>
      ) : setups.data.length === 0 ? (
        <p>No setups yet.</p>
      ) : (
        <ul className="space-y-4">
          {setups.data.map((setup) => (
            <li key={setup.id} className="rounded border p-4">
              <h3 className="text-xl font-semibold break-words">
                {setup.title}
              </h3>
              <p>{chassisLabel(setup)}</p>
              <VisibilityBadge value={setup.visibility} />
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <Link
                  className="inline-flex min-h-11 items-center px-3 underline"
                  to={`/my/setups/${setup.id}/edit`}
                >
                  Edit setup
                </Link>
                <DeleteSetupButton id={setup.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
