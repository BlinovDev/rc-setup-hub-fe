import { queryOptions, skipToken } from "@tanstack/react-query";
import { getBrands, getModels } from "./api";

export const brandsOptions = queryOptions({
  queryKey: ["chassis", "brands"],
  queryFn: ({ signal }) => getBrands(signal),
  staleTime: 300_000,
  retry: false,
});
export function modelsOptions(brandId: string | null) {
  return queryOptions({
    queryKey: ["chassis", "models", brandId],
    queryFn: brandId ? ({ signal }) => getModels(brandId, signal) : skipToken,
    staleTime: 300_000,
    retry: false,
  });
}
