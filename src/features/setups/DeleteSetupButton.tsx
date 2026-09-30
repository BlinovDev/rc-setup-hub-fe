import { InlineNotice } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { useRef, useState } from "react";
import { SetupError, setupErrorMessage } from "./api";
import { useDeleteSetup } from "./queries";

export function DeleteSetupButton({
  id,
  onDeleted,
}: {
  id: string;
  onDeleted?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const restoreFocus = useRef(false);
  const deletion = useDeleteSetup(id);
  const unavailable =
    deletion.error instanceof SetupError && deletion.error.status === 404;
  if (unavailable)
    return (
      <InlineNotice tone="error">Setup not found or unavailable.</InlineNotice>
    );
  return (
    <div className="mt-3">
      {deletion.isError && (
        <InlineNotice tone="error">
          {setupErrorMessage(deletion.error, "delete")}
        </InlineNotice>
      )}
      {confirm ? (
        <div
          role="group"
          aria-label="Confirm deletion"
          className="inline-confirmation"
        >
          <p>Delete setup? This cannot be undone.</p>
          <Button
            autoFocus
            type="button"
            disabled={deletion.isPending}
            onClick={() => {
              restoreFocus.current = true;
              setConfirm(false);
              deletion.reset();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={deletion.isPending}
            onClick={() =>
              deletion.mutate(undefined, {
                onSuccess: () => {
                  setConfirm(false);
                  onDeleted?.();
                },
              })
            }
          >
            {deletion.isPending ? "Deleting…" : "Confirm delete"}
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
          variant="danger"
          type="button"
          onClick={() => setConfirm(true)}
        >
          Delete setup
        </Button>
      )}
    </div>
  );
}
