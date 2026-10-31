import { useRef } from "react";
import { Button } from "../../../shared/components/Button";

export type Axle = "front" | "rear";

export function AxleTabs({
  label,
  idPrefix,
  panelIds,
  value,
  onChange,
}: {
  label: string;
  idPrefix: string;
  panelIds?: Partial<Record<Axle, string>>;
  value: Axle;
  onChange: (axle: Axle) => void;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="tablist"
      aria-label={`${label} axle`}
      className="suspension-tabs"
    >
      {(["front", "rear"] as const).map((axle, index) => (
        <Button
          key={axle}
          ref={(node) => {
            tabs.current[index] = node;
          }}
          role="tab"
          id={`${idPrefix}-${axle}-tab`}
          aria-controls={panelIds?.[axle] ?? `${idPrefix}-${axle}-panel`}
          aria-selected={value === axle}
          tabIndex={value === axle ? 0 : -1}
          onClick={() => onChange(axle)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
            onChange(next === 0 ? "front" : "rear");
            tabs.current[next]?.focus();
          }}
        >
          {axle === "front" ? "Front" : "Rear"}
        </Button>
      ))}
    </div>
  );
}
