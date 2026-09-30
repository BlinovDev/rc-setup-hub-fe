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
