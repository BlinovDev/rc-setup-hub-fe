import { apiClient } from "../../api/client";
import type { components } from "../../api/generated/schema";

export class SetupError extends Error {
  constructor(public readonly status: number) {
    super("Setup request failed");
  }
}
export async function getMySetups(signal: AbortSignal) {
  const { data, response } = await apiClient.GET("/api/v1/me/setups", {
    signal,
  });
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
export async function getSetup(id: string, signal: AbortSignal) {
  const { data, response } = await apiClient.GET("/api/v1/setups/{id}", {
    params: { path: { id } },
    signal,
  });
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
export async function createSetup(body: components["schemas"]["CreateSetup"]) {
  const { data, response } = await apiClient.POST("/api/v1/setups", { body });
  if (response.status !== 201 || !data) throw new SetupError(response.status);
  return data;
}
export async function patchSetup(
  id: string,
  body: components["schemas"]["PatchSetup"],
) {
  const { data, response } = await apiClient.PATCH("/api/v1/setups/{id}", {
    params: { path: { id } },
    body,
  });
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
export async function deleteSetup(id: string) {
  const { response } = await apiClient.DELETE("/api/v1/setups/{id}", {
    params: { path: { id } },
  });
  if (response.status !== 204) throw new SetupError(response.status);
}
export function setupErrorMessage(
  error: Error,
  action: "save" | "delete" | "load",
) {
  if (error instanceof SetupError) {
    if (error.status === 400)
      return action === "load"
        ? "Setup not found or unavailable."
        : "The request was rejected. Please check your values.";
    if (error.status === 403)
      return "This request is not allowed. Please try again from the configured application.";
    if (error.status === 404) return "Setup not found or unavailable.";
    if (error.status === 409)
      return "This setup changed concurrently. Reload the setup before trying again.";
  }
  return `Unable to ${action} ${action === "load" ? "setups" : "setup"}. Please try again.`;
}
export function chassisLabel(setup: components["schemas"]["Setup"]) {
  return setup.chassis
    ? `${setup.chassis.brand_name} ${setup.chassis.model_name}`
    : "Custom / not listed";
}

export async function getUserSetups(userId: string, signal: AbortSignal) {
  const { data, response } = await apiClient.GET(
    "/api/v1/users/{user_id}/setups",
    { params: { path: { user_id: userId } }, signal },
  );
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
