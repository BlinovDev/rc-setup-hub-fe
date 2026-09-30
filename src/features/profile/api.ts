import { apiClient } from "../../api/client";
import type { components } from "../../api/generated/schema";

export class ProfileError extends Error {
  constructor(public readonly status: number) {
    super("Profile update failed");
  }
}

export async function updateNickname(body: components["schemas"]["PatchMe"]) {
  const { data, response } = await apiClient.PATCH("/api/v1/me", { body });
  if (response.status !== 200 || !data) throw new ProfileError(response.status);
  return data;
}
