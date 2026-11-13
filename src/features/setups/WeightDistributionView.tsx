import type { components } from "../../api/generated/schema";
import carTopView from "./assets/weight-distribution-car.png";
import {
  calculateWeightDistribution,
  formatGrams,
  formatPercent,
} from "./weightDistribution";

export function WeightDistributionView({
  value,
}: {
  value?: components["schemas"]["WeightDistribution"] | null;
}) {
  const result = calculateWeightDistribution(value);
  if (!result || !value) return null;
  const corners = {
    FL: result.frontLeft,
    FR: result.frontRight,
    RL: result.rearLeft,
    RR: result.rearRight,
  };
  return (
    <section
      className="technical-panel sm:col-span-2"
      aria-labelledby="weight-distribution-title"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3 id="weight-distribution-title" className="font-semibold">
          Weight Distribution
        </h3>
      </header>
      <div
        data-layout="weight-distribution"
        className="mt-4 grid gap-4 md:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)] md:items-center md:gap-6"
      >
        <div className="mx-auto grid w-full max-w-sm grid-cols-[minmax(4rem,1fr)_minmax(5rem,1.6fr)_minmax(4rem,1fr)] items-center gap-x-1 md:mx-0 md:max-w-full">
          <div className="relative z-10 col-start-1 h-72 -mr-5 md:-mr-7">
            <CornerWeight
              id="FL"
              grams={corners.FL}
              className="top-[18%] text-right"
            />
            <CornerWeight
              id="RL"
              grams={corners.RL}
              className="bottom-[18%] text-right"
            />
          </div>
          <img
            className="col-start-2 h-72 w-full object-contain dark:invert"
            src={carTopView}
            alt="Top-down line drawing of a passenger car, front facing up. Left and right are from the vehicle perspective."
          />
          <div className="relative z-10 col-start-3 h-72 -ml-5 md:-ml-7">
            <CornerWeight
              id="FR"
              grams={corners.FR}
              className="top-[18%] text-left"
            />
            <CornerWeight
              id="RR"
              grams={corners.RR}
              className="bottom-[18%] text-left"
            />
          </div>
        </div>
        <div className="min-w-0">
          <div className="mt-5 flex items-baseline gap-3 border-t pt-4 md:mt-0 md:border-0 md:pt-0">
            <p className="text-xs font-semibold tracking-wide opacity-70">
              TOTAL MASS
            </p>
            <p className="text-xl font-semibold">
              {formatGrams(result.total)} g
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BalancePair
              leftLabel="Front"
              leftPercent={result.front}
              rightLabel="Rear"
              rightPercent={result.rear}
            />
            <BalancePair
              leftLabel="Left"
              leftPercent={result.left}
              rightLabel="Right"
              rightPercent={result.right}
            />
          </div>
          <div className="mt-4 border-t pt-4">
            <h4 className="font-medium">Measurement conditions</h4>
            <dl className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
              <div>
                <dt className="inline">Body: </dt>
                <dd className="inline">
                  {value.body_installed ? "Installed" : "Not installed"}
                </dd>
              </div>
              <div>
                <dt className="inline">Battery: </dt>
                <dd className="inline">
                  {value.battery_installed ? "Installed" : "Not installed"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function BalancePair({
  leftLabel,
  leftPercent,
  rightLabel,
  rightPercent,
}: {
  leftLabel: string;
  leftPercent: number;
  rightLabel: string;
  rightPercent: number;
}) {
  return (
    <div
      role="group"
      aria-label={`${leftLabel} to ${rightLabel} balance`}
      className="min-w-0"
    >
      <div className="mb-2 flex justify-between gap-3 text-sm">
        <span>
          <span className="opacity-70">{leftLabel}</span>{" "}
          <strong className="font-semibold tabular-nums">
            {formatPercent(leftPercent)}
          </strong>
        </span>
        <span className="text-right">
          <span className="opacity-70">{rightLabel}</span>{" "}
          <strong className="font-semibold tabular-nums">
            {formatPercent(rightPercent)}
          </strong>
        </span>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        aria-hidden="true"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-slate-300 dark:bg-slate-600"
          style={{ width: `${leftPercent}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full bg-[var(--accent)]"
          style={{ width: `${rightPercent}%` }}
        />
        <div className="absolute inset-y-[-2px] left-1/2 z-10 w-0.5 -translate-x-1/2 bg-slate-800 dark:bg-white" />
      </div>
      <p
        className="relative mt-1 h-3 text-[10px] leading-3 opacity-60"
        aria-hidden="true"
      >
        <span className="absolute left-1/2 -translate-x-1/2">50%</span>
      </p>
      <span className="sr-only">
        The center line marks an even 50/50 distribution.
      </span>
    </div>
  );
}

function CornerWeight({
  id,
  grams,
  className,
}: {
  id: string;
  grams: number;
  className: string;
}) {
  return (
    <div
      className={`absolute left-0 right-0 px-1 py-1 text-xs sm:px-2 sm:text-sm ${className}`}
    >
      <span className="block text-[0.65rem] font-semibold tracking-wide text-[var(--muted)]">
        {id}
      </span>
      <span className="font-semibold tabular-nums">{formatGrams(grams)} g</span>
    </div>
  );
}
