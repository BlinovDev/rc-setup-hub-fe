import { useState } from "react";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import type { components } from "../../api/generated/schema";
import { Button } from "../../shared/components/Button";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { currentUserOptions } from "../auth/queries";
import { AddFriend } from "./FriendshipActions";
import { useAcceptRequest, useFriendships } from "./queries";

function AcceptFriendship({
  item,
  feedback,
}: {
  item: components["schemas"]["FriendshipItem"];
  feedback: (message: string) => void;
}) {
  const accept = useAcceptRequest(item.id, item.user.id, feedback);
  const pending =
    useIsMutating({ mutationKey: ["friendships", "item", item.id] }) > 0;
  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() => accept.mutate()}
    >
      {pending ? "Accepting…" : "Accept friendship"}
    </Button>
  );
}

// Only loaded backend buckets determine the action; profile/setup data does not.
export function FriendshipControl({
  userId,
  friendships,
  feedback,
}: {
  userId: string;
  friendships: components["schemas"]["FriendshipList"];
  feedback: (message: string) => void;
}) {
  const me = useQuery(currentUserOptions);
  if (!me.data || me.data.id === userId) return null;
  const incoming = friendships.incoming.find((item) => item.user.id === userId);
  if (incoming) return <AcceptFriendship item={incoming} feedback={feedback} />;
  if (friendships.outgoing.some((item) => item.user.id === userId))
    return <p>Request sent</p>;
  if (friendships.accepted.some((item) => item.user.id === userId))
    return <p>Friends</p>;
  return <AddFriend userId={userId} feedback={feedback} />;
}

export function ProfileFriendshipControl({ userId }: { userId: string }) {
  const me = useQuery(currentUserOptions);
  const self = me.data?.id === userId;
  const friendships = useFriendships(!!me.data && !self);
  const [feedback, setFeedback] = useState("");
  if (!me.data || self) return null;
  return (
    <div className="relationship-control">
      {friendships.isPending ? (
        <LoadingState>Loading friendship…</LoadingState>
      ) : friendships.isError ? (
        <InlineNotice tone="error">
          Unable to load friendship.
          <Button
            disabled={friendships.isFetching}
            onClick={() => void friendships.refetch()}
          >
            Retry friendship
          </Button>
        </InlineNotice>
      ) : (
        <FriendshipControl
          userId={userId}
          friendships={friendships.data}
          feedback={setFeedback}
        />
      )}
      {feedback && <InlineNotice tone="error">{feedback}</InlineNotice>}
    </div>
  );
}
