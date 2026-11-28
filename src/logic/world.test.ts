import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { buildMap } from "./map";
import { createRandom } from "./random";
import { createWorld, stepWorld, type World } from "./world";

const map = buildMap(CONFIG.map);
const NO_INPUT = { x: 0, y: 0 };
const STEP = CONFIG.logicStepSeconds;

function run(
  world: World,
  seconds: number,
  rng: () => number,
  input = NO_INPUT,
): World {
  let current = world;
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
    current = stepWorld(current, input, STEP, rng);
  }
  return current;
}

describe("createWorld", () => {
  it("starts with the hearse at the start point and no zombies", () => {
    const world = createWorld(map);
    expect(world.hearse).toEqual({
      x: map.hearseStart.x,
      z: map.hearseStart.z,
      heading: map.hearseStart.heading,
      speed: 0,
    });
    expect(world.zombies).toEqual([]);
    expect(world.time).toBe(0);
    expect(world.events).toEqual([]);
  });
});

describe("stepWorld", () => {
  it("counts the time", () => {
    const world = run(createWorld(map), 1, createRandom(1));
    expect(world.time).toBeCloseTo(1, 6);
  });

  it("moves the hearse with the input", () => {
    const before = createWorld(map);
    const after = run(before, 1, createRandom(1), { x: 0, y: 1 });
    expect(after.hearse.z).toBeLessThan(before.hearse.z);
  });

  it("stops the hearse at the wall", () => {
    const world = run(createWorld(map), 12, createRandom(1), { x: 1, y: 0 });
    expect(world.hearse.x).toBeLessThanOrEqual(
      CONFIG.map.width / 2 - CONFIG.hearse.radius + 1e-9,
    );
  });

  it("spawns the first zombie after the spawn interval", () => {
    const rng = createRandom(CONFIG.spawn.seed);
    const early = run(createWorld(map), CONFIG.spawn.baseInterval - 0.5, rng);
    expect(early.zombies).toHaveLength(0);
    const later = run(early, 1, rng);
    expect(later.zombies).toHaveLength(1);
  });

  it("spawns one zombie each interval", () => {
    const world = run(
      createWorld(map),
      CONFIG.spawn.baseInterval * 4 + 0.2,
      createRandom(2),
    );
    expect(world.zombies.length).toBe(4);
    expect(new Set(world.zombies.map((z) => z.id)).size).toBe(4);
  });

  it("never has more walking zombies than the maximum", () => {
    let world = createWorld(map);
    const rng = createRandom(3);
    for (let i = 0; i < 60 * 200; i += 1) {
      world = stepWorld(world, NO_INPUT, STEP, rng);
      expect(
        world.zombies.filter((z) => z.state === "walking").length,
      ).toBeLessThanOrEqual(CONFIG.spawn.maxAlive);
    }
  });

  it("reports an arrived zombie in the events of that step only", () => {
    let world = createWorld(map);
    const rng = createRandom(5);
    let seen = 0;
    for (let i = 0; i < 60 * 120; i += 1) {
      world = stepWorld(world, NO_INPUT, STEP, rng);
      for (const event of world.events) {
        expect(event.type).toBe("zombieArrived");
        seen += 1;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("does not save up spawns when no spawn point is free", () => {
    const empty = { ...map, spawnPoints: [] };
    const rng = createRandom(4);
    const waited = run(createWorld(empty), CONFIG.spawn.baseInterval * 3, rng);
    expect(waited.zombies).toHaveLength(0);
    expect(waited.spawnTimer).toBe(0);
    const open = stepWorld({ ...waited, map }, NO_INPUT, STEP, rng);
    expect(open.zombies).toHaveLength(1);
    expect(open.spawnTimer).toBeGreaterThan(CONFIG.spawn.baseInterval - 0.1);
  });

  it("gives the same world for the same seed", () => {
    const a = run(createWorld(map), 20, createRandom(8), { x: 0.3, y: 0.5 });
    const b = run(createWorld(map), 20, createRandom(8), { x: 0.3, y: 0.5 });
    expect(a).toEqual(b);
  });

  it("does not spawn a zombie within the minimum distance of the hearse", () => {
    let world = createWorld(map);
    const rng = createRandom(6);
    const known = new Set<number>();
    for (let i = 0; i < 60 * 60; i += 1) {
      world = stepWorld(world, { x: 0, y: 0.6 }, STEP, rng);
      for (const zombie of world.zombies) {
        if (!known.has(zombie.id)) {
          known.add(zombie.id);
          expect(
            Math.hypot(zombie.x - world.hearse.x, zombie.z - world.hearse.z),
          ).toBeGreaterThanOrEqual(CONFIG.spawnMinDistance - 0.2);
        }
      }
    }
    expect(known.size).toBeGreaterThan(5);
  });
});

/** A walking zombie `metres` in front of the hearse. */
function zombieAhead(world: World, metres: number): World {
  const { x, z, heading } = world.hearse;
  const zombie = {
    id: world.nextId,
    x: x + Math.sin(heading) * metres,
    z: z + Math.cos(heading) * metres,
    heading: 0,
    speed: 0,
    state: "walking" as const,
    side: 0,
  };
  return { ...world, zombies: [zombie], nextId: world.nextId + 1 };
}

describe("hits in stepWorld", () => {
  it("pops a zombie and adds 1 to the score when the hearse drives into it", () => {
    let world = zombieAhead(createWorld(map), 4);
    const rng = createRandom(1);
    const hits: unknown[] = [];
    for (let i = 0; i < 60; i += 1) {
      world = stepWorld(world, { x: 0, y: 1 }, STEP, rng);
      hits.push(...world.events.filter((event) => event.type === "zombieHit"));
    }
    expect(hits).toHaveLength(1);
    expect(world.score).toBe(1);
    expect(world.zombies.some((zombie) => zombie.id === 1)).toBe(false);
  });

  it("keeps the popped zombie in the list for one step, then removes it", () => {
    let world = zombieAhead(createWorld(map), 4);
    const rng = createRandom(1);
    let popStep: World | null = null;
    for (let i = 0; i < 60 && popStep === null; i += 1) {
      world = stepWorld(world, { x: 0, y: 1 }, STEP, rng);
      if (world.events.some((event) => event.type === "zombieHit")) {
        popStep = world;
      }
    }
    expect(popStep?.zombies.find((z) => z.id === 1)?.state).toBe("popped");
    const after = stepWorld(popStep ?? world, { x: 0, y: 1 }, STEP, rng);
    expect(after.zombies.some((zombie) => zombie.id === 1)).toBe(false);
    expect(after.events.some((event) => event.type === "zombieHit")).toBe(
      false,
    );
    expect(after.score).toBe(1);
  });

  it("does not stop the hearse: it keeps 95 % of its speed for a hit", () => {
    let world = createWorld(map);
    world = { ...world, hearse: { ...world.hearse, speed: 8 } };
    world = zombieAhead(world, CONFIG.hearse.radius + 0.2);
    const stepped = stepWorld(world, { x: 0, y: 1 }, STEP, createRandom(1));
    const free = stepWorld(
      { ...world, zombies: [] },
      { x: 0, y: 1 },
      STEP,
      createRandom(1),
    );
    expect(stepped.score).toBe(1);
    expect(stepped.hearse.speed).toBeCloseTo(
      free.hearse.speed * CONFIG.hit.speedFactor,
      9,
    );
  });

  it("pushes a zombie aside, with no score, when the hearse is slow", () => {
    let world = zombieAhead(createWorld(map), CONFIG.hearse.radius + 0.2);
    world = { ...world, hearse: { ...world.hearse, speed: 1 } };
    const stepped = stepWorld(world, NO_INPUT, STEP, createRandom(1));
    expect(stepped.score).toBe(0);
    expect(stepped.events.filter((e) => e.type === "zombieHit")).toEqual([]);
    const zombie = stepped.zombies[0];
    expect(zombie?.state).toBe("walking");
    expect(
      Math.hypot(
        (zombie?.x ?? 0) - stepped.hearse.x,
        (zombie?.z ?? 0) - stepped.hearse.z,
      ),
    ).toBeGreaterThanOrEqual(
      CONFIG.hearse.radius + CONFIG.hit.zombieRadius - 1e-6,
    );
  });
});
