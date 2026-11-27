import { CONFIG } from "../config";
import { resolveHearse } from "./collision";
import { initialHearse, stepHearse, type HearseState } from "./hearse";
import type { Vec2 } from "./input";
import type { CemeteryMap } from "./map";
import {
  spawnZombie,
  stepZombies,
  type Zombie,
  type ZombieArrivedEvent,
} from "./zombies";

export type WorldEvent = ZombieArrivedEvent;

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
    events: [],
  };
}

/** One logic step: hearse, collision, zombies, spawn. It returns the next world. */
export function stepWorld(
  world: World,
  input: Vec2,
  dt: number,
  rng: () => number,
): World {
  const hearse = resolveHearse(
    stepHearse(world.hearse, input, dt, CONFIG.hearse),
    CONFIG.hearse.radius,
    world.map.obstacles,
    world.map.bounds,
  );
  const moved = stepZombies({ ...world, hearse }, dt);
  let zombies = moved.zombies;
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
    events: moved.events,
  };
}
