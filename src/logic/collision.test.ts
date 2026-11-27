import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import {
  circleVsBox,
  circleVsCircle,
  resolveHearse,
  type Box,
  type Circle,
} from "./collision";
import { initialHearse, stepHearse } from "./hearse";

const R = CONFIG.hearse.radius;
const box = (minX: number, maxX: number, minZ: number, maxZ: number): Box => ({
  kind: "box",
  minX,
  maxX,
  minZ,
  maxZ,
});
const circle = (x: number, z: number, r: number): Circle => ({
  kind: "circle",
  x,
  z,
  r,
});

describe("circleVsCircle", () => {
  it("returns null when the circles are apart or only touch", () => {
    expect(circleVsCircle(circle(0, 0, 1), circle(3, 0, 1))).toBeNull();
    expect(circleVsCircle(circle(0, 0, 1), circle(2, 0, 1))).toBeNull();
  });

  it("pushes the first circle away along the line of the centres", () => {
    const push = circleVsCircle(circle(0, 0, 1), circle(1.5, 0, 1));
    expect(push?.x).toBeCloseTo(-0.5);
    expect(push?.z).toBeCloseTo(0);
    const diagonal = circleVsCircle(circle(0, 0, 1), circle(1, 1, 1));
    const length = Math.hypot(diagonal?.x ?? 0, diagonal?.z ?? 0);
    expect(length).toBeCloseTo(2 - Math.SQRT2);
    expect(diagonal?.x).toBeLessThan(0);
    expect(diagonal?.z).toBeLessThan(0);
  });

  it("pushes out when the centres are the same", () => {
    const push = circleVsCircle(circle(2, 2, 1), circle(2, 2, 0.5));
    expect(Math.hypot(push?.x ?? 0, push?.z ?? 0)).toBeCloseTo(1.5);
  });
});

describe("circleVsBox", () => {
  const wall = box(-5, 5, 0, 1);

  it("returns null when the circle is apart or only touches", () => {
    expect(circleVsBox(circle(0, -3, 1), wall)).toBeNull();
    expect(circleVsBox(circle(0, -1, 1), wall)).toBeNull();
    expect(circleVsBox(circle(8, 0.5, 1), wall)).toBeNull();
  });

  it("pushes out from a face", () => {
    const push = circleVsBox(circle(0, -0.4, 1), wall);
    expect(push?.x).toBeCloseTo(0);
    expect(push?.z).toBeCloseTo(-0.6);
    const side = circleVsBox(circle(5.5, 0.5, 1), wall);
    expect(side?.x).toBeCloseTo(0.5);
    expect(side?.z).toBeCloseTo(0);
  });

  it("pushes out from a corner along the line to the corner", () => {
    const push = circleVsBox(circle(5.5, -0.5, 1), wall);
    const length = Math.hypot(push?.x ?? 0, push?.z ?? 0);
    expect(length).toBeCloseTo(1 - Math.SQRT1_2);
    expect(push?.x).toBeGreaterThan(0);
    expect(push?.z).toBeLessThan(0);
    expect(circleVsBox(circle(6.2, -0.8, 1), wall)).toBeNull();
  });

  it("pushes out through the nearest face when the centre is inside", () => {
    const north = circleVsBox(circle(0, 0.2, 0.5), wall);
    expect(north?.x).toBeCloseTo(0);
    expect(north?.z).toBeCloseTo(-0.7);
    const south = circleVsBox(circle(0, 0.8, 0.5), wall);
    expect(south?.z).toBeCloseTo(0.7);
    const east = circleVsBox(circle(4.9, 0.5, 0.5), box(-5, 5, -5, 5));
    expect(east?.x).toBeCloseTo(0.6);
    const west = circleVsBox(circle(-4.9, 0.5, 0.5), box(-5, 5, -5, 5));
    expect(west?.x).toBeCloseTo(-0.6);
  });
});

