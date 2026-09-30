import { useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import type { components } from "../../api/generated/schema";
import {
  useAcceptRequest,
  useDeleteRelationship,
  useSendRequest,
} from "./queries";

export type FriendshipBucket = keyof components["schemas"]["FriendshipList"];
export function AddFriend({
  userId,
  feedback,
}: {
  userId: string;
  feedback: (message: string) => void;
}) {
  const send = useSendRequest(userId, feedback);
  const pending =
    useIsMutating({ mutationKey: ["friendships", "send", userId] }) > 0;
  return (
    <button
      className="min-h-11 rounded border px-3 py-2 disabled:opacity-60"
      disabled={pending}
      onClick={() => send.mutate()}
    >
      {pending ? "Sending…" : "Add friend"}
    </button>
  );
}
export function FriendshipActions({
  item,
  bucket,
  feedback,
}: {
  item: components["schemas"]["FriendshipItem"];
  bucket: FriendshipBucket;
  feedback: (message: string) => void;
}) {
  const accept = useAcceptRequest(item.id, item.user.id, feedback);
  const remove = useDeleteRelationship(
    item.id,
    item.user.id,
    bucket === "accepted",
    feedback,
  );
  const pending =
    useIsMutating({ mutationKey: ["friendships", "item", item.id] }) > 0;
  const [confirm, setConfirm] = useState(false);
  function deleteItem() {
    remove.mutate();
  }
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {bucket === "incoming" && (
        <button
          disabled={pending}
          className="min-h-11 rounded border px-3 py-2 disabled:opacity-60"
          onClick={() => accept.mutate()}
        >
          {accept.isPending ? "Accepting…" : "Accept"}
        </button>
      )}
      {confirm ? (
        <div
          role="group"
          aria-label={`Confirm removing ${item.user.nickname}`}
          className="flex flex-wrap gap-2 items-center"
        >
          <p>Remove {item.user.nickname} from friends?</p>
          <button disabled={pending} onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button
            disabled={pending}
            className="min-h-11 rounded border px-3 py-2 disabled:opacity-60"
            onClick={deleteItem}
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </button>
        </div>
      ) : (
        <button
          disabled={pending}
          className="min-h-11 rounded border px-3 py-2 disabled:opacity-60"
          onClick={() =>
            bucket === "accepted" ? setConfirm(true) : deleteItem()
          }
        >
          {remove.isPending
            ? "Updating…"
            : bucket === "incoming"
              ? "Reject"
              : bucket === "outgoing"
                ? "Cancel request"
                : "Remove friend"}
        </button>
      )}
    </div>
  );
}
