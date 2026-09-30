import { apiClient } from "../../api/client";

export class ChassisError extends Error {
  constructor(public readonly status: number) {
    super("Catalog request failed");
  }
}
export async function getBrands(signal: AbortSignal) {
  const { data, response } = await apiClient.GET("/api/v1/chassis/brands", {
    signal,
  });
  if (response.status !== 200 || !data) throw new ChassisError(response.status);
  return data;
}
export async function getModels(brandId: string, signal: AbortSignal) {
  const { data, response } = await apiClient.GET(
    "/api/v1/chassis/brands/{brand_id}/models",
    { params: { path: { brand_id: brandId } }, signal },
  );
  if (response.status !== 200 || !data) throw new ChassisError(response.status);
  return data;
}
