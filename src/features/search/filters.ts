import type { SetupScope } from "./SetupPresets";
export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function readFilters(params: URLSearchParams) {
  const scope = params.get("scope") ?? "all";
  const q = (params.get("q") ?? "").trim();
  const brandId = params.get("brand_id") || null;
  const modelId = params.get("model_id") || null;
  return {
    filters: { q, brandId, modelId, limit: 20, scope: scope as SetupScope },
    valid:
      ["all", "mine", "friends"].includes(scope) &&
      q.length <= 100 &&
      !q.includes("\0") &&
      (!brandId || isUuid(brandId)) &&
      (!modelId || isUuid(modelId)),
  };
}
export type DiscoveryFilters = Omit<
  ReturnType<typeof readFilters>["filters"],
  "scope"
> & { scope?: SetupScope };
export function filterParams(filters: DiscoveryFilters) {
  const params = new URLSearchParams();
  if (filters.scope && filters.scope !== "all")
    params.set("scope", filters.scope);
  if (filters.q) params.set("q", filters.q);
  if (filters.brandId) params.set("brand_id", filters.brandId);
  if (filters.modelId) params.set("model_id", filters.modelId);
  return params;
}
