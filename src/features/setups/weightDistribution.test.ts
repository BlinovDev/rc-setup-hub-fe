import { describe, expect, it } from "vitest";
import {
  calculateWeightDistribution,
  formatPercent,
} from "./weightDistribution";

describe("weight distribution calculations", () => {
  it("derives totals and each axis from raw corner weights", () => {
    const result = calculateWeightDistribution({
      front_left_g: 380,
      front_right_g: 400,
      rear_left_g: 320,
      rear_right_g: 350,
      body_installed: true,
      battery_installed: false,
    });
    expect(result?.total).toBe(1450);
    expect(result?.front).toBeCloseTo(53.7931);
    expect(result?.rear).toBeCloseTo(46.2069);
    expect(result?.left).toBeCloseTo(48.2759);
    expect(result?.right).toBeCloseTo(51.7241);
    expect(formatPercent(result!.front)).toBe("53.8%");
  });
  it("hides absent or invalid measurements", () => {
    expect(calculateWeightDistribution()).toBeNull();
    expect(
      calculateWeightDistribution({
        front_left_g: 1,
        front_right_g: 2,
        rear_left_g: 3,
        rear_right_g: null,
        body_installed: false,
        battery_installed: false,
      }),
    ).toBeNull();
  });
});
