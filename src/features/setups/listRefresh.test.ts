import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import {
  refreshSetupLists,
  detailKey,
  mineKey,
  userSetupsKey,
} from "./queries";
import { photosKey, refreshPhotos } from "./photos/queries";

it.each(["setup", "photo", "unknown-owner"] as const)(
  "%s writes refresh affected lists without invalidating unrelated owners or auth",
  async (write) => {
    const client = new QueryClient();
    const affected = [mineKey, ["setups", "search", { q: "drift" }]];
    const retained: readonly unknown[][] = [
      ["auth", "me"],
      ["chassis", "brands"],
      [...userSetupsKey("other")],
      [...detailKey("other-setup")],
    ];
    const owner = userSetupsKey("owner");
    const detail = detailKey("setup");
    const gallery = [...photosKey("setup"), "viewer"];
    const media = [...detail, "media", "viewer", "photo", true, 2];
    const all = [...affected, ...retained, owner, detail, gallery, media];
    all.forEach((key) => client.setQueryData(key, "cached"));
    try {
      if (write === "photo") await refreshPhotos(client, "setup", "owner");
      else
        await refreshSetupLists(
          client,
          write === "setup" ? "owner" : undefined,
        );
      const invalidated: (readonly unknown[])[] = [
        ...affected,
        ...(write !== "unknown-owner" ? [owner] : []),
        ...(write === "photo" ? [detail, gallery] : []),
      ];
      for (const key of all) {
        expect(client.getQueryState(key)?.isInvalidated).toBe(
          invalidated.includes(key),
        );
        expect(client.getQueryData(key)).toBe("cached");
      }
    } finally {
      client.clear();
    }
  },
);
