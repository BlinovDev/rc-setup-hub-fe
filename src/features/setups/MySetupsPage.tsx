import { PhotoImage } from "./photos/PhotoImage";
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
    <section aria-labelledby="my-setups-title">
      <header className="page-heading-row my-setups-heading">
        <h2 id="my-setups-title" className="page-title">
          My setups
        </h2>
        <Link className="action-link action-link-primary" to="/my/setups/new">
          New setup
        </Link>
      </header>
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
        <ul className="setup-cards">
          {setups.data.map((setup) => (
            <li key={setup.id} className="setup-card rounded border p-4">
              <Link
                className="setup-cover-link"
                to={`/setups/${setup.id}`}
                aria-label={`View ${setup.title}`}
              >
                <PhotoImage
                  photo={setup.cover_photo}
                  alt={`Cover of ${setup.title}`}
                />
              </Link>
              <div className="setup-card-content space-y-2">
                <h3 className="text-xl font-semibold break-words">
                  <Link
                    className="setup-title-link inline-flex min-h-11 items-center"
                    to={`/setups/${setup.id}`}
                  >
                    {setup.title}
                  </Link>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
