import { Link, useParams } from "react-router";
import { isUuid } from "../search/filters";
import { SetupError, chassisLabel } from "../setups/api";
import { useUserSetups } from "../setups/queries";
import { usePublicUser } from "./queries";
export function UserProfilePage() {
  const { userId = "" } = useParams();
  const valid = isUuid(userId);
  const profile = usePublicUser(userId, valid);
  const setups = useUserSetups(userId, valid && profile.isSuccess);
  if (
    !valid ||
    (profile.error instanceof SetupError &&
      [400, 404].includes(profile.error.status))
  )
    return <p>User not found or unavailable.</p>;
  if (profile.isPending) return <p role="status">Loading profile…</p>;
  if (profile.isError)
    return (
      <p role="alert">
        Unable to load profile.{" "}
        <button
          disabled={profile.isFetching}
          onClick={() => void profile.refetch()}
        >
          Retry profile
        </button>
      </p>
    );
  const user = profile.data;
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">{user.nickname}</h2>
      {user.avatar_url && (
        <img className="h-16 w-16 rounded-full" src={user.avatar_url} alt="" />
      )}
      <h3 className="text-xl font-semibold">Visible setups</h3>
      {setups.isPending ? (
        <p role="status">Loading visible setups…</p>
      ) : setups.isError ? (
        <p role="alert">
          Unable to load visible setups.{" "}
          <button
            disabled={setups.isFetching}
            onClick={() => void setups.refetch()}
          >
            Retry visible setups
          </button>
        </p>
      ) : setups.data.length === 0 ? (
        <p>No visible setups.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {setups.data.map((setup) => (
            <article key={setup.id} className="rounded border p-4 space-y-2">
              <h4 className="text-xl font-semibold">
                <Link className="underline" to={`/setups/${setup.id}`}>
                  {setup.title}
                </Link>
              </h4>
              <p>{chassisLabel(setup)}</p>
              <p>
                Visibility:{" "}
                {setup.visibility.charAt(0).toUpperCase() +
                  setup.visibility.slice(1)}
              </p>
              <p>
                Updated:{" "}
                <time dateTime={setup.updated_at}>
                  {new Date(setup.updated_at).toLocaleString()}
                </time>
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
