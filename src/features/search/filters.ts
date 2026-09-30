export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function readFilters(params: URLSearchParams) {
  const q = (params.get("q") ?? "").trim();
  const brandId = params.get("brand_id") || null;
  const modelId = params.get("model_id") || null;
  return {
    filters: { q, brandId, modelId, limit: 20 },
    valid:
      q.length <= 100 &&
      !q.includes("\0") &&
      (!brandId || isUuid(brandId)) &&
      (!modelId || isUuid(modelId)),
  };
}
export type DiscoveryFilters = ReturnType<typeof readFilters>["filters"];
export function filterParams(filters: DiscoveryFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.brandId) params.set("brand_id", filters.brandId);
  if (filters.modelId) params.set("model_id", filters.modelId);
  return params;
}
