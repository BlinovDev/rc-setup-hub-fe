import type { components } from "../../../api/generated/schema";
type Crop = components["schemas"]["PhotoCrop"];
export function centerCrop(width: number, height: number): Crop {
  const size = Math.min(width, height);
  return {
    x: Math.floor((width - size) / 2),
    y: Math.floor((height - size) / 2),
    size,
  };
}
export function boundCrop(crop: Crop, width: number, height: number): Crop {
  const size = Math.max(1, Math.min(Math.round(crop.size), width, height));
  return {
    size,
    x: Math.max(0, Math.min(Math.round(crop.x), width - size)),
    y: Math.max(0, Math.min(Math.round(crop.y), height - size)),
  };
}
export function zoomCrop(
  crop: Crop,
  zoom: number,
  width: number,
  height: number,
): Crop {
  return zoomCropAt(crop, zoom, width, height);
}

/** Normal editing is limited to 4x; tiny images never pretend to have subpixels. */
export function maxCropZoom(width: number, height: number): number {
  return Math.min(4, width, height);
}

export function zoomCropAt(
  crop: Crop,
  zoom: number,
  width: number,
  height: number,
  from = { x: 0.5, y: 0.5 },
  to = from,
): Crop {
  const bounded = Math.max(
    1,
    Math.min(Number.isFinite(zoom) ? zoom : 1, maxCropZoom(width, height)),
  );
  const size = Math.max(
    Math.ceil(Math.min(width, height) / maxCropZoom(width, height)),
    Math.round(Math.min(width, height) / bounded),
  );
  return boundCrop(
    {
      size,
      x: crop.x + from.x * crop.size - to.x * size,
      y: crop.y + from.y * crop.size - to.y * size,
    },
    width,
    height,
  );
}

export function panCrop(
  crop: Crop,
  dx: number,
  dy: number,
  frameWidth: number,
  width: number,
  height: number,
): Crop {
  if (frameWidth <= 0) return crop;
  const scale = crop.size / frameWidth;
  return boundCrop(
    { ...crop, x: crop.x - dx * scale, y: crop.y - dy * scale },
    width,
    height,
  );
}
