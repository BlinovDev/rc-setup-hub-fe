import { SignInButton } from "../auth/SignInButton";
import { Gallery } from "./photos/Gallery";
import { VisibilityBadge } from "../../shared/components/VisibilityBadge";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { PublicIdentity } from "../users/PublicIdentity";
import { useState } from "react";
import { Link, useParams } from "react-router";
import type { components } from "../../api/generated/schema";
import { isUuid } from "../search/filters";
import { usePublicUser } from "../users/queries";
import { SetupError, chassisLabel } from "./api";
import { useSetup } from "./queries";
import { shareNavigation, setupShareUrl } from "./share";
import { TechnicalData } from "./TechnicalData";
function Owner({ id }: { id: string }) {
  const owner = usePublicUser(id);
  return (
    <p>
      Owner:{" "}
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
    <article className="space-y-4">
      <h2 className="text-2xl font-semibold">{setup.title}</h2>
      <Owner id={setup.owner_id} />
      <Gallery key={setup.id} setupId={setup.id} />
      <Link
        className="inline-flex min-h-11 items-center underline"
        to={`/compare?left_id=${setup.id}`}
      >
        Compare to
      </Link>
      <p>{chassisLabel(setup)}</p>
      <VisibilityBadge value={setup.visibility} />
      <p>
        Created:{" "}
        <time dateTime={setup.created_at}>
          {new Date(setup.created_at).toLocaleString()}
        </time>
      </p>
      <p>
        Updated:{" "}
        <time dateTime={setup.updated_at}>
          {new Date(setup.updated_at).toLocaleString()}
        </time>
      </p>
      {setup.notes && (
        <section>
          <h3 className="font-semibold">Notes</h3>
          <p className="whitespace-pre-wrap">{setup.notes}</p>
        </section>
      )}
      {setup.owner_id === user?.id && (
        <Link
          className="inline-block underline"
          to={`/my/setups/${setup.id}/edit`}
        >
          Edit setup
        </Link>
      )}
      {!user && (
        <p>
          <SignInButton>Sign in to create your own setup</SignInButton>
        </p>
      )}
      <div>
        <Button
          className="rounded border px-4 py-2"
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
      </div>
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
