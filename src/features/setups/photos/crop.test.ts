import { expect, it } from "vitest";
import { centerCrop, boundCrop, zoomCrop, panCrop, zoomCropAt } from "./crop";
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

it.each([
  [2400, 2400],
  [900, 1600],
  [1600, 900],
  [1, 2],
  [7, 4],
  [13, 17],
])("caps normal zoom without empty bounds for %sx%s", (w, h) => {
  const start = centerCrop(w, h);
  const crop = zoomCrop(start, 999999, w, h);
  expect(Math.min(w, h) / crop.size).toBeLessThanOrEqual(4);
  expect(zoomCrop(start, Number.NaN, w, h)).toEqual(start);
  expect(zoomCrop(start, 0, w, h)).toEqual(start);
});

it("keeps a pinch focal point stable and translates its midpoint in source pixels", () => {
  const start = centerCrop(2400, 2400);
  const from = { x: 0.4, y: 0.3 },
    to = { x: 0.5, y: 0.4 };
  const next = zoomCropAt(start, 2, 2400, 2400, from, to);
  expect(next.x + to.x * next.size).toBeCloseTo(
    start.x + from.x * start.size,
    0,
  );
  expect(next.y + to.y * next.size).toBeCloseTo(
    start.y + from.y * start.size,
    0,
  );
});
it("pans with the dragged image, clamps boundaries, and ignores zero-size frames", () => {
  const crop = { x: 600, y: 600, size: 1200 };
  expect(panCrop(crop, 32, 16, 320, 2400, 2400)).toEqual({
    x: 480,
    y: 540,
    size: 1200,
  });
  expect(panCrop(crop, 99999, -99999, 320, 2400, 2400)).toEqual({
    x: 0,
    y: 1200,
    size: 1200,
  });
  expect(panCrop(crop, 1, 1, 0, 2400, 2400)).toEqual(crop);
});
