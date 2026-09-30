import { apiClient } from "../../api/client";
import type { components } from "../../api/generated/schema";
import { SetupError } from "../setups/api";

// Shares the existing status-based session boundary; response bodies stay generated.
export class FriendshipError extends SetupError {}
export async function getFriendships(signal: AbortSignal) {
  const { data, response } = await apiClient.GET("/api/v1/friendships", {
    signal,
  });
  if (response.status !== 200 || !data)
    throw new FriendshipError(response.status);
  return data;
}
export async function searchUsers(q: string, signal: AbortSignal) {
  const { data, response } = await apiClient.GET("/api/v1/users/search", {
    params: { query: { q } },
    signal,
  });
  if (response.status !== 200 || !data)
    throw new FriendshipError(response.status);
  return data;
}
export async function sendRequest(
  body: components["schemas"]["CreateFriendship"],
) {
  const { data, response } = await apiClient.POST("/api/v1/friendships", {
    body,
  });
  if (response.status !== 201 || !data)
    throw new FriendshipError(response.status);
  return data;
}
export async function acceptRequest(id: string) {
  const { data, response } = await apiClient.POST(
    "/api/v1/friendships/{id}/accept",
    { params: { path: { id } } },
  );
  if (response.status !== 200 || !data)
    throw new FriendshipError(response.status);
  return data;
}
export async function deleteRelationship(id: string) {
  const { response } = await apiClient.DELETE("/api/v1/friendships/{id}", {
    params: { path: { id } },
  });
  if (response.status !== 204) throw new FriendshipError(response.status);
}
export function friendshipErrorMessage(
  error: Error,
  action: "send" | "accept" | "delete",
) {
  if (error instanceof FriendshipError) {
    if (error.status === 400)
      return action === "send"
        ? "Unable to send this request. Check the selected user; you cannot add yourself."
        : "This friendship request was rejected. Refresh and try again.";
    if (error.status === 403)
      return "This request is not allowed. Please try again from the configured application.";
    if (error.status === 404)
      return action === "send"
        ? "This user is no longer available."
        : "This relationship is no longer available. Refreshing friendship state.";
    if (error.status === 409)
      return action === "send"
        ? "A relationship with this user already exists. Refreshing friendship state."
        : "This relationship has changed. Refreshing friendship state.";
  }
  return "Unable to update friendship. Please try again.";
}
