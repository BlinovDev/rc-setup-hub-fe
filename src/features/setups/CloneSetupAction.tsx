import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { components } from "../../api/generated/schema";
import { Button } from "../../shared/components/Button";
import { InlineNotice } from "../../shared/components/Feedback";
import { startGoogleLogin } from "../auth/navigation";
import { captureSession } from "../auth/sessionCache";
import { trapDialogTab } from "./form/dialogFocus";
import { cloneSetup, SetupError } from "./api";
import { rememberCloneTarget } from "./cloneIntent";
import { detailKey, refreshSetupLists, withSession } from "./queries";

type Setup = components["schemas"]["Setup"];
export function CloneSetupAction({
  setup,
  signedIn,
}: {
  setup: Setup;
  signedIn: boolean;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const open = signedIn && params.get("clone") === "confirm";
  const setOpen = (value: boolean) => {
    const next = new URLSearchParams(params);
    if (value) next.set("clone", "confirm");
    else next.delete("clone");
    void setParams(next, { replace: true });
  };
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  const eligible =
    setup.visibility === "public" && setup.moderation_status === "approved";
  const mutation = useMutation({
    mutationFn: (id: string) =>
      withSession(client, () => cloneSetup(setup.id, id)),
    retry: false,
    onMutate: () => captureSession(client),
    onSuccess: async (copy, _id, isCurrent) => {
      if (isCurrent?.()) await refreshSetupLists(client, copy.owner_id);
    },
  });
  useEffect(() => {
    if (open && eligible && !dialog.current?.open) dialog.current?.showModal();
    if ((!open || !eligible) && dialog.current?.open) dialog.current.close();
  }, [open, eligible]);
  if (!eligible) return null;
  const cancel = () => {
    if (!submitting.current) setOpen(false);
  };
  return (
    <>
      <Button
        ref={opener}
        onClick={() => {
          if (!signedIn) {
            rememberCloneTarget(setup.id);
            startGoogleLogin();
            return;
          }
          setOpen(true);
        }}
      >
        Clone setup
      </Button>
      <dialog
        ref={dialog}
        className="help-dialog space-y-4"
        aria-labelledby="clone-title"
        aria-describedby="clone-description"
        onKeyDown={trapDialogTab}
        onCancel={(event) => {
          event.preventDefault();
          cancel();
        }}
        onClose={() => opener.current?.focus()}
      >
        <h2 id="clone-title" className="text-xl font-semibold">
          Clone setup?
        </h2>
        <p id="clone-description">
          Create your own private copy of “{setup.title}”? Technical settings
          and notes are copied. Photos are not copied.
        </p>
        {mutation.isError && (
          <InlineNotice tone="error">
            {mutation.error instanceof SetupError &&
            [400, 404].includes(mutation.error.status)
              ? "This setup is no longer available to clone. Reload the setup before trying again."
              : mutation.error instanceof SetupError &&
                  mutation.error.status === 401
                ? "Your session expired. Sign in before trying again."
                : mutation.error instanceof SetupError &&
                    mutation.error.status === 403
                  ? "Cloning is not permitted. Please reload the application."
                  : mutation.error instanceof SetupError &&
                      mutation.error.status === 409
                    ? "This clone request is no longer available. Reload before starting a new copy."
                    : "Unable to clone setup. Retry this request safely; it will not create a duplicate copy."}
          </InlineNotice>
        )}
        <div className="setup-detail-actions">
          <Button autoFocus disabled={mutation.isPending} onClick={cancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={
              mutation.isPending ||
              (mutation.error instanceof SetupError &&
                [400, 401, 403, 404, 409].includes(mutation.error.status))
            }
            onClick={async () => {
              if (submitting.current) return;
              submitting.current = true;
              const isCurrent = captureSession(client);
              try {
                requestId.current ??= crypto.randomUUID();
                const copy = await mutation.mutateAsync(requestId.current);
                if (isCurrent())
                  void navigate(`/setups/${copy.id}`, {
                    state: { cloned: true },
                  });
              } catch {
                // The mutation owns safe error feedback; keep request identity for retries.
              } finally {
                submitting.current = false;
              }
            }}
          >
            {mutation.isPending ? "Cloning…" : "Create private copy"}
          </Button>
        </div>
        {mutation.isError && (
          <Button
            onClick={() => {
              setOpen(false);
              if (
                mutation.error instanceof SetupError &&
                mutation.error.status === 409
              )
                requestId.current = null;
              mutation.reset();
              void client.invalidateQueries({
                queryKey: detailKey(setup.id),
                exact: true,
              });
            }}
          >
            Reload setup
          </Button>
        )}
      </dialog>
    </>
  );
}
