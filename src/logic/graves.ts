import { CONFIG } from "../config";
import type { GraveBody } from "./collision";
import type { CemeteryMap } from "./map";

/** A grave in a round. A broken grave has no collision and stays as low rubble. */
export interface Grave {
  id: number;
  x: number;
  z: number;
  state: "standing" | "broken";
}

/** All graves of the map, standing. */
export function createGraves(map: CemeteryMap): Grave[] {
  return map.graves.map((grave) => ({
    id: grave.id,
    x: grave.x,
    z: grave.z,
    state: "standing",
  }));
}

/**
 * The standing graves as collision bodies. The `unbreakable` grave (the dug target grave of a
 * delivery) never breaks.
 */
export function standingBodies(
  graves: readonly Grave[],
  unbreakable: number | null,
): GraveBody[] {
  return graves
    .filter((grave) => grave.state === "standing")
    .map((grave) => ({
      id: grave.id,
      x: grave.x,
      z: grave.z,
      r: CONFIG.map.graves.radius,
      breakable: grave.id !== unbreakable,
    }));
}

/** The graves after the broken ones are marked. The same list comes back when none broke. */
export function breakGraves(
  graves: readonly Grave[],
  ids: readonly number[],
): readonly Grave[] {
  if (ids.length === 0) {
    return graves;
  }
  return graves.map((grave) =>
    ids.includes(grave.id) ? { ...grave, state: "broken" } : grave,
  );
}
