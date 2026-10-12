import { apiClient } from "../../../api/client";
import { SetupError } from "../api";
export async function getPhotos(id: string, signal: AbortSignal) {
  const { data, response } = await apiClient.GET("/api/v1/setups/{id}/photos", {
    params: { path: { id } },
    signal,
  });
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
export async function uploadPhoto(id: string, file: File, requestId: string) {
  const form = new FormData();
  form.append("request_id", requestId);
  form.append("file", file);
  const { data, response } = await apiClient.POST(
    "/api/v1/setups/{id}/photos",
    {
      params: { path: { id } },
      body: { request_id: requestId, file: file.name },
      bodySerializer: () => form,
    },
  );
  if (response.status !== 201 || !data) throw new SetupError(response.status);
  return data;
}
export async function chooseCover(id: string, photoId: string) {
  const { data, response } = await apiClient.PUT(
    "/api/v1/setups/{id}/photos/{photo_id}/cover",
    { params: { path: { id, photo_id: photoId } } },
  );
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
export async function deletePhoto(id: string, photoId: string) {
  const { response } = await apiClient.DELETE(
    "/api/v1/setups/{id}/photos/{photo_id}",
    { params: { path: { id, photo_id: photoId } } },
  );
  if (response.status !== 204) throw new SetupError(response.status);
}
export async function getPhotoImage(
  id: string,
  photoId: string,
  thumbnail: boolean,
  signal: AbortSignal,
) {
  const options = {
    params: { path: { id, photo_id: photoId } },
    parseAs: "blob" as const,
    signal,
    cache: "no-store" as const,
  };
  const { data, response } = thumbnail
    ? await apiClient.GET(
        "/api/v1/setups/{id}/photos/{photo_id}/thumbnail",
        options,
      )
    : await apiClient.GET(
        "/api/v1/setups/{id}/photos/{photo_id}/image",
        options,
      );
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
export function photoError(error: unknown) {
  if (error instanceof SetupError) {
    if (error.status === 400)
      return "Photo rejected: use JPEG, PNG, WebP or HEIC/HEIF, at most 25 MiB and 50 megapixels. The setup can have at most 10 photos.";
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403)
      return "Photo changes are not allowed from this application.";
    if (error.status === 404)
      return "Photo or setup not found or unavailable. Reload photos.";
    if (error.status === 409)
      return "This upload changed or was deleted. Remove this selection and choose the file again.";
    if (error.status === 503)
      return "Photo uploads are busy. Retry this file shortly.";
  }
  return "Unable to save photo. Retry this file; your setup and completed uploads are retained.";
}
