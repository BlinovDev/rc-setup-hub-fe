import type { components } from "../../../api/generated/schema";
import { useId, useRef } from "react";
import { Button } from "../../../shared/components/Button";
import { LowerArmMountFields } from "./LowerArmMountFields";
import { ComponentCard } from "./ComponentCard";
import { SetupField } from "./SetupField";
import { LinkLengthFields } from "./LinkLengthFields";
import type { SuspensionView } from "../suspensionLinks";
export function SuspensionSection({
  side,
  setup,
  view,
  onViewChange,
}: {
  side: "front" | "rear";
  setup?: components["schemas"]["Setup"] | undefined;
  view: SuspensionView;
  onViewChange: (view: SuspensionView) => void;
}) {
  const id = useId(),
    tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const label = side === "front" ? "Front" : "Rear";
  return (
    <fieldset id={`setup-${side}`} className="space-y-4 rounded border p-4">
      <legend className="font-semibold">{label} suspension</legend>
      <div
        role="tablist"
        aria-label={`${label} suspension input view`}
        className="suspension-tabs"
      >
        {(["angles", "links"] as const).map((tab, index) => (
          <Button
            key={tab}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            role="tab"
            id={`${id}-${tab}-tab`}
            aria-controls={`${id}-${tab}`}
            aria-selected={view === tab}
            tabIndex={view === tab ? 0 : -1}
            onClick={() => onViewChange(tab)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
              onViewChange(next === 0 ? "angles" : "links");
              tabs.current[next]?.focus();
            }}
          >
            {tab === "angles" ? "Angles" : "Link lengths"}
          </Button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-angles`}
        aria-labelledby={`${id}-angles-tab`}
        hidden={view !== "angles"}
      >
        <div className="related-fields">
          {(["camber", "caster", "toe"] as const).map((key) => (
            <SetupField
              key={key}
              name={`${side}.${key}_deg`}
              label={`${label} ${key} (degrees)`}
              numeric
            />
          ))}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${id}-links`}
        aria-labelledby={`${id}-links-tab`}
        hidden={view !== "links"}
      >
        <LinkLengthFields side={side} />
      </div>
      {side === "rear" && (
        <ComponentCard id="rear-mount">
          <LowerArmMountFields side={side} setup={setup} />
        </ComponentCard>
      )}
      {(["top", "lower"] as const).map((arm) => (
        <ComponentCard key={arm} id={`${side}-${arm}-spacing`}>
          <fieldset className="space-y-3 rounded border p-3">
            <legend>
              {label} {arm} arm spacing
            </legend>
            <p>
              Totals ahead of and behind the arm, in vehicle direction;
              symmetric left and right.
            </p>
            <div className="related-fields">
              {(["front", "rear"] as const).map((position) => (
                <SetupField
                  key={position}
                  name={`${side}.${arm}_arm_spacing.${position}_mm`}
                  label={`${label} ${arm} arm — ${position === "front" ? "Front" : "Rear"} spacers (mm)`}
                  numeric
                />
              ))}
            </div>
          </fieldset>
        </ComponentCard>
      ))}
    </fieldset>
  );
}