describe("resolveHearse", () => {
  const bounds = box(-10, 10, -10, 10);

  it("keeps a free hearse as it is", () => {
    const state = { x: 1, z: 2, heading: 0.3, speed: 5 };
    expect(resolveHearse(state, R, [circle(6, 6, 0.5)], bounds)).toBe(state);
  });

  it("pushes the hearse out of an obstacle and stops it", () => {
    const state = { x: 0, z: 0, heading: 0, speed: 6 };
    const result = resolveHearse(state, R, [circle(0, 1.5, 0.5)], bounds);
    expect(result.speed).toBe(0);
    expect(Math.hypot(result.x, result.z - 1.5)).toBeCloseTo(R + 0.5);
    expect(result.heading).toBe(state.heading);
  });

  it("pushes the hearse out of a box", () => {
    const state = { x: 0, z: 0, heading: 0, speed: 6 };
    const result = resolveHearse(state, R, [box(-3, 3, 1, 2)], bounds);
    expect(result.speed).toBe(0);
    expect(result.z).toBeCloseTo(1 - R);
  });

  it("keeps the hearse inside the bounds", () => {
    const state = { x: 9.5, z: -9.9, heading: 0, speed: 3 };
    const result = resolveHearse(state, R, [], bounds);
    expect(result.x).toBeCloseTo(10 - R);
    expect(result.z).toBeCloseTo(-10 + R);
    expect(result.speed).toBe(0);
    const left = resolveHearse({ ...state, x: -20, z: 20 }, R, [], bounds);
    expect(left.x).toBeCloseTo(-10 + R);
    expect(left.z).toBeCloseTo(10 - R);
  });

  it("resolves a tight corner between two boxes", () => {
    const state = { x: 0, z: 0, heading: 0, speed: 4 };
    const corner = [box(-5, 5, 1, 3), box(1, 3, -5, 5)];
    const result = resolveHearse(state, R, corner, bounds);
    for (const obstacle of corner) {
      expect(
        circleVsBox(circle(result.x, result.z, R - 1e-6), obstacle),
      ).toBeNull();
    }
  });
});

describe("no tunnelling at the greatest speed", () => {
  const dt = CONFIG.logicStepSeconds;
  const thinWall = box(-55, 55, 30, 30 + CONFIG.map.wallThickness);
  const post = circle(0, 30, 0.3);

  function drive(
    angle: number,
    obstacles: readonly (Box | Circle)[],
    steps: number,
  ): { x: number; z: number }[] {
    let state = initialHearse(0, 0, angle);
    const track: { x: number; z: number }[] = [];
    // The joystick vector points where the hearse is already turned.
    const input = { x: Math.sin(angle), y: -Math.cos(angle) };
    const bounds = box(-60, 60, -60, 60);
    for (let i = 0; i < steps; i += 1) {
      state = resolveHearse(
        stepHearse(state, input, dt, CONFIG.hearse),
        R,
        obstacles,
        bounds,
      );
      track.push({ x: state.x, z: state.z });
    }
    return track;
  }

  it("does not pass a thin wall", () => {
    // Heading 0 drives toward +z.
    const track = drive(0, [thinWall], 600);
    const top = Math.max(...track.map((point) => point.z));
    expect(top).toBeLessThanOrEqual(30 - R + 1e-6);
    expect(top).toBeGreaterThan(30 - R - 0.5);
  });

  it("does not pass a small post", () => {
    const track = drive(0, [post], 600);
    for (const point of track) {
      expect(
        Math.hypot(point.x - post.x, point.z - post.z),
      ).toBeGreaterThanOrEqual(R + post.r - 1e-6);
    }
  });

  it("does not pass a wall at an angle", () => {
    const track = drive(0.6, [thinWall], 900);
    expect(Math.max(...track.map((point) => point.z))).toBeLessThanOrEqual(
      30 - R + 1e-6,
    );
  });

  it("moves at the greatest speed before the hit", () => {
    const track = drive(0, [thinWall], 120);
    const step = (track[100]?.z ?? 0) - (track[99]?.z ?? 0);
    expect(step).toBeCloseTo(CONFIG.hearse.maxSpeed * dt, 3);
  });
});
