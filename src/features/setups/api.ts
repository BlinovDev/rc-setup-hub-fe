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
// Rear's null-only front-field constraint intersects the shared axle schema.
// Normalize its unset slot to omission at the write boundary (same contract
// meaning); openapi-fetch's Writable mapping otherwise treats that slot as never.
function writableData(data: components["schemas"]["SetupDataV1"]) {
  const { suspension, ...rest } = data;
  if (suspension == null)
    return { ...rest, ...(suspension === null ? { suspension: null } : {}) };
  const { rear, ...axles } = suspension;
  if (rear == null)
    return {
      ...rest,
      suspension: { ...axles, ...(rear === null ? { rear: null } : {}) },
    };
  const { steering_tie_rod_length_mm, ...rearOnly } = rear;
  if (steering_tie_rod_length_mm != null)
    throw new Error("Steering tie rod length is front only.");
  return { ...rest, suspension: { ...axles, rear: rearOnly } };
}
export async function createSetup(body: components["schemas"]["CreateSetup"]) {
  const { data, response } = await apiClient.POST("/api/v1/setups", {
    body: { ...body, data: writableData(body.data) },
  });
  if (response.status !== 201 || !data) throw new SetupError(response.status);
  return data;
}
export async function patchSetup(
  id: string,
  body: components["schemas"]["PatchSetup"],
) {
  const { data: technical, ...fields } = body;
  const { data, response } = await apiClient.PATCH("/api/v1/setups/{id}", {
    params: { path: { id } },
    body: {
      ...fields,
      ...(technical === undefined ? {} : { data: writableData(technical) }),
    },
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
export function chassisLabel(
  setup: Pick<components["schemas"]["Setup"], "chassis">,
) {
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
