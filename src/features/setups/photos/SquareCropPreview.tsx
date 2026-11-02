import {
  useEffect,
  useId,
  useRef,
  type RefObject,
  type ReactEventHandler,
} from "react";
import type { components } from "../../../api/generated/schema";
import { maxCropZoom, panCrop, zoomCropAt } from "./crop";
type Crop = components["schemas"]["PhotoCrop"];

// Shared square framing surface for normalized setup photos and local avatars.
export function SquareCropPreview({
  width,
  height,
  crop,
  ready,
  onChange,
  imageRef,
  src,
  alt = "Normalized photo crop preview",
  label = "Square thumbnail preview",
  onLoad,
  onError,
  hidden = false,
  resetKey = 0,
}: {
  hidden?: boolean;
  resetKey?: number;
  width: number;
  height: number;
  crop: Crop;
  ready: boolean;
  onChange: (crop: Crop) => void;
  imageRef: RefObject<HTMLImageElement | null>;
  src?: string;
  alt?: string;
  label?: string;
  onLoad: ReactEventHandler<HTMLImageElement>;
  onError: ReactEventHandler<HTMLImageElement>;
}) {
  const instructionsId = useId();
  type Point = { x: number; y: number };
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ crop: Crop; points: Point[] } | null>(null);
  useEffect(() => {
    pointers.current.clear();
    gesture.current = null;
  }, [resetKey]);
  const zoomLimit = maxCropZoom(width, height);
  const actualZoom = Math.min(width, height) / crop.size;
  const legacyZoom = actualZoom > zoomLimit + 0.01;
  function startGesture() {
    gesture.current = { crop, points: [...pointers.current.values()] };
  }
  function change(next: Crop) {
    if (ready) onChange(next);
  }
  return (
    <div className="crop-stage" hidden={hidden}>
      <div
        className="crop-preview"
        role="group"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 1;
          const move = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
          }[event.key];
          if (move) {
            event.preventDefault();
            change({
              ...crop,
              x: crop.x + move[0]!,
              y: crop.y + move[1]!,
            });
            return;
          }
          if (["+", "=", "Add"].includes(event.key)) {
            event.preventDefault();
            if (!legacyZoom)
              change(zoomCropAt(crop, actualZoom + 0.25, width, height));
          } else if (["-", "_", "Subtract"].includes(event.key)) {
            event.preventDefault();
            change(zoomCropAt(crop, actualZoom - 0.25, width, height));
          }
        }}
        aria-describedby={instructionsId}
        onPointerDown={(event) => {
          if (
            !ready ||
            pointers.current.size >= 2 ||
            (event.pointerType === "mouse" && event.button !== 0)
          )
            return;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          startGesture();
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (!start || !pointers.current.has(event.pointerId) || !ready)
            return;
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          const points = [...pointers.current.values()];
          const box = event.currentTarget.getBoundingClientRect();
          if (box.width <= 0) return;
          if (start.points.length === 2 && points.length === 2 && !legacyZoom) {
            const distance = (p: Point[]) =>
              Math.hypot(p[1]!.x - p[0]!.x, p[1]!.y - p[0]!.y);
            const midpoint = (p: Point[]) => ({
              x: ((p[0]!.x + p[1]!.x) / 2 - box.left) / box.width,
              y: ((p[0]!.y + p[1]!.y) / 2 - box.top) / box.width,
            });
            const initial = distance(start.points);
            if (initial < 1) return;
            const zoom =
              ((Math.min(width, height) / start.crop.size) * distance(points)) /
              initial;
            change(
              zoomCropAt(
                start.crop,
                zoom,
                width,
                height,
                midpoint(start.points),
                midpoint(points),
              ),
            );
          } else if (points.length === 1 && start.points.length === 1) {
            change(
              panCrop(
                start.crop,
                points[0]!.x - start.points[0]!.x,
                points[0]!.y - start.points[0]!.y,
                box.width,
                width,
                height,
              ),
            );
          }
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          startGesture();
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          startGesture();
        }}
        onLostPointerCapture={(event) => {
          pointers.current.delete(event.pointerId);
          startGesture();
        }}
      >
        <img
          ref={imageRef}
          alt={alt}
          draggable={false}
          style={{
            width: `${(width / crop.size) * 100}%`,
            height: `${(height / crop.size) * 100}%`,
            left: `${(-crop.x / crop.size) * 100}%`,
            top: `${(-crop.y / crop.size) * 100}%`,
          }}
          src={src}
          onLoad={onLoad}
          onError={onError}
        />
      </div>
      <p id={instructionsId} className="sr-only">
        Drag to move and pinch to zoom. With a keyboard, use arrow keys to move
        and plus or minus to zoom. Coordinates use integer pixels.
      </p>
      <p role="status" className="crop-zoom-status">
        Zoom {actualZoom.toFixed(2)}×
      </p>
      {legacyZoom && (
        <p className="crop-legacy-warning">
          The saved crop is tighter than the 4× editing range. It is preserved.
          Reset to center to adjust zoom.
        </p>
      )}
    </div>
  );
}
