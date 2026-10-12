import { useEffect, useRef, useState } from "react";
import type { components } from "../../../api/generated/schema";
import { photoError } from "./api";
export type QueuedPhoto = {
  requestId: string;
  file: File;
  state: "queued" | "uploading" | "uploaded" | "error";
  photo?: components["schemas"]["SetupPhoto"];
  error?: string | undefined;
};
export function usePhotoQueue() {
  const [items, setItems] = useState<QueuedPhoto[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function select(
    files: File[],
    stored: components["schemas"]["SetupPhoto"][],
  ) {
    const count =
      new Set([
        ...stored.map((p) => p.id),
        ...items.flatMap((i) => (i.photo ? [i.photo.id] : [])),
      ]).size + items.filter((i) => i.state !== "uploaded").length;
    if (files.length > 10 - count) {
      setError(
        `You selected ${files.length} files, but only ${Math.max(0, 10 - count)} photo slots remain. Choose fewer files; no files were added.`,
      );
      return;
    }
    if (files.some((f) => f.size > 25 * 1024 * 1024)) {
      setError(
        "Each photo must be at most 25 MiB. Choose smaller files; no files were added.",
      );
      return;
    }
    if (
      files.some(
        (f) =>
          !(
            /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name) ||
            /^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type)
          ),
      )
    ) {
      setError(
        "Choose JPEG, PNG, WebP or HEIC/HEIF files. No files were added.",
      );
      return;
    }
    setError("");
    setItems((old) => [
      ...old,
      ...files.map((file) => ({
        requestId: crypto.randomUUID(),
        file,
        state: "queued" as const,
      })),
    ]);
  }
  const remove = (requestId: string) => {
    if (!lock.current)
      setItems((old) => old.filter((i) => i.requestId !== requestId));
  };
  const forget = (photoId: string) =>
    setItems((old) => old.filter((i) => i.photo?.id !== photoId));
  async function send(
    upload: (item: QueuedPhoto) => Promise<components["schemas"]["SetupPhoto"]>,
    only?: string,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      for (const item of items.filter((i) =>
        only ? i.requestId === only : i.state === "queued",
      )) {
        if (!alive.current) break;
        setItems((old) =>
          old.map((i) =>
            i.requestId === item.requestId
              ? { ...i, state: "uploading", error: undefined }
              : i,
          ),
        );
        try {
          const photo = await upload(item);
          if (alive.current)
            setItems((old) =>
              old.map((i) =>
                i.requestId === item.requestId
                  ? { ...i, state: "uploaded", photo }
                  : i,
              ),
            );
        } catch (error) {
          if (alive.current)
            setItems((old) =>
              old.map((i) =>
                i.requestId === item.requestId
                  ? { ...i, state: "error", error: photoError(error) }
                  : i,
              ),
            );
        }
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return { items, error, busy, select, remove, forget, send };
}
export type PhotoQueue = ReturnType<typeof usePhotoQueue>;
