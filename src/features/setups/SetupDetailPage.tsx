import { SignInButton } from "../auth/SignInButton";
import { Gallery } from "./photos/Gallery";
import { VisibilityBadge } from "../../shared/components/VisibilityBadge";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { PublicIdentity } from "../users/PublicIdentity";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import type { components } from "../../api/generated/schema";
import { isUuid } from "../search/filters";
import { usePublicUser } from "../users/queries";
import { SetupError, chassisLabel } from "./api";
import { useSetup } from "./queries";
import { shareNavigation, setupShareUrl } from "./share";
import { CloneSetupAction } from "./CloneSetupAction";
import { SourceAttribution } from "./SourceAttribution";
import { TechnicalData } from "./TechnicalData";
function Owner({ id }: { id: string }) {
  const owner = usePublicUser(id);
  return (
    <p className="flex items-center gap-2">
      <span className="shrink-0">Owner:</span>{" "}
      {owner.data ? (
        <PublicIdentity user={owner.data} />
      ) : owner.isPending ? (
        "Loading owner…"
      ) : (
        "Owner unavailable"
      )}
    </p>
  );
}
export function SetupDetailPage({
  user,
}: {
  user: components["schemas"]["User"] | null;
}) {
  const { setupId = "" } = useParams();
  const location = useLocation();
  const valid = isUuid(setupId);
  const query = useSetup(setupId, valid);
  const [copyState, setCopyState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  if (
    !valid ||
    (!user &&
      query.data &&
      (query.data.visibility !== "public" ||
        query.data.moderation_status !== "approved")) ||
    (query.error instanceof SetupError &&
      [400, 404].includes(query.error.status))
  )
    return <p>Setup not found or unavailable.</p>;
  if (query.isPending) return <LoadingState>Loading setup…</LoadingState>;
  if (query.isError)
    return (
      <InlineNotice tone="error">
        Unable to load setup.{" "}
        <Button onClick={() => void query.refetch()}>Retry setup</Button>
      </InlineNotice>
    );
  const setup = query.data;
  const url = setupShareUrl(setup.id);
  return (
    <article className="setup-detail space-y-4">
      {location.state?.cloned && (
        <InlineNotice>
          Private copy created. Photos were not copied.
        </InlineNotice>
      )}
      <header className="setup-detail-header">
        <div className="setup-detail-heading">
          <p className="eyebrow">{chassisLabel(setup)}</p>
          <h2 className="page-title">{setup.title}</h2>
          <Owner id={setup.owner_id} />
        </div>
        <VisibilityBadge value={setup.visibility} />
      </header>
      <div className="setup-detail-actions">
        {setup.owner_id === user?.id && (
          <Link
            className="action-link action-link-primary"
            to={`/my/setups/${setup.id}/edit`}
          >
            Edit setup
          </Link>
        )}
        <Link className="action-link" to={`/compare?left_id=${setup.id}`}>
          Compare to
        </Link>
        <Button
          disabled={copyState === "pending"}
          onClick={async () => {
            setCopyState("pending");
            try {
              await shareNavigation.copy(url);
              setCopyState("success");
            } catch {
              setCopyState("error");
            }
          }}
        >
          {copyState === "pending" ? "Copying…" : "Copy link"}
        </Button>
        <CloneSetupAction
          key={`${setup.id}:${user?.id ?? "guest"}`}
          setup={setup}
          signedIn={user !== null}
        />
      </div>
      {setup.source_setup_id && (
        <SourceAttribution
          setupId={setup.id}
          sourceId={setup.source_setup_id}
        />
      )}
      {copyState === "success" && <InlineNotice>Link copied.</InlineNotice>}
      {copyState === "error" && (
        <InlineNotice tone="error">
          <p>Unable to copy. You can copy this link:</p>
          <input
            aria-label="Share URL"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
            className="w-full rounded border p-2"
          />
        </InlineNotice>
      )}
      <Gallery key={setup.id} setupId={setup.id} />
      <div className="setup-dates">
        <span>
          Updated:{" "}
          <time dateTime={setup.updated_at}>
            {new Date(setup.updated_at).toLocaleDateString()}
          </time>
        </span>
        <span>
          Created:{" "}
          <time dateTime={setup.created_at}>
            {new Date(setup.created_at).toLocaleDateString()}
          </time>
        </span>
      </div>
      {setup.notes && (
        <section>
          <h3 className="font-semibold">Notes</h3>
          <p className="whitespace-pre-wrap">{setup.notes}</p>
        </section>
      )}
      {!user && (
        <p>
          <SignInButton>Sign in to create your own setup</SignInButton>
        </p>
      )}
      {setup.schema_version === 1 ? (
        <TechnicalData
          runningGearManufacturers={setup.running_gear_manufacturers}
          data={setup.data}
          differentialManufacturer={setup.rear_differential_manufacturer}
          mountManufacturers={setup.lower_arm_mount_manufacturers}
          knuckleManufacturer={setup.front_steering_knuckle_manufacturer}
        />
      ) : (
        <p>This setup data version is not supported.</p>
      )}
    </article>
  );
}
