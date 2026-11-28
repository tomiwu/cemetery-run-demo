import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { resolveHits } from "./hits";
import type { Zombie } from "./zombies";

function zombie(x: number, z: number, id = 1): Zombie {
  return {
    id,
    x,
    z,
    heading: 0,
    speed: 0.9,
    state: "walking",
    side: 0,
  };
}

const hearse = (speed: number) => ({ x: 0, z: 0, heading: 0, speed });
const REACH = CONFIG.hearse.radius + CONFIG.hit.zombieRadius;
const none = () => false;

describe("resolveHits", () => {
  it("pops a zombie that touches the hearse at hit speed", () => {
    const result = resolveHits(
      hearse(CONFIG.hit.minSpeed),
      [zombie(0, -REACH + 0.1)],
      none,
    );
    expect(result.zombies[0]?.state).toBe("popped");
    expect(result.scoreAdded).toBe(CONFIG.hit.score);
    expect(result.events).toEqual([
      { type: "zombieHit", id: 1, x: 0, z: -REACH + 0.1 },
    ]);
  });

  it("keeps 95 % of the speed for a hit", () => {
    const result = resolveHits(hearse(8), [zombie(0, -1)], none);
    expect(result.hearse.speed).toBeCloseTo(8 * CONFIG.hit.speedFactor, 9);
  });

  it("takes the speed factor for each zombie", () => {
    const result = resolveHits(
      hearse(8),
      [zombie(0, -1, 1), zombie(0.5, -1, 2)],
      none,
    );
    expect(result.scoreAdded).toBe(2);
    expect(result.hearse.speed).toBeCloseTo(8 * CONFIG.hit.speedFactor ** 2, 9);
  });

  it("does not hit a zombie that is outside the circles", () => {
    const far = zombie(0, -REACH - 0.01);
    const result = resolveHits(hearse(8), [far], none);
    expect(result.zombies).toEqual([far]);
    expect(result.events).toEqual([]);
    expect(result.scoreAdded).toBe(0);
    expect(result.hearse.speed).toBe(8);
  });

  it("pushes a zombie aside, with no hit, below the hit speed", () => {
    const touched = zombie(0, -1);
    const result = resolveHits(
      hearse(CONFIG.hit.minSpeed - 0.01),
      [touched],
      none,
    );
    const moved = result.zombies[0];
    expect(moved?.state).toBe("walking");
    expect(Math.hypot(moved?.x ?? 0, moved?.z ?? 0)).toBeGreaterThanOrEqual(
      REACH - 1e-9,
    );
    expect(result.events).toEqual([]);
    expect(result.scoreAdded).toBe(0);
    expect(result.hearse.speed).toBe(CONFIG.hit.minSpeed - 0.01);
  });

  it("does not push a zombie into a blocked place", () => {
    const touched = zombie(0, -1);
    const result = resolveHits(hearse(1), [touched], () => true);
    expect(result.zombies[0]).toEqual(touched);
  });

  it("leaves zombies that are not walking alone", () => {
    const popped = { ...zombie(0, -1), state: "popped" as const };
    const result = resolveHits(hearse(8), [popped], none);
    expect(result.zombies).toEqual([popped]);
    expect(result.events).toEqual([]);
  });

  it("keeps the same hearse object when nothing is hit", () => {
    const state = hearse(8);
    expect(resolveHits(state, [], none).hearse).toBe(state);
  });
});
