import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { pushOut } from "./collision";
import { buildMap } from "./map";
import { createRandom } from "./random";
import {
  chapelDoor,
  spawnZombie,
  stepZombies,
  type Zombie,
  type ZombieWorld,
} from "./zombies";

const map = buildMap(CONFIG.map);

function worldWith(
  zombies: Zombie[] = [],
  hearse = { x: 0, z: map.hearseStart.z },
): ZombieWorld {
  return { map, hearse, zombies, nextId: zombies.length + 1 };
}

function walker(x: number, z: number, id = 1): Zombie {
  return {
    id,
    x,
    z,
    heading: 0,
    speed: CONFIG.spawn.baseSpeed,
    state: "walking",
    side: 0,
  };
}

const distanceToDoor = (zombie: Zombie): number => {
  const door = chapelDoor(map);
  return Math.hypot(zombie.x - door.x, zombie.z - door.z);
};

describe("chapelDoor", () => {
  it("is on the south side of the chapel", () => {
    const door = chapelDoor(map);
    expect(door.x).toBe(map.chapel.x);
    expect(door.z).toBe(map.chapel.z + map.chapel.depth / 2);
  });
});

describe("spawnZombie", () => {
  it("puts a walking zombie on a spawn point with the base speed", () => {
    const zombie = spawnZombie(worldWith(), createRandom(1));
    expect(zombie).not.toBeNull();
    expect(zombie?.state).toBe("walking");
    expect(zombie?.speed).toBe(CONFIG.spawn.baseSpeed);
    expect(zombie?.id).toBe(1);
    expect(
      map.spawnPoints.some((p) => p.x === zombie?.x && p.z === zombie.z),
    ).toBe(true);
  });

  it("gives the same zombie for the same seed", () => {
    expect(spawnZombie(worldWith(), createRandom(4))).toEqual(
      spawnZombie(worldWith(), createRandom(4)),
    );
  });

  it("never spawns within the minimum distance of the hearse", () => {
    const random = createRandom(9);
    for (const point of map.spawnPoints) {
      const world = worldWith([], { x: point.x + 1, z: point.z - 1 });
      for (let i = 0; i < 40; i += 1) {
        const zombie = spawnZombie(world, random);
        if (zombie !== null) {
          expect(
            Math.hypot(zombie.x - world.hearse.x, zombie.z - world.hearse.z),
          ).toBeGreaterThanOrEqual(CONFIG.spawnMinDistance);
        }
      }
    }
  });

  it("does not spawn when no point is free", () => {
    // Put the hearse in the middle of all spawn points: use a huge keep-out by moving each point close.
    const near = {
      ...map,
      spawnPoints: map.spawnPoints.map((p) => ({ x: p.x, z: p.z })),
    };
    const first = near.spawnPoints[0];
    expect(first).toBeDefined();
    const world: ZombieWorld = {
      map: { ...near, spawnPoints: first ? [first] : [] },
      hearse: { x: (first?.x ?? 0) + 2, z: first?.z ?? 0 },
      zombies: [],
      nextId: 1,
    };
    expect(spawnZombie(world, createRandom(1))).toBeNull();
  });

  it("does not spawn above the maximum number of walking zombies", () => {
    const crowd = Array.from({ length: CONFIG.spawn.maxAlive }, (_, i) =>
      walker(0, 0, i + 1),
    );
    expect(spawnZombie(worldWith(crowd), createRandom(1))).toBeNull();
  });

  it("does not count popped or arrived zombies as alive", () => {
    const crowd: Zombie[] = Array.from(
      { length: CONFIG.spawn.maxAlive },
      (_, i) => ({ ...walker(0, 0, i + 1), state: "popped" as const }),
    );
    expect(spawnZombie(worldWith(crowd), createRandom(1))).not.toBeNull();
  });
});

