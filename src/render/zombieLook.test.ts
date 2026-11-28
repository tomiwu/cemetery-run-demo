import { describe, expect, it } from "vitest";
import { zombiePose } from "./zombieLook";

describe("zombiePose", () => {
  it("keeps every angle small and repeats each cycle", () => {
    for (let phase = 0; phase < 4; phase += 0.1) {
      const pose = zombiePose(phase);
      expect(Math.abs(pose.legSwing)).toBeLessThan(0.6);
      expect(Math.abs(pose.armSwing)).toBeLessThan(0.25);
      expect(pose.bob).toBeGreaterThanOrEqual(0);
      expect(pose.bob).toBeLessThan(0.1);
      const again = zombiePose(phase + 1);
      expect(again.legSwing).toBeCloseTo(pose.legSwing, 6);
    }
  });

  it("swings the legs against each other", () => {
    const pose = zombiePose(0.25);
    expect(pose.legSwing).not.toBeCloseTo(0, 3);
  });
});
