import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import {
  circleVsBox,
  circleVsCircle,
  hearseCircles,
  hearseVelocity,
  resolveHearse,
  type BumpEvent,
  type Box,
  type Circle,
  type GraveBody,
  type Shape,
} from "./collision";
import { stepHearse, type HearseState } from "./hearse";

const R = CONFIG.collision.colliderRadius;
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

const DT = CONFIG.logicStepSeconds;
const HEARSE = { ...CONFIG.hearse, knockDecay: CONFIG.collision.knockDecay };
const NONE = { x: 0, y: 0 };

interface Sample {
  state: HearseState;
  events: ReturnType<typeof resolveHearse>["events"];
}

/** Game time, dt 1/60: the hearse steps and the contact resolves, like `stepWorld`. */
function drive(
  start: HearseState,
  input: { x: number; y: number },
  seconds: number,
  obstacles: readonly Shape[],
  graves: readonly GraveBody[] = [],
  bounds = box(-100, 100, -100, 100),
): Sample[] {
  const samples: Sample[] = [];
  let state = start;
  for (let i = 0; i < Math.round(seconds / DT); i += 1) {
    const resolved = resolveHearse(
      stepHearse(state, input, DT, HEARSE),
      DT,
      obstacles,
      bounds,
      graves,
    );
    state = resolved.hearse;
    samples.push({ state, events: resolved.events });
  }
  return samples;
}

const groundSpeed = (state: HearseState): number => {
  const v = hearseVelocity(state);
  return Math.hypot(v.x, v.z);
};
/** Input that points where the hearse is already turned. */
const throttle = (heading: number) => ({
  x: Math.sin(heading),
  y: -Math.cos(heading),
});
const bumps = (samples: readonly Sample[]): BumpEvent[] =>
  samples.flatMap((sample) =>
    sample.events.filter((event): event is BumpEvent => event.type === "bump"),
  );

describe("hearseCircles", () => {
  it("puts two circles on the heading axis", () => {
    const [front, rear] = hearseCircles({ x: 5, z: 7, heading: 0 });
    expect(front.z - 7).toBeCloseTo(CONFIG.collision.colliderOffset);
    expect(rear.z - 7).toBeCloseTo(-CONFIG.collision.colliderOffset);
    expect(front.x).toBeCloseTo(5);
    expect(front.r).toBe(R);
    const [side] = hearseCircles({ x: 0, z: 0, heading: Math.PI / 2 });
    expect(side.x).toBeCloseTo(CONFIG.collision.colliderOffset);
  });
});

