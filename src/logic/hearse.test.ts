import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import {
  blendHearse,
  initialHearse,
  stepHearse,
  type HearseState,
} from "./hearse";

const cfg = CONFIG.hearse;
const STEP = 1 / 60;
const up = { x: 0, y: 1 };
const right = { x: 1, y: 0 };
const none = { x: 0, y: 0 };

function run(
  state: HearseState,
  input: { x: number; y: number },
  seconds: number,
): HearseState {
  let s = state;
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
    s = stepHearse(s, input, STEP, cfg);
  }
  return s;
}

describe("stepHearse", () => {
  it("drives straight away from the camera (-z) with input up", () => {
    const s = run(initialHearse(0, 0, Math.PI), up, 2);
    expect(s.z).toBeLessThan(-10);
    expect(Math.abs(s.x)).toBeLessThan(0.01);
    expect(s.speed).toBeCloseTo(cfg.maxSpeed);
  });

  it("drives to +x with input right", () => {
    const s = run(initialHearse(0, 0, Math.PI / 2), right, 2);
    expect(s.x).toBeGreaterThan(10);
    expect(Math.abs(s.z)).toBeLessThan(0.01);
  });

  it("speeds up with the set acceleration", () => {
    const s = run(initialHearse(0, 0, Math.PI), up, 0.5);
    expect(s.speed).toBeCloseTo(cfg.acceleration * 0.5, 1);
  });

  it("goes slower for a shorter input vector", () => {
    const s = run(initialHearse(0, 0, Math.PI), { x: 0, y: 0.5 }, 3);
    expect(s.speed).toBeCloseTo(cfg.maxSpeed * 0.5);
  });

  it("limits the turn rate", () => {
    const start = initialHearse(0, 0, 0);
    const s = run({ ...start, speed: cfg.maxSpeed }, { x: 0, y: 1 }, 0.1);
    // Target heading is PI (away from the camera). 0.1 s turns at most turnRate * 0.1.
    expect(Math.abs(s.heading)).toBeLessThanOrEqual(cfg.turnRate * 0.1 + 1e-9);
    expect(Math.abs(s.heading)).toBeGreaterThan(0);
  });

  it("turns slower at low speed", () => {
    const slow = stepHearse(initialHearse(0, 0, 0), up, STEP, cfg);
    const fast = stepHearse(
      { ...initialHearse(0, 0, 0), speed: cfg.maxSpeed },
      up,
      STEP,
      cfg,
    );
    expect(Math.abs(slow.heading)).toBeLessThan(Math.abs(fast.heading));
    expect(Math.abs(slow.heading)).toBeGreaterThan(0);
  });

  it("turns the short way round", () => {
    // Heading just under PI, target just over -PI: the short way crosses the wrap point.
    const state = { x: 0, z: 0, heading: Math.PI - 0.01, speed: 5 };
    const s = stepHearse(state, { x: -0.05, y: 1 }, STEP, cfg);
    expect(s.heading).toBeGreaterThan(Math.PI - 0.01);
  });

  it("stops after release", () => {
    const moving = run(initialHearse(0, 0, Math.PI), up, 2);
    const stopped = run(moving, none, 2);
    expect(stopped.speed).toBe(0);
    const again = stepHearse(stopped, none, STEP, cfg);
    expect(again.x).toBe(stopped.x);
    expect(again.z).toBe(stopped.z);
  });

  it("slows down with the set deceleration", () => {
    const state = { x: 0, z: 0, heading: 0, speed: 10 };
    const s = run(state, none, 0.5);
    expect(s.speed).toBeCloseTo(10 - cfg.deceleration * 0.5, 1);
  });

  it("keeps the heading without input", () => {
    const s = run({ x: 0, z: 0, heading: 1.2, speed: 5 }, none, 0.3);
    expect(s.heading).toBe(1.2);
  });

  it("gives no NaN with zero input", () => {
    let s = initialHearse(0, 0, 0);
    for (let i = 0; i < 100; i += 1) {
      s = stepHearse(s, none, STEP, cfg);
    }
    expect(Object.values(s).every(Number.isFinite)).toBe(true);
  });

  it("gives no NaN for a zero or negative dt", () => {
    const state = { x: 1, z: 2, heading: 0.5, speed: 3 };
    for (const dt of [0, -1]) {
      const s = stepHearse(state, up, dt, cfg);
      expect(Object.values(s).every(Number.isFinite)).toBe(true);
      expect(s.x).toBeCloseTo(state.x);
      expect(s.z).toBeCloseTo(state.z);
    }
  });

  it("clamps dt to the longest step", () => {
    const state = { x: 0, z: 0, heading: 0, speed: 10 };
    const big = stepHearse(state, { x: 0, y: -1 }, 5, cfg);
    const clamped = stepHearse(state, { x: 0, y: -1 }, cfg.maxStepSeconds, cfg);
    expect(big).toEqual(clamped);
  });

  it("limits a vector longer than 1", () => {
    const s = run(initialHearse(0, 0, Math.PI), { x: 0, y: 5 }, 3);
    expect(s.speed).toBeCloseTo(cfg.maxSpeed);
  });
});

describe("blendHearse", () => {
  const a = { x: 0, z: 0, heading: 0, speed: 0 };
  const b = { x: 2, z: -4, heading: 1, speed: 10 };

  it("gives the ends at alpha 0 and 1", () => {
    expect(blendHearse(a, b, 0)).toEqual(a);
    expect(blendHearse(a, b, 1)).toEqual(b);
  });

  it("gives the middle at alpha 0.5", () => {
    expect(blendHearse(a, b, 0.5)).toEqual({
      x: 1,
      z: -2,
      heading: 0.5,
      speed: 5,
    });
  });

  it("clamps alpha and turns the short way round", () => {
    const left = { ...a, heading: Math.PI - 0.1 };
    const right = { ...a, heading: -Math.PI + 0.1 };
    const mid = blendHearse(left, right, 0.5);
    expect(Math.cos(mid.heading)).toBeLessThan(-0.99);
    expect(blendHearse(a, b, 5)).toEqual(b);
    expect(blendHearse(a, b, -5)).toEqual(a);
  });
});
