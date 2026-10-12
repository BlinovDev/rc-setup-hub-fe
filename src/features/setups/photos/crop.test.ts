import { expect, it } from "vitest";
import { centerCrop, boundCrop, zoomCrop } from "./crop";
it.each([
  [300, 400],
  [900, 1600],
  [400, 400],
  [400, 300],
  [1600, 900],
  [1, 2],
  [7, 4],
])("uses bounded integer normalized pixels for %sx%s", (width, height) => {
  const center = centerCrop(width, height);
  expect(center).toEqual({
    size: Math.min(width, height),
    x: Math.floor((width - Math.min(width, height)) / 2),
    y: Math.floor((height - Math.min(width, height)) / 2),
  });
  for (const zoom of [1, 1.33, 2, 8]) {
    const crop = zoomCrop(center, zoom, width, height);
    expect(
      Number.isInteger(crop.size) &&
        Number.isInteger(crop.x) &&
        Number.isInteger(crop.y),
    ).toBe(true);
    expect(crop.size).toBeGreaterThan(0);
    expect(crop.x + crop.size).toBeLessThanOrEqual(width);
    expect(crop.y + crop.size).toBeLessThanOrEqual(height);
    expect(boundCrop({ ...crop, x: -100, y: 99999 }, width, height)).toEqual({
      ...crop,
      x: 0,
      y: height - crop.size,
    });
  }
});
