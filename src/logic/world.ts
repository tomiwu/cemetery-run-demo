import { CONFIG } from "../config";
import {
  resolveHearse,
  type BumpEvent,
  type GraveBrokenEvent,
} from "./collision";
import {
  breakGraves,
  createGraves,
  standingBodies,
  type Grave,
} from "./graves";
import { initialHearse, stepHearse, type HearseState } from "./hearse";
import type { Vec2 } from "./input";
import type { CemeteryMap } from "./map";
import { resolveHits, type ZombieHitEvent } from "./hits";
import {
  blocked,
  spawnZombie,
  stepZombies,
  type Zombie,
  type ZombieArrivedEvent,
} from "./zombies";

export type WorldEvent =
  ZombieArrivedEvent | ZombieHitEvent | BumpEvent | GraveBrokenEvent;

/** The hearse settings of the logic step: the motion numbers and the knock-back decay. */
const HEARSE = { ...CONFIG.hearse, knockDecay: CONFIG.collision.knockDecay };

/** The whole state of a round. `main.ts` changes it only with `stepWorld`. */
export interface World {
  map: CemeteryMap;
  hearse: HearseState;
  /** The graves: standing or broken. They are not in `map.obstacles`. */
  graves: readonly Grave[];
  /** The id of the dug target grave of a delivery. It never breaks. Null when there is none. */
  targetGrave: number | null;
  zombies: Zombie[];
  /** Seconds of play. */
  time: number;
  /** Seconds until the next spawn. */
  spawnTimer: number;
  nextId: number;
  /** Zombies popped so far: 1 point for each (PRD section 3). */
  score: number;
  /** The events of the last step only. */
  events: WorldEvent[];
}

export function createWorld(map: CemeteryMap): World {
  return {
    map,
    hearse: initialHearse(
      map.hearseStart.x,
      map.hearseStart.z,
      map.hearseStart.heading,
    ),
    graves: createGraves(map),
    targetGrave: null,
    zombies: [],
    time: 0,
    spawnTimer: CONFIG.spawn.baseInterval,
    nextId: 1,
    score: 0,
    events: [],
  };
}

/** One logic step: hearse, collision, zombies, hits, spawn. It returns the next world. */
export function stepWorld(
  world: World,
  input: Vec2,
  dt: number,
  rng: () => number,
): World {
  const resolved = resolveHearse(
    stepHearse(world.hearse, input, dt, HEARSE),
    dt,
    world.map.obstacles,
    world.map.bounds,
    standingBodies(world.graves, world.targetGrave),
  );
  const driven = resolved.hearse;
  const graves = breakGraves(
    world.graves,
    resolved.events.flatMap((event) =>
      event.type === "graveBroken" ? [event.id] : [],
    ),
  );
  const moved = stepZombies({ ...world, graves, hearse: driven }, dt);
  const hits = resolveHits(driven, moved.zombies, (x, z) =>
    blocked(world.map, x, z, graves),
  );
  const hearse = hits.hearse;
  let zombies = hits.zombies;
  let nextId = world.nextId;
  let spawnTimer = world.spawnTimer - dt;
  if (spawnTimer <= 0) {
    const spawned = spawnZombie({ ...world, hearse, zombies }, rng);
    if (spawned !== null) {
      zombies = [...zombies, spawned];
      nextId += 1;
      spawnTimer += CONFIG.spawn.baseInterval;
    } else {
      // Try again at the next step. Do not save up spawns.
      spawnTimer = 0;
    }
  }
  return {
    map: world.map,
    hearse,
    graves,
    targetGrave: world.targetGrave,
    zombies,
    time: world.time + dt,
    spawnTimer,
    nextId,
    score: world.score + hits.scoreAdded,
    events: [...resolved.events, ...moved.events, ...hits.events],
  };
}
