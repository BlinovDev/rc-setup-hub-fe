import { DraftGuard } from "./form/DraftGuard";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { components } from "../../api/generated/schema";
import { PhotoPicker } from "./photos/queue";
import { usePhotoQueue } from "./photos/usePhotoQueue";
import { PhotoManager } from "./photos/PhotoManager";
import { uploadPhoto } from "./photos/api";
import { refreshPhotos } from "./photos/queries";
import { withSession } from "./queries";
import { InlineNotice } from "../../shared/components/Feedback";
import { Link, useNavigate } from "react-router";
import { setupErrorMessage } from "./api";
import { useCreateSetup } from "./queries";
import { SetupForm } from "./form/SetupForm";
import { serializeCreate } from "./form/serialization";

export function NewSetupPage() {
  const [dirty, setDirty] = useState(false);
  const allowExit = useRef(false);
  const create = useCreateSetup();
  const navigate = useNavigate();
  const queue = usePhotoQueue();
  const client = useQueryClient();
  const [savedSetup, setSavedSetup] =
    useState<components["schemas"]["Setup"]>();
  if (savedSetup)
    return (
      <section className="setup-editor space-y-4">
        <h2>Setup created.</h2>
        <p>
          Your setup is saved. Completed photos are retained. Retry or remove
          failed selections below.
        </p>
        <Link to={`/my/setups/${savedSetup.id}/edit`}>
          Continue editing setup
        </Link>
        <DraftGuard
          dirty={queue.items.some((item) => item.state !== "uploaded")}
          allowExit={allowExit}
        />
        <PhotoManager
          setupId={savedSetup.id}
          ownerId={savedSetup.owner_id}
          queue={queue}
        />
      </section>
    );
  return (
    <section className="setup-editor mt-8">
      <h2 className="text-2xl font-semibold">New setup</h2>
      <Link to="/my/setups">Back to my setups</Link>
      {create.isError && (
        <InlineNotice tone="error">
          {setupErrorMessage(create.error, "save")}
        </InlineNotice>
      )}
      <DraftGuard
        dirty={dirty || queue.items.some((item) => item.state !== "uploaded")}
        allowExit={allowExit}
      />
      <PhotoPicker queue={queue} disabled={create.isPending} />
      <SetupForm
        onDirtyChange={setDirty}
        pending={create.isPending}
        onSave={async (values) => {
          try {
            const setup = await create.mutateAsync(serializeCreate(values));
            if (queue.items.length) {
              setDirty(false);
              setSavedSetup(setup);
              await queue.send(async (item) => {
                const photo = await withSession(client, () =>
                  uploadPhoto(setup.id, item.file, item.requestId),
                );
                await refreshPhotos(client, setup.id, setup.owner_id);
                return photo;
              });
              return true;
            }
            allowExit.current = true;
            navigate("/my/setups", { state: { message: "Setup created." } });
            return true;
          } catch {
            return false;
          }
        }}
      />
    </section>
  );
}
