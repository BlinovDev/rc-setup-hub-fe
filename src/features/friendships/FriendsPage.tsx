import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { useState } from "react";
import { FriendshipActions } from "./FriendshipActions";
import { useFriendships } from "./queries";
import { UserSearch } from "./UserSearch";
import { PublicIdentity } from "../users/PublicIdentity";
const sections = [
  {
    bucket: "incoming",
    title: "Incoming requests",
    empty: "No incoming requests.",
  },
  {
    bucket: "outgoing",
    title: "Outgoing requests",
    empty: "No outgoing requests.",
  },
  { bucket: "accepted", title: "Friends", empty: "No friends yet." },
] as const;
export function FriendsPage() {
  const friendships = useFriendships();
  const [feedback, setFeedback] = useState("");
  return (
    <section className="space-y-6">
      <h2 className="page-title">Friends</h2>
      {feedback && <InlineNotice tone="error">{feedback}</InlineNotice>}
      {friendships.isPending ? (
        <LoadingState>Loading friendships…</LoadingState>
      ) : friendships.isError ? (
        <InlineNotice tone="error">
          Unable to load friendships.{" "}
          <Button
            disabled={friendships.isFetching}
            onClick={() => void friendships.refetch()}
          >
            Retry friendships
          </Button>
        </InlineNotice>
      ) : (
        <>
          <UserSearch friendships={friendships.data} feedback={setFeedback} />
          {sections.map(({ bucket, title, empty }) => (
            <section
              key={bucket}
              aria-labelledby={`friends-${bucket}`}
              className="people-section"
            >
              <h3 id={`friends-${bucket}`} className="text-xl font-semibold">
                {title}
              </h3>
              {friendships.data[bucket].length === 0 ? (
                <p>{empty}</p>
              ) : (
                <ul className="people-section">
                  {friendships.data[bucket].map((item) => (
                    <li key={item.id} className="people-row">
                      <PublicIdentity user={item.user} />
                      <FriendshipActions
                        item={item}
                        bucket={bucket}
                        feedback={setFeedback}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
