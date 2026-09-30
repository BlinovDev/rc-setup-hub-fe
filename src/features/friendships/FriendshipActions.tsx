import { Button } from "../../shared/components/Button";
import { useRef, useState } from "react";
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
    <Button
      className="min-h-11 rounded border px-3 py-2 disabled:opacity-60"
      disabled={pending}
      onClick={() => send.mutate()}
    >
      {pending ? "Sending…" : "Add friend"}
    </Button>
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
  const restoreFocus = useRef(false);
  function deleteItem() {
    remove.mutate();
  }
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {bucket === "incoming" && (
        <Button
          variant="primary"
          disabled={pending}
          className="min-h-11 rounded border px-3 py-2 disabled:opacity-60"
          onClick={() => accept.mutate()}
        >
          {accept.isPending ? "Accepting…" : "Accept"}
        </Button>
      )}
      {confirm ? (
        <div
          role="group"
          aria-label={`Confirm removing ${item.user.nickname}`}
          className="inline-confirmation"
        >
          <p>Remove {item.user.nickname} from friends?</p>
          <Button
            autoFocus
            disabled={pending}
            onClick={() => {
              restoreFocus.current = true;
              setConfirm(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            className="min-h-11 rounded border px-3 py-2 disabled:opacity-60"
            onClick={deleteItem}
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        </div>
      ) : (
        <Button
          ref={(element) => {
            if (element && restoreFocus.current) {
              element.focus();
              restoreFocus.current = false;
            }
          }}
          variant={bucket === "outgoing" ? "secondary" : "danger"}
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
        </Button>
      )}
    </div>
  );
}
