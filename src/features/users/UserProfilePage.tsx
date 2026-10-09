import { ProfileFriendshipControl } from "../friendships/FriendshipControl";
import { VisibilityBadge } from "../../shared/components/VisibilityBadge";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
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
  if (profile.isPending) return <LoadingState>Loading profile…</LoadingState>;
  if (profile.isError)
    return (
      <InlineNotice tone="error">
        Unable to load profile.{" "}
        <Button
          disabled={profile.isFetching}
          onClick={() => void profile.refetch()}
        >
          Retry profile
        </Button>
      </InlineNotice>
    );
  const user = profile.data;
  return (
    <section className="space-y-4">
      <div className="profile-header identity-action-row">
        <div className="profile-identity">
          {user.avatar_url && (
            <img
              className="h-16 w-16 shrink-0 rounded-full"
              src={user.avatar_url}
              alt=""
            />
          )}
          <h2 className="min-w-0 text-2xl font-semibold">{user.nickname}</h2>
        </div>
        <ProfileFriendshipControl key={user.id} userId={user.id} />
      </div>
      <h3 className="text-xl font-semibold">Visible setups</h3>
      {setups.isPending ? (
        <LoadingState>Loading visible setups…</LoadingState>
      ) : setups.isError ? (
        <InlineNotice tone="error">
          Unable to load visible setups.{" "}
          <Button
            disabled={setups.isFetching}
            onClick={() => void setups.refetch()}
          >
            Retry visible setups
          </Button>
        </InlineNotice>
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
              <VisibilityBadge value={setup.visibility} />
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
