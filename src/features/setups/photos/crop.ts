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
  const size = Math.max(1, Math.round(Math.min(width, height) / zoom));
  return boundCrop(
    {
      size,
      x: crop.x + (crop.size - size) / 2,
      y: crop.y + (crop.size - size) / 2,
    },
    width,
    height,
  );
}
