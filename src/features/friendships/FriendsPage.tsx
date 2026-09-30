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
      <h2 className="text-2xl font-semibold">Friendships</h2>
      {feedback && <p role="alert">{feedback}</p>}
      {friendships.isPending ? (
        <p role="status">Loading friendships…</p>
      ) : friendships.isError ? (
        <p role="alert">
          Unable to load friendships.{" "}
          <button
            disabled={friendships.isFetching}
            onClick={() => void friendships.refetch()}
          >
            Retry friendships
          </button>
        </p>
      ) : (
        <>
          <UserSearch friendships={friendships.data} feedback={setFeedback} />
          {sections.map(({ bucket, title, empty }) => (
            <section
              key={bucket}
              aria-labelledby={`friends-${bucket}`}
              className="space-y-3"
            >
              <h3 id={`friends-${bucket}`} className="text-xl font-semibold">
                {title}
              </h3>
              {friendships.data[bucket].length === 0 ? (
                <p>{empty}</p>
              ) : (
                <ul className="space-y-3">
                  {friendships.data[bucket].map((item) => (
                    <li key={item.id} className="rounded border p-4 space-y-2">
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
