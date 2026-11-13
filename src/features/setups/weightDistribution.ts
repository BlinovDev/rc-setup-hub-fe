import type { components } from "../../api/generated/schema";

export type WeightDistribution = components["schemas"]["WeightDistribution"];
export function calculateWeightDistribution(value?: WeightDistribution | null) {
  if (!value) return null;
  const weights = [
    value.front_left_g,
    value.front_right_g,
    value.rear_left_g,
    value.rear_right_g,
  ];
  if (
    weights.some(
      (weight) =>
        typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0,
    )
  )
    return null;
  const [fl, fr, rl, rr] = weights as [number, number, number, number];
  const total = fl + fr + rl + rr;
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    frontLeft: fl,
    frontRight: fr,
    rearLeft: rl,
    rearRight: rr,
    total,
    front: ((fl + fr) / total) * 100,
    rear: ((rl + rr) / total) * 100,
    left: ((fl + rl) / total) * 100,
    right: ((fr + rr) / total) * 100,
  };
}

export const formatGrams = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
export const formatPercent = (value: number) => `${value.toFixed(1)}%`;
