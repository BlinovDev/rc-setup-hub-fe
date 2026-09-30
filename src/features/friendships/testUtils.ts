import type { components } from "../../api/generated/schema";
import { apiUrl } from "../../api/config";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import { testUser } from "../setups/testFixtures";
export { renderSetupRoute as renderFriendsRoute } from "../setups/testUtils";
export const friendshipUrl = `${apiUrl}/api/v1/friendships`;
export const searchUrl = `${apiUrl}/api/v1/users/search`;
export const alice = {
  id: "c61393b6-daa0-4eb8-923c-57aedbb46a60",
  nickname: "Alice",
  avatar_url: "https://example.test/alice.png",
} satisfies components["schemas"]["PublicProfile"];
export const bob = {
  ...alice,
  id: "c61393b6-daa0-4eb8-923c-57aedbb46a61",
  nickname: "Bob",
  avatar_url: null,
};
export const charlie = {
  ...bob,
  id: "c61393b6-daa0-4eb8-923c-57aedbb46a62",
  nickname: "Charlie",
};
export const driver = {
  ...bob,
  id: "c61393b6-daa0-4eb8-923c-57aedbb46a63",
  nickname: "Driver Two",
};
export const timestamp = "2026-09-30T12:00:00Z";
export function item(
  user: components["schemas"]["PublicProfile"],
  id = user.id,
): components["schemas"]["FriendshipItem"] {
  return { id, user, created_at: timestamp, updated_at: timestamp };
}
export function emptyList(): components["schemas"]["FriendshipList"] {
  return { incoming: [], outgoing: [], accepted: [] };
}
export function fullList(): components["schemas"]["FriendshipList"] {
  return {
    incoming: [item(alice)],
    outgoing: [item(bob)],
    accepted: [item(charlie)],
  };
}
export function relationship(
  status: "pending" | "accepted",
  other: components["schemas"]["PublicProfile"] = driver,
): components["schemas"]["FriendshipRelationship"] {
  return {
    id: other.id,
    requester_id: testUser.id,
    addressee_id: other.id,
    status,
    created_at: timestamp,
    updated_at: timestamp,
  };
}
export function mockList(list = fullList()) {
  server.use(
    http.get(friendshipUrl, ({ request }) => {
      if (request.credentials !== "include")
        throw new Error("Missing credentials");
      return HttpResponse.json(list);
    }),
  );
}
