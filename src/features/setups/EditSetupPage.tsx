import { DraftGuard } from "./form/DraftGuard";
import { usePhotoQueue } from "./photos/usePhotoQueue";
import { PhotoManager } from "./photos/PhotoManager";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { z } from "zod";
import type { components } from "../../api/generated/schema";
import { SetupError, setupErrorMessage } from "./api";
import { usePatchSetup, useSetup } from "./queries";
import { SetupForm } from "./form/SetupForm";
import { serializePatch } from "./form/serialization";
import { DeleteSetupButton } from "./DeleteSetupButton";

export function EditSetupPage({
  user,
}: {
  user: components["schemas"]["User"];
}) {
  const { setupId = "" } = useParams();
  return <SetupEditor key={setupId} setupId={setupId} user={user} />;
}

// A different setup is a different document/queue lifetime. Section switches and
// successful saves keep this owner mounted; confirmed cross-document exits do not.
function SetupEditor({
  user,
  setupId,
}: {
  user: components["schemas"]["User"];
  setupId: string;
}) {
  const [sectionView, setSectionView] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowExit = useRef(false);
  const queue = usePhotoQueue();
  const valid = z.string().uuid().safeParse(setupId).success;
  const detail = useSetup(setupId, valid);
  const update = usePatchSetup(setupId);
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const [reloading, setReloading] = useState(false);
  const [saved, setSaved] = useState(false);
  const unavailable =
    !valid ||
    (detail.error instanceof SetupError &&
      [400, 404].includes(detail.error.status)) ||
    (update.error instanceof SetupError && update.error.status === 404);
  const conflict =
    update.error instanceof SetupError && update.error.status === 409;
  if (unavailable)
    return (
      <section className="setup-editor mt-8">
        <InlineNotice tone="error">
          Setup not found or unavailable.
        </InlineNotice>
        <Link to="/my/setups">Back to my setups</Link>
      </section>
    );
  if (detail.isPending)
    return <LoadingState className="mt-8">Loading setup…</LoadingState>;
  if (detail.isError)
    return (
      <div className="mt-8">
        <InlineNotice tone="error">
          {setupErrorMessage(detail.error, "load")}
        </InlineNotice>
        <Button
          type="button"
          disabled={detail.isFetching}
          onClick={() => void detail.refetch()}
        >
          Retry setup
        </Button>
      </div>
    );
  if (detail.data.owner_id !== user.id)
    return (
      <InlineNotice tone="error" className="mt-8">
        Setup not found or unavailable.
      </InlineNotice>
    );
  if (detail.data.schema_version !== 1)
    return (
      <InlineNotice tone="error" className="mt-8">
        This setup version is not supported by this form.
      </InlineNotice>
    );
  return (
    <section className="setup-editor mt-8">
      <h2 className="text-2xl font-semibold">Edit setup</h2>
      <Link to="/my/setups">Back to my setups</Link>
      <DraftGuard
        dirty={dirty || queue.items.some((item) => item.state !== "uploaded")}
        allowExit={allowExit}
      />
      {saved && <InlineNotice>Setup saved.</InlineNotice>}
      {update.isError && (
        <InlineNotice tone="error">
          {setupErrorMessage(update.error, "save")}
        </InlineNotice>
      )}
      {conflict && (
        <Button
          type="button"
          disabled={reloading}
          onClick={async () => {
            setReloading(true);
            const result = await detail.refetch();
            if (result.isSuccess) {
              update.reset();
              setSectionView(false);
              setRevision((value) => value + 1);
              setSaved(false);
            }
            setReloading(false);
          }}
        >
          Reload setup (discard unsaved changes)
        </Button>
      )}
      <SetupForm
        resetVersion={revision}
        generalPhotos={
          <PhotoManager
            key={setupId}
            setupId={setupId}
            ownerId={user.id}
            queue={queue}
          />
        }
        onDirtyChange={setDirty}
        onSectionViewChange={setSectionView}
        onSaved={() => {
          allowExit.current = !queue.items.some(
            (item) => item.state !== "uploaded",
          );
          navigate(`/setups/${setupId}`, { replace: true });
        }}
        setup={detail.data}
        pending={update.isPending || reloading}
        blocked={conflict}
        onSave={async (values) => {
          setSaved(false);
          try {
            await update.mutateAsync(serializePatch(values));
            setSaved(true);
            return true;
          } catch {
            return false;
          }
        }}
      />
      {!sectionView && (
        <DeleteSetupButton
          id={setupId}
          onDeleted={() => {
            allowExit.current = true;
            navigate("/my/setups", { state: { message: "Setup deleted." } });
          }}
        />
      )}
    </section>
  );
}
