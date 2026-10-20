import { apiClient } from "../../../api/client";
import { SetupError } from "../api";
import type { components } from "../../../api/generated/schema";
// Only translate known validation strings; never render arbitrary server details.
const uploadValidationMessages: Record<string, string> = {
  "invalid photo: unsupported image format":
    "Unsupported photo format. Choose JPEG, PNG, WebP or HEIC/HEIF.",
  "invalid photo: image could not be decoded":
    "This image could not be decoded. Export it as JPEG and choose the exported file.",
  "invalid photo: file must be nonempty and at most 25 MiB":
    "The photo must be nonempty and at most 25 MiB. Choose a smaller file.",
  "file exceeds 25 MiB or is empty":
    "The photo must be nonempty and at most 25 MiB. Choose a smaller file.",
  "invalid photo: image must be at most 50 megapixels":
    "The photo exceeds 50 megapixels. Choose a lower-resolution image.",
  "a setup may have at most 10 photos":
    "This setup already has 10 photos. Remove a saved photo before uploading another.",
  "invalid or oversized multipart body":
    "The upload was incomplete or exceeded the request limit. Retry or choose a smaller file.",
};
class PhotoUploadError extends SetupError {
  constructor(
    status: number,
    public readonly validationMessage?: string,
  ) {
    super(status);
  }
}
export async function cropPhoto(
  id: string,
  photoId: string,
  body: components["schemas"]["PhotoCropUpdate"],
) {
  const { data, response } = await apiClient.PUT(
    "/api/v1/setups/{id}/photos/{photo_id}/crop",
    {
      params: { path: { id, photo_id: photoId } },
      body,
    },
  );
  if (response.status !== 200 || !data) throw new SetupError(response.status);
  return data;
}
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
  const { data, error, response } = await apiClient.POST(
    "/api/v1/setups/{id}/photos",
    {
      params: { path: { id } },
      body: { request_id: requestId, file: file.name },
      bodySerializer: () => form,
    },
  );
  if (response.status !== 201 || !data) {
    const message =
      response.status === 400 &&
      error?.error &&
      Object.hasOwn(uploadValidationMessages, error.error)
        ? uploadValidationMessages[error.error]
        : undefined;
    throw new PhotoUploadError(response.status, message);
  }
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
  if (error instanceof PhotoUploadError && error.validationMessage)
    return error.validationMessage;
  if (error instanceof SetupError) {
    if (error.status === 413)
      return "The server rejected the upload size. Choose a smaller photo; if it is under 25 MiB, report this error.";
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
