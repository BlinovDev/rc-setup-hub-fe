import { useQuery } from "@tanstack/react-query";
import { currentUserOptions } from "../auth/queries";
import { SetupSearchCard } from "../search/SetupSearchCard";
import { PhotoImage } from "../setups/photos/PhotoImage";
import { ProfileFriendshipControl } from "../friendships/FriendshipControl";
import { VisibilityBadge } from "../../shared/components/VisibilityBadge";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { Link, useParams, useSearchParams } from "react-router";
import { isUuid } from "../search/filters";
import { SetupError, chassisLabel } from "../setups/api";
import { useUserSetups } from "../setups/queries";
import { usePublicUserSetups, usePublicUser } from "./queries";
export function UserProfilePage() {
  const { userId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const session = useQuery(currentUserOptions);
  const visible = !!session.data && params.get("view") === "visible";
  const valid = isUuid(userId);
  const profile = usePublicUser(userId, valid);
  const setups = useUserSetups(userId, visible && valid && profile.isSuccess);
  const publicSetups = usePublicUserSetups(
    userId,
    !visible && valid && profile.isSuccess,
  );
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
      {session.data && (
        <div className="flex flex-wrap gap-3" aria-label="Profile setup lists">
          <Button aria-pressed={!visible} onClick={() => setParams({})}>
            Public setups
          </Button>
          <Button
            aria-pressed={visible}
            onClick={() => setParams({ view: "visible" })}
          >
            Setups visible to you
          </Button>
        </div>
      )}
      {!visible ? (
        <section aria-label="Public setups" className="space-y-4">
          <h3 className="text-xl font-semibold">Public setups</h3>
          {publicSetups.isPending ? (
            <LoadingState>Loading public setups…</LoadingState>
          ) : publicSetups.isError && !publicSetups.data ? (
            <InlineNotice tone="error">
              Unable to load public setups.{" "}
              <Button
                disabled={publicSetups.isFetching}
                onClick={() => void publicSetups.refetch()}
              >
                Retry public setups
              </Button>
            </InlineNotice>
          ) : publicSetups.data?.pages.every(
              (page) => page.items.length === 0,
            ) ? (
            <p>No public setups yet.</p>
          ) : (
            <div className="setup-cards">
              {publicSetups.data?.pages
                .flatMap((page) => page.items)
                .map((item) => (
                  <SetupSearchCard key={item.id} item={item} />
                ))}
            </div>
          )}
          {publicSetups.isFetchNextPageError && (
            <InlineNotice tone="error">
              Unable to load more public setups.
            </InlineNotice>
          )}
          {publicSetups.hasNextPage && (
            <Button
              disabled={publicSetups.isFetching}
              onClick={() =>
                void publicSetups.fetchNextPage({ cancelRefetch: false })
              }
            >
              {publicSetups.isFetchingNextPage
                ? "Loading more…"
                : publicSetups.isFetchNextPageError
                  ? "Retry load more"
                  : "Load more"}
            </Button>
          )}
        </section>
      ) : (
        <VisibleSetups setups={setups} />
      )}
    </section>
  );
}

function VisibleSetups({
  setups,
}: {
  setups: ReturnType<typeof useUserSetups>;
}) {
  return (
    <section aria-label="Setups visible to you" className="space-y-4">
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
        <div className="setup-cards">
          {setups.data.map((setup) => (
            <article key={setup.id} className="setup-card rounded border p-4">
              <PhotoImage
                photo={setup.cover_photo}
                alt={`Cover of ${setup.title}`}
              />
              <div className="setup-card-content space-y-2">
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
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
