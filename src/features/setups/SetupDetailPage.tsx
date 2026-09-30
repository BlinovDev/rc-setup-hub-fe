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
  user: components["schemas"]["User"];
}) {
  const { setupId = "" } = useParams();
  const valid = isUuid(setupId);
  const query = useSetup(setupId, valid);
  const [copyState, setCopyState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  if (
    !valid ||
    (query.error instanceof SetupError &&
      [400, 404].includes(query.error.status))
  )
    return <p>Setup not found or unavailable.</p>;
  if (query.isPending) return <p role="status">Loading setup…</p>;
  if (query.isError)
    return (
      <p role="alert">
        Unable to load setup.{" "}
        <button onClick={() => void query.refetch()}>Retry setup</button>
      </p>
    );
  const setup = query.data;
  const url = setupShareUrl(setup.id);
  return (
    <article className="space-y-4">
      <h2 className="text-2xl font-semibold">{setup.title}</h2>
      <Owner id={setup.owner_id} />
      <p>{chassisLabel(setup)}</p>
      <p>Visibility: {setup.visibility}</p>
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
      {setup.owner_id === user.id && (
        <Link
          className="inline-block underline"
          to={`/my/setups/${setup.id}/edit`}
        >
          Edit setup
        </Link>
      )}
      <div>
        <button
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
        </button>
      </div>
      {copyState === "success" && <p role="status">Link copied.</p>}
      {copyState === "error" && (
        <div role="alert">
          <p>Unable to copy. You can copy this link:</p>
          <input
            aria-label="Share URL"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
            className="w-full rounded border p-2"
          />
        </div>
      )}
      {setup.schema_version === 1 ? (
        <TechnicalData data={setup.data} />
      ) : (
        <p>This setup data version is not supported.</p>
      )}
    </article>
  );
}
