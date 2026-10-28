import { apiClient } from "../../api/client";
import { SetupError } from "../setups/api";
import type { paths } from "../../api/generated/schema";
export async function visibleSetups(
  q: string,
  cursor: string | null,
  signal: AbortSignal,
) {
  const query: NonNullable<
    paths["/api/v1/setups/visible"]["get"]["parameters"]["query"]
  > = { limit: 20 };
  if (q) query.q = q;
  if (cursor) query.cursor = cursor;
  const { data, response } = await apiClient.GET("/api/v1/setups/visible", {
    params: { query },
    signal,
    cache: "no-store",
  });
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
export async function compareSetups(
  left: string,
  right: string,
  guest: boolean,
  signal: AbortSignal,
) {
  const { data, response } = await apiClient.GET("/api/v1/setups/compare", {
    params: { query: { left_id: left, right_id: right } },
    signal,
    cache: "no-store",
  });
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  if (
    !data.left ||
    !data.right ||
    typeof data.left.id !== "string" ||
    typeof data.right.id !== "string" ||
    !data.left.data ||
    !data.right.data ||
    typeof data.left.data !== "object" ||
    typeof data.right.data !== "object" ||
    Array.isArray(data.left.data) ||
    Array.isArray(data.right.data) ||
    data.left.id.toLowerCase() !== left ||
    data.right.id.toLowerCase() !== right ||
    (guest &&
      (data.left.visibility !== "public" ||
        data.right.visibility !== "public" ||
        data.left.moderation_status !== "approved" ||
        data.right.moderation_status !== "approved"))
  )
    throw new SetupError(404);
  return data;
}
