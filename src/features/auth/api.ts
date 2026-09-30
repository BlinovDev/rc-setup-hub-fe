import { apiClient } from "../../api/client";

export async function getCurrentUser(signal: AbortSignal) {
  const { data, response } = await apiClient.GET("/api/v1/me", { signal });
  if (response.status === 401) return null;
  if (response.status !== 200 || data === undefined) {
    throw new Error("Unable to check your session.");
  }
  return data;
}

export async function logout() {
  const { response } = await apiClient.POST("/api/v1/auth/logout");
  if (response.status !== 204) throw new Error("Sign out failed.");
}
