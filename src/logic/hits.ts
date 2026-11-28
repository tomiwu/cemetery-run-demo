import { CONFIG } from "../config";
import { circleVsCircle } from "./collision";
import type { HearseState } from "./hearse";
import type { Zombie } from "./zombies";

/** The hearse hit a zombie. The zombie is `popped` in the list of this step only. */
export interface ZombieHitEvent {
  type: "zombieHit";
  id: number;
  x: number;
  z: number;
}

export interface HitResult {
  hearse: HearseState;
  zombies: Zombie[];
  events: ZombieHitEvent[];
  scoreAdded: number;
}

/**
 * The hearse against the zombies (PRD section 3, D21/D22). A walking zombie whose circle touches
 * the hearse circle pops when the hearse speed is at least `CONFIG.hit.minSpeed`: the hearse keeps
 * `CONFIG.hit.speedFactor` of its speed for each hit. Slower, the zombie is pushed aside, unless
 * `isBlocked` says that the new place is not free.
 */
export function resolveHits(
  hearse: HearseState,
  zombies: readonly Zombie[],
  isBlocked: (x: number, z: number) => boolean,
): HitResult {
  const events: ZombieHitEvent[] = [];
  const fast = hearse.speed >= CONFIG.hit.minSpeed;
  const body = { x: hearse.x, z: hearse.z, r: CONFIG.hearse.radius };
  let speed = hearse.speed;
  const result = zombies.map((zombie): Zombie => {
    if (zombie.state !== "walking") {
      return zombie;
    }
    const push = circleVsCircle(
      { x: zombie.x, z: zombie.z, r: CONFIG.hit.zombieRadius },
      body,
    );
    if (push === null) {
      return zombie;
    }
    if (fast) {
      events.push({
        type: "zombieHit",
        id: zombie.id,
        x: zombie.x,
        z: zombie.z,
      });
      speed *= CONFIG.hit.speedFactor;
      return { ...zombie, state: "popped" };
    }
    const x = zombie.x + push.x;
    const z = zombie.z + push.z;
    return isBlocked(x, z) ? zombie : { ...zombie, x, z };
  });
  return {
    hearse: events.length > 0 ? { ...hearse, speed } : hearse,
    zombies: result,
    events,
    scoreAdded: events.length * CONFIG.hit.score,
  };
}
