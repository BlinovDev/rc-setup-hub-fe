import type { QueryClient } from "@tanstack/react-query";
import type { components } from "../../api/generated/schema";
import { currentUserKey } from "./queries";

const generations = new WeakMap<QueryClient, number>();
const viewer = (client: QueryClient) =>
  client.getQueryData<components["schemas"]["User"] | null>(currentUserKey)?.id;

// A completion belongs to the session that started it, including sign-out/sign-in
// back into the same account. This is an in-memory lifetime, never a session token.
export function captureSession(client: QueryClient) {
  const id = viewer(client),
    generation = generations.get(client);
  return () => id === viewer(client) && generation === generations.get(client);
}

export function watchSessionCache(client: QueryClient) {
  let previous = viewer(client);
  return client.getQueryCache().subscribe((event) => {
    if (
      event.type !== "updated" ||
      event.query.queryKey[0] !== "auth" ||
      event.query.queryKey[1] !== "me"
    )
      return;
    const next = viewer(client);
    if (previous === next) return;
    previous = next;
    generations.set(client, (generations.get(client) ?? 0) + 1);
    const filters = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        ["setups", "users", "friendships"].includes(String(query.queryKey[0])),
    };
    // cancelQueries aborts synchronously; remove before the new viewer renders.
    void client.cancelQueries(filters);
    client.removeQueries(filters);
  });
}