describe("stepZombies", () => {
  it("walks a zombie toward the chapel door at its speed", () => {
    const start = walker(0, -10);
    const { zombies, events } = stepZombies(worldWith([start]), 0.1);
    const moved = zombies[0];
    expect(events).toEqual([]);
    expect(moved?.x).toBeCloseTo(0, 6);
    expect(moved?.z).toBeCloseTo(-10 - CONFIG.spawn.baseSpeed * 0.1, 6);
    // Heading 0 points to +z, heading PI to -z (same rule as the hearse).
    expect(Math.abs(moved?.heading ?? 0)).toBeCloseTo(Math.PI, 6);
  });

  it("limits a long step", () => {
    const { zombies } = stepZombies(worldWith([walker(0, -10)]), 100);
    const moved = zombies[0];
    expect(-10 - (moved?.z ?? 0)).toBeCloseTo(
      CONFIG.spawn.baseSpeed * CONFIG.zombie.maxStepSeconds,
      6,
    );
  });

  it("ignores a negative step", () => {
    const { zombies } = stepZombies(worldWith([walker(0, -10)]), -1);
    expect(zombies[0]?.z).toBe(-10);
  });

  it("marks a zombie within 1.5 m of the door as arrived and sends one event", () => {
    const door = chapelDoor(map);
    const arriving = walker(
      door.x,
      door.z + CONFIG.zombie.arriveDistance - 0.01,
      7,
    );
    const first = stepZombies(worldWith([arriving]), 0.1);
    expect(first.zombies[0]?.state).toBe("arrived");
    expect(first.events).toEqual([{ type: "zombieArrived", id: 7 }]);
    // The next step removes the arrived zombie and sends no second event.
    const second = stepZombies(worldWith(first.zombies), 0.1);
    expect(second.zombies).toEqual([]);
    expect(second.events).toEqual([]);
  });

  it("does not move popped zombies and removes them on the next step", () => {
    const popped: Zombie = { ...walker(0, -10), state: "popped" };
    expect(stepZombies(worldWith([popped]), 1).zombies).toEqual([]);
  });

  it("steps around a grave that is in the way", () => {
    const grave = map.obstacles.find((o) => o.kind === "circle");
    expect(grave?.kind).toBe("circle");
    if (grave?.kind !== "circle") {
      return;
    }
    // Stand just south of the grave. The direct way to the door goes through the grave.
    const door = chapelDoor(map);
    const away = Math.hypot(door.x - grave.x, door.z - grave.z);
    const dx = (door.x - grave.x) / away;
    const dz = (door.z - grave.z) / away;
    const zombie = walker(
      grave.x - dx * (grave.r + CONFIG.zombie.radius + 0.05),
      grave.z - dz * (grave.r + CONFIG.zombie.radius + 0.05),
    );
    const { zombies } = stepZombies(worldWith([zombie]), 0.1);
    const moved = zombies[0];
    expect(moved).toBeDefined();
    expect(moved?.x !== zombie.x || moved.z !== zombie.z).toBe(true);
    for (const obstacle of map.obstacles) {
      expect(
        pushOut(
          { x: moved?.x ?? 0, z: moved?.z ?? 0, r: CONFIG.zombie.radius },
          obstacle,
        ),
      ).toBeNull();
    }
  });

  it("stays in place when every side step is blocked", () => {
    const blocked = {
      ...map,
      obstacles: [
        { kind: "box" as const, minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
      ],
    };
    const world: ZombieWorld = {
      map: blocked,
      hearse: { x: 0, z: 0 },
      zombies: [walker(0, 0)],
      nextId: 2,
    };
    const { zombies } = stepZombies(world, 0.1);
    expect(zombies[0]?.x).toBe(0);
    expect(zombies[0]?.z).toBe(0);
  });

  it("brings a zombie from every spawn point to the chapel", () => {
    const worst: number[] = [];
    for (const [index, point] of map.spawnPoints.entries()) {
      let zombies: Zombie[] = [walker(point.x, point.z, index + 1)];
      let arrived = false;
      let steps = 0;
      while (!arrived && steps < 60 * 150) {
        const result = stepZombies(worldWith(zombies), 1 / 60);
        zombies = result.zombies;
        arrived = result.events.length > 0;
        steps += 1;
        const zombie = zombies[0];
        if (zombie !== undefined && steps % 20 === 0) {
          expect(
            map.obstacles.every(
              (shape) =>
                pushOut(
                  { x: zombie.x, z: zombie.z, r: CONFIG.zombie.radius },
                  shape,
                ) === null,
            ),
          ).toBe(true);
        }
      }
      expect(arrived, `spawn point ${String(index)}`).toBe(true);
      expect(zombies[0] ? distanceToDoor(zombies[0]) : 0).toBeLessThanOrEqual(
        CONFIG.zombie.arriveDistance,
      );
      worst.push(steps / 60);
    }
    // The longest way is below 80 s at 0.9 m/s.
    expect(Math.max(...worst)).toBeLessThan(80);
  }, 30_000);
});