describe("resolveHearse: walls", () => {
  // A wall at z = 30 (the hearse comes from z = 0). Heading 0 drives toward +z.
  const wall = box(-200, 200, 30, 30.4);

  /** Approach the wall at `angle` radians from the wall plane, at the greatest speed. */
  function approach(angle: number): HearseState {
    // The wall runs along x. Heading 0 is head-on (angle 90 degrees from the wall).
    const heading = Math.PI / 2 - angle;
    return {
      x: -Math.sin(heading) * 6,
      z: 30 - R - CONFIG.collision.colliderOffset * Math.cos(heading) - 6,
      heading,
      speed: CONFIG.hearse.maxSpeed,
    };
  }

  it("keeps a free hearse as it is", () => {
    const state = { x: 1, z: 2, heading: 0.3, speed: 5 };
    const result = resolveHearse(
      state,
      DT,
      [circle(40, 40, 0.5)],
      box(-90, 90, -90, 90),
    );
    expect(result.hearse).toBe(state);
    expect(result.events).toEqual([]);
  });

  it("keeps at least 75 % of the speed at 30 degrees and slides along the wall", () => {
    const heading = Math.PI / 2 - (30 * Math.PI) / 180;
    const samples = drive(
      approach((30 * Math.PI) / 180),
      throttle(heading),
      2.5,
      [wall],
    );
    const first = samples.findIndex((sample) => sample.events.length > 0);
    expect(first).toBeGreaterThanOrEqual(0);
    const hit = samples[first];
    expect(groundSpeed(hit?.state as HearseState)).toBeGreaterThanOrEqual(
      0.75 * CONFIG.hearse.maxSpeed,
    );
    // More than 3 m along the wall in the next second.
    const from = samples[first]?.state as HearseState;
    const to = samples[first + 60]?.state as HearseState;
    expect(Math.abs(to.x - from.x)).toBeGreaterThan(3);
    // The wall is never crossed.
    for (const sample of samples) {
      expect(sample.state.z).toBeLessThanOrEqual(30 - R + 1e-6);
    }
  });

  it("keeps at least 60 % of the speed at 45 degrees", () => {
    const heading = Math.PI / 4;
    const samples = drive(approach(Math.PI / 4), throttle(heading), 1.5, [
      wall,
    ]);
    const first = samples.findIndex((sample) => sample.events.length > 0);
    expect(
      groundSpeed(samples[first]?.state as HearseState),
    ).toBeGreaterThanOrEqual(0.6 * CONFIG.hearse.maxSpeed);
  });

  it("rebounds head-on at 1.5 m/s or more and drives forward again within 0.5 s", () => {
    const start = approach(Math.PI / 2);
    const samples = drive(start, throttle(0), 1.2, [wall]);
    const first = samples.findIndex((sample) => sample.events.length > 0);
    const after = samples[first + 1]?.state as HearseState;
    // The knock-back goes away from the wall (-z).
    expect(after.knock?.z).toBeLessThanOrEqual(-CONFIG.collision.minRebound);
    expect(hearseVelocity(after).z).toBeLessThan(
      -CONFIG.collision.minRebound + 0.3,
    );
    // Within 0.5 s the net velocity points to the wall again.
    const forward = samples
      .slice(first + 1, first + 31)
      .some((sample) => hearseVelocity(sample.state).z > 0);
    expect(forward).toBe(true);
  });

  it("never has speed 0 for more than one step while the throttle is held", () => {
    for (const angle of [Math.PI / 2, Math.PI / 3, Math.PI / 4, 0.2]) {
      const heading = Math.PI / 2 - angle;
      const samples = drive(approach(angle), throttle(heading), 4, [wall]);
      let run = 0;
      for (const sample of samples) {
        run = sample.state.speed === 0 ? run + 1 : 0;
        expect(run).toBeLessThanOrEqual(1);
      }
    }
  });

  it("moves at once when the hearse steers away from the wall", () => {
    const pressed = drive(approach(Math.PI / 2), throttle(0), 1, [wall]);
    const last = pressed[pressed.length - 1]?.state as HearseState;
    // Now steer away (toward -z). The hearse turns on the spot, so give it a heading away.
    const away = { ...last, heading: Math.PI, speed: 0, knock: undefined };
    const out = drive(away, throttle(Math.PI), 0.3, [wall]);
    const end = out[out.length - 1]?.state as HearseState;
    expect(end.z).toBeLessThan(away.z - 0.1);
    expect(end.speed).toBeGreaterThan(1);
  });

  it("gives one bump event for one contact", () => {
    const head = drive(approach(Math.PI / 2), throttle(0), 0.6, [wall]);
    expect(bumps(head)).toHaveLength(1);
    expect(bumps(head)[0]?.impact).toBeCloseTo(CONFIG.hearse.maxSpeed, 1);
    const heading = Math.PI / 2 - (30 * Math.PI) / 180;
    const scrape = drive(approach((30 * Math.PI) / 180), throttle(heading), 3, [
      wall,
    ]);
    expect(bumps(scrape)).toHaveLength(1);
  });

  it("gives no bump event for a soft touch", () => {
    const slow = { ...approach(Math.PI / 2), speed: 1 };
    const samples = drive(slow, NONE, 0.5, [wall]);
    expect(bumps(samples)).toHaveLength(0);
  });

  it("does not respond when the hearse already moves away", () => {
    const overlapping = {
      x: 0,
      z: 30 - R - 0.5 - CONFIG.collision.colliderOffset,
      heading: Math.PI,
      speed: 5,
    };
    const result = resolveHearse(
      overlapping,
      DT,
      [wall],
      box(-100, 100, -100, 100),
    );
    expect(result.events).toEqual([]);
    expect(result.hearse.speed).toBe(5);
    expect(result.hearse.z).toBeLessThan(overlapping.z + 1e-9 + 0.7);
  });

  it("unsticks a hearse that presses slowly on the wall", () => {
    const wallFace = 30 - R - CONFIG.collision.colliderOffset;
    const pressed = { x: 0, z: wallFace - 0.01, heading: 0, speed: 0 };
    const samples = drive(pressed, throttle(0), 1.5, [wall]);
    let back = false;
    let before = pressed.z;
    for (const sample of samples) {
      expect(sample.state.z).toBeLessThanOrEqual(wallFace + 1e-6);
      // The extra push out is 0.3 m along the normal.
      back ||= before - sample.state.z >= CONFIG.collision.unstick.push - 0.05;
      before = sample.state.z;
    }
    expect(back).toBe(true);
  });

  it("keeps the hearse inside the bounds", () => {
    const state = { x: 9.5, z: -9.9, heading: 0, speed: 3 };
    const result = resolveHearse(state, DT, [], box(-10, 10, -10, 10));
    expect(result.hearse.x).toBeLessThanOrEqual(10 - R + 1e-9);
    expect(result.hearse.z).toBeGreaterThanOrEqual(-10 + R - 1e-9);
    expect(result.events).toEqual([]);
  });

  it("resolves a tight corner between two boxes", () => {
    const corner = [box(-5, 5, 2, 3), box(2, 3, -5, 5)];
    const state = { x: 0, z: 0, heading: Math.PI / 4, speed: 6 };
    const result = resolveHearse(state, DT, corner, box(-10, 10, -10, 10));
    for (const body of hearseCircles(result.hearse)) {
      for (const obstacle of corner) {
        expect(circleVsBox({ ...body, r: body.r - 1e-6 }, obstacle)).toBeNull();
      }
    }
  });
});

