import { apiClient } from "../../api/client";
import { SetupError } from "../setups/api";
export async function getPublicUser(userId: string, signal: AbortSignal) {
  const { data, response } = await apiClient.GET("/api/v1/users/{user_id}", {
    params: { path: { user_id: userId } },
    signal,
  });
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}

export async function getPublicUserSetups(
  userId: string,
  cursor: string | null,
  signal: AbortSignal,
) {
  const { data, response } = await apiClient.GET(
    "/api/v1/users/{user_id}/public-setups",
    {
      params: {
        path: { user_id: userId },
        query: { limit: 20, ...(cursor ? { cursor } : {}) },
      },
      signal,
    },
  );
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
