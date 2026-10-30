import { apiClient } from "../../api/client";
import type { paths } from "../../api/generated/schema";
import { SetupError } from "../setups/api";
import type { DiscoveryFilters } from "./filters";
export async function searchSetups(
  filters: DiscoveryFilters,
  cursor: string | null,
  signal: AbortSignal,
) {
  const query: NonNullable<
    paths["/api/v1/setups/search"]["get"]["parameters"]["query"]
  > = { limit: filters.limit };
  if (filters.q) query.q = filters.q;
  if (filters.brandId) query.brand_id = filters.brandId;
  if (filters.modelId) query.model_id = filters.modelId;
  if (cursor) query.cursor = cursor;
  const personal = filters.scope && filters.scope !== "all";
  const { data, response } = await apiClient.GET(
    personal ? "/api/v1/setups/visible" : "/api/v1/setups/search",
    {
      params: {
        query: { ...query, ...(personal ? { scope: filters.scope } : {}) },
      },
      cache: "no-store",
      signal,
    },
  );
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
