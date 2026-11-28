import { CONFIG } from "../config";
import { resolveHearse } from "./collision";
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

export type WorldEvent = ZombieArrivedEvent | ZombieHitEvent;

/** The whole state of a round. `main.ts` changes it only with `stepWorld`. */
export interface World {
  map: CemeteryMap;
  hearse: HearseState;
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
  const driven = resolveHearse(
    stepHearse(world.hearse, input, dt, CONFIG.hearse),
    CONFIG.hearse.radius,
    world.map.obstacles,
    world.map.bounds,
  );
  const moved = stepZombies({ ...world, hearse: driven }, dt);
  const hits = resolveHits(driven, moved.zombies, (x, z) =>
    blocked(world.map, x, z),
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
    zombies,
    time: world.time + dt,
    spawnTimer,
    nextId,
    score: world.score + hits.scoreAdded,
    events: [...moved.events, ...hits.events],
  };
}
