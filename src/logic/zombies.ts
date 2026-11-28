import { CONFIG } from "../config";
import { pushOut, type Vec } from "./collision";
import type { Grave } from "./graves";
import type { CemeteryMap } from "./map";

/**
 * Zombies. Each one walks from a spawn point between the graves to the chapel door.
 * Heading is the angle around the y axis, like the hearse: it points toward (sin, cos).
 */

export type ZombieState = "walking" | "popped" | "arrived";

export interface Zombie {
  id: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  state: ZombieState;
  /** The side (1 or -1) of the last step around an obstacle, or 0 when the way was free. */
  side: number;
}

export interface ZombieArrivedEvent {
  type: "zombieArrived";
  id: number;
}

/** The part of the world that the zombie code reads. */
export interface ZombieWorld {
  map: CemeteryMap;
  hearse: Vec;
  zombies: readonly Zombie[];
  /** The id of the next zombie. */
  nextId: number;
  /** The graves. Zombies keep away from the standing ones. Missing means all stand. */
  graves?: readonly Grave[] | undefined;
}

/** Side steps to try when the straight way is blocked, in turn order. */
const SIDE_STEPS = [Math.PI / 4, Math.PI / 2];

/** The point in front of the chapel door that the zombies walk to. */
export function chapelDoor(map: CemeteryMap): Vec {
  return { x: map.chapel.x, z: map.chapel.z + map.chapel.depth / 2 };
}

/**
 * A new zombie on a spawn point that is far enough from the hearse, or null when there is
 * no such point or too many zombies walk already.
 */
export function spawnZombie(
  world: ZombieWorld,
  rng: () => number,
): Zombie | null {
  const alive = world.zombies.filter((zombie) => zombie.state === "walking");
  if (alive.length >= CONFIG.spawn.maxAlive) {
    return null;
  }
  const free = world.map.spawnPoints.filter(
    (point) =>
      Math.hypot(point.x - world.hearse.x, point.z - world.hearse.z) >=
      CONFIG.spawnMinDistance,
  );
  const point = free[Math.floor(rng() * free.length)];
  if (point === undefined) {
    return null;
  }
  const door = chapelDoor(world.map);
  return {
    id: world.nextId,
    x: point.x,
    z: point.z,
    heading: Math.atan2(door.x - point.x, door.z - point.z),
    speed: CONFIG.spawn.baseSpeed,
    state: "walking",
    side: 0,
  };
}

/** True when a zombie at (x, z) would touch an obstacle or a standing grave. */
export function blocked(
  map: CemeteryMap,
  x: number,
  z: number,
  graves?: readonly Grave[],
): boolean {
  const body = { x, z, r: CONFIG.zombie.radius };
  if (map.obstacles.some((shape) => pushOut(body, shape) !== null)) {
    return true;
  }
  const standing = (
    graves ??
    map.graves.map((grave) => ({ ...grave, state: "standing" as const }))
  ).filter((grave) => grave.state === "standing");
  const r = CONFIG.map.graves.radius;
  return standing.some(
    (grave) =>
      pushOut(body, { kind: "circle", x: grave.x, z: grave.z, r }) !== null,
  );
}

function stepZombie(
  zombie: Zombie,
  map: CemeteryMap,
  graves: readonly Grave[] | undefined,
  dt: number,
): Zombie {
  const door = chapelDoor(map);
  const wanted = Math.atan2(door.x - zombie.x, door.z - zombie.z);
  const length = zombie.speed * dt;
  // A zombie keeps its side while an obstacle is in the way, so it does not swing left and right.
  // At first, odd ids try the left side and even ids the right side, so a crowd spreads out.
  const side = zombie.side !== 0 ? zombie.side : zombie.id % 2 === 0 ? -1 : 1;
  const tries = [{ turn: 0, side: 0 }].concat(
    SIDE_STEPS.map((turn) => ({ turn: turn * side, side })),
    SIDE_STEPS.map((turn) => ({ turn: -turn * side, side: -side })),
  );
  for (const attempt of tries) {
    const heading = wanted + attempt.turn;
    const x = zombie.x + Math.sin(heading) * length;
    const z = zombie.z + Math.cos(heading) * length;
    if (!blocked(map, x, z, graves)) {
      const near =
        Math.hypot(door.x - x, door.z - z) <= CONFIG.zombie.arriveDistance;
      return {
        ...zombie,
        x,
        z,
        heading,
        side: attempt.side,
        state: near ? "arrived" : "walking",
      };
    }
  }
  return zombie;
}

/**
 * One step of all zombies. Zombies that are not walking leave the list at the start of the
 * step, so a popped or arrived zombie is in the result for one step only.
 */
export function stepZombies(
  world: ZombieWorld,
  dtSeconds: number,
): { zombies: Zombie[]; events: ZombieArrivedEvent[] } {
  const dt = Math.min(Math.max(dtSeconds, 0), CONFIG.zombie.maxStepSeconds);
  const events: ZombieArrivedEvent[] = [];
  const zombies = world.zombies
    .filter((zombie) => zombie.state === "walking")
    .map((zombie) => {
      const moved = stepZombie(zombie, world.map, world.graves, dt);
      if (moved.state === "arrived") {
        events.push({ type: "zombieArrived", id: moved.id });
      }
      return moved;
    });
  return { zombies, events };
}
