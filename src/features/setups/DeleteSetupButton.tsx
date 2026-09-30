import { useState } from "react";
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
  const deletion = useDeleteSetup(id);
  const unavailable =
    deletion.error instanceof SetupError && deletion.error.status === 404;
  if (unavailable) return <p role="alert">Setup not found or unavailable.</p>;
  return (
    <div className="mt-3">
      {deletion.isError && (
        <p role="alert">{setupErrorMessage(deletion.error, "delete")}</p>
      )}
      {confirm ? (
        <div role="group" aria-label="Confirm deletion">
          <p>Delete setup? This cannot be undone.</p>
          <button
            type="button"
            disabled={deletion.isPending}
            onClick={() => {
              setConfirm(false);
              deletion.reset();
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ml-4 min-h-11 text-red-800"
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
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="min-h-11 text-red-800"
          onClick={() => setConfirm(true)}
        >
          Delete setup
        </button>
      )}
    </div>
  );
}
