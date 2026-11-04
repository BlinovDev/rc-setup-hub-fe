import { apiClient } from "../../api/client";
import type { components } from "../../api/generated/schema";

export class ProfileError extends Error {
  constructor(public readonly status: number) {
    super("Profile update failed");
  }
}

export async function updateProfile(body: components["schemas"]["PatchMe"]) {
  const { data, response } = await apiClient.PATCH("/api/v1/me", { body });
  if (response.status !== 200 || !data) throw new ProfileError(response.status);
  return data;
}

export async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data, response } = await apiClient.PUT("/api/v1/me/avatar", {
    body: { file: "" },
    bodySerializer: () => form,
  });
  if (response.status !== 200 || !data) throw new ProfileError(response.status);
  return data;
}
export async function removeAvatar() {
  const { data, response } = await apiClient.DELETE("/api/v1/me/avatar");
  if (response.status !== 200 || !data) throw new ProfileError(response.status);
  return data;
}
