import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { buildMap } from "../logic/map";
import { grassColor, pathAmount, pathColor } from "./landscape";
import { zombiePose } from "./zombieLook";

const map = buildMap(CONFIG.map);

describe("pathAmount", () => {
  it("is full on the middle of the main road", () => {
    expect(pathAmount(map.roads, 0, 10)).toBeGreaterThan(0.95);
  });

  it("is zero on the grass far from every road", () => {
    expect(pathAmount(map.roads, 12, 10)).toBe(0);
    expect(pathAmount(map.roads, 40, 10)).toBe(0);
  });

  it("stays between 0 and 1 and fades toward the edge", () => {
    const values: number[] = [];
    for (let x = 0; x <= 6; x += 0.25) {
      values.push(pathAmount(map.roads, x, 10));
    }
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i] ?? 0).toBeLessThanOrEqual((values[i - 1] ?? 0) + 0.2);
    }
    expect(values.some((value) => value > 0.1 && value < 0.9)).toBe(true);
  });
});

describe("colours", () => {
  it("makes warm dirt colours in the path range", () => {
    for (let i = 0; i < 20; i += 1) {
      const color = pathColor(i / 20);
      expect(color.r).toBeGreaterThan(color.g);
      expect(color.g).toBeGreaterThan(color.b);
      expect(color.r).toBeGreaterThan(0.2);
    }
  });

  it("makes dark olive grass with a green lead", () => {
    for (let i = 0; i < 20; i += 1) {
      const color = grassColor(i / 20);
      expect(color.g).toBeGreaterThanOrEqual(color.b);
      expect(color.g).toBeLessThan(0.25);
    }
  });
});

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