describe("resolveHearse: trees", () => {
  it("bounces off a tree with the tree restitution", () => {
    const tree = circle(0, 20, 1);
    const start = {
      x: 0,
      z: 20 - 1 - R - CONFIG.collision.colliderOffset - 0.05,
      heading: 0,
      speed: 8,
    };
    const samples = drive(start, throttle(0), 0.1, [tree]);
    const first = samples.find((sample) => sample.events.length > 0);
    expect(first).toBeDefined();
    const v = hearseVelocity(first?.state as HearseState);
    expect(v.z).toBeCloseTo(-CONFIG.collision.restitution.tree * 8, 1);
  });
});

describe("resolveHearse: graves", () => {
  const grave = (
    x: number,
    z: number,
    id = 1,
    breakable = true,
  ): GraveBody => ({
    id,
    x,
    z,
    r: CONFIG.map.graves.radius,
    breakable,
  });

  it("breaks a grave at 10 m/s, keeps 75 % of the speed and drives on", () => {
    const start = { x: 0, z: 0, heading: 0, speed: 10 };
    const samples = drive(start, throttle(0), 0.1, [], [grave(0, 3.5)]);
    const broke = samples.findIndex((sample) =>
      sample.events.some((event) => event.type === "graveBroken"),
    );
    expect(broke).toBeGreaterThanOrEqual(0);
    const event = samples[broke]?.events.find((e) => e.type === "graveBroken");
    expect(event).toEqual({ type: "graveBroken", id: 1, x: 0, z: 3.5 });
    expect(samples[broke]?.state.speed).toBeCloseTo(7.5, 6);
    // No response: the hearse keeps its heading velocity and moves on.
    expect(samples[broke]?.state.knock).toBeUndefined();
    expect(bumps(samples)).toHaveLength(0);
    expect(samples[broke + 1]?.state.z).toBeGreaterThan(
      samples[broke]?.state.z ?? 0,
    );
  });

  it("does not break a grave at 2 m/s and slides around it", () => {
    const start = { x: 0.3, z: 0, heading: 0, speed: 2 };
    const samples = drive(start, { x: 0, y: -0.2 }, 4, [], [grave(0, 3.5)]);
    expect(
      samples.some((s) => s.events.some((e) => e.type === "graveBroken")),
    ).toBe(false);
    const end = samples[samples.length - 1]?.state as HearseState;
    // The hearse is never inside the grave circle.
    for (const sample of samples) {
      for (const body of hearseCircles(sample.state)) {
        expect(Math.hypot(body.x, body.z - 3.5)).toBeGreaterThanOrEqual(
          R + 0.6 - 0.05,
        );
      }
    }
    // No stop: the speed field is not 0 for more than a step.
    expect(end.z).toBeGreaterThan(0.5);
  });

  it("never breaks the target grave", () => {
    const start = { x: 0, z: 0, heading: 0, speed: 10 };
    const samples = drive(
      start,
      throttle(0),
      0.5,
      [],
      [grave(0, 3.5, 4, false)],
    );
    expect(
      samples.some((s) => s.events.some((e) => e.type === "graveBroken")),
    ).toBe(false);
  });
});

describe("no tunnelling at the greatest speed", () => {
  const thinWall = box(-55, 55, 30, 30 + CONFIG.map.wallThickness);
  const post = circle(0, 30, 0.3);
  const reach = R + CONFIG.collision.colliderOffset;

  it("does not pass a thin wall", () => {
    const track = drive({ x: 0, z: 0, heading: 0, speed: 0 }, throttle(0), 10, [
      thinWall,
    ]);
    const top = Math.max(...track.map((s) => s.state.z));
    expect(top).toBeLessThanOrEqual(30 - reach + 1e-6);
    expect(top).toBeGreaterThan(30 - reach - 0.5);
  });

  it("does not pass a small post", () => {
    const track = drive({ x: 0, z: 0, heading: 0, speed: 0 }, throttle(0), 10, [
      post,
    ]);
    for (const sample of track) {
      for (const body of hearseCircles(sample.state)) {
        expect(
          Math.hypot(body.x - post.x, body.z - post.z),
        ).toBeGreaterThanOrEqual(R + post.r - 0.05);
      }
    }
  });

  it("does not pass a wall at an angle", () => {
    const track = drive(
      { x: -10, z: 0, heading: 0.6, speed: 0 },
      throttle(0.6),
      15,
      [thinWall],
    );
    for (const sample of track) {
      for (const body of hearseCircles(sample.state)) {
        expect(body.z).toBeLessThanOrEqual(30 - R + 1e-6);
      }
    }
  });

  it("moves at the greatest speed before the hit", () => {
    const track = drive({ x: 0, z: 0, heading: 0, speed: 0 }, throttle(0), 2, [
      thinWall,
    ]);
    const step = (track[100]?.state.z ?? 0) - (track[99]?.state.z ?? 0);
    expect(step).toBeCloseTo(CONFIG.hearse.maxSpeed * DT, 3);
  });
});
