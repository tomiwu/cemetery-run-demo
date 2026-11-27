import type { HearseState } from "./hearse";

/** A point or a push vector on the ground plane. */
export interface Vec {
  x: number;
  z: number;
}

export interface Circle {
  kind: "circle";
  x: number;
  z: number;
  r: number;
}

/** A box that is aligned with the axes. */
export interface Box {
  kind: "box";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type Shape = Circle | Box;

/** A moving circle. */
type Mover = Pick<Circle, "x" | "z" | "r">;

/**
 * The vector that moves circle `a` out of circle `b` (just touching), or null when
 * they do not overlap.
 */
export function circleVsCircle(a: Mover, b: Mover): Vec | null {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const reach = a.r + b.r;
  const distance = Math.hypot(dx, dz);
  if (distance >= reach) {
    return null;
  }
  if (distance === 0) {
    return { x: reach, z: 0 };
  }
  const scale = (reach - distance) / distance;
  return { x: dx * scale, z: dz * scale };
}

/** The vector that moves a circle out of a box (just touching), or null. */
export function circleVsBox(circle: Mover, box: Box): Vec | null {
  const nearX = Math.min(Math.max(circle.x, box.minX), box.maxX);
  const nearZ = Math.min(Math.max(circle.z, box.minZ), box.maxZ);
  const dx = circle.x - nearX;
  const dz = circle.z - nearZ;
  const distance = Math.hypot(dx, dz);
  if (distance >= circle.r) {
    return null;
  }
  if (distance > 0) {
    const scale = (circle.r - distance) / distance;
    return { x: dx * scale, z: dz * scale };
  }
  // The centre is inside the box: leave through the nearest face.
  const exits: Vec[] = [
    { x: box.minX - circle.x - circle.r, z: 0 },
    { x: box.maxX - circle.x + circle.r, z: 0 },
    { x: 0, z: box.minZ - circle.z - circle.r },
    { x: 0, z: box.maxZ - circle.z + circle.r },
  ];
  let best: Vec = exits[0] ?? { x: 0, z: 0 };
  for (const exit of exits) {
    if (Math.hypot(exit.x, exit.z) < Math.hypot(best.x, best.z)) {
      best = exit;
    }
  }
  return best;
}

/** Push-out vector for any shape. */
export function pushOut(circle: Mover, shape: Shape): Vec | null {
  return shape.kind === "circle"
    ? circleVsCircle(circle, shape)
    : circleVsBox(circle, shape);
}

const PASSES = 4;

/**
 * Move the hearse out of the obstacles and keep it inside `bounds` (the walls).
 * A hit sets the speed to 0. The same state object comes back when nothing was hit.
 */
export function resolveHearse(
  state: HearseState,
  radius: number,
  obstacles: readonly Shape[],
  bounds: Box,
): HearseState {
  let x = state.x;
  let z = state.z;
  let hit = false;
  // A few passes: a push out of one obstacle can move the hearse into the next one.
  for (let pass = 0; pass < PASSES; pass += 1) {
    let moved = false;
    for (const obstacle of obstacles) {
      const push = pushOut({ x, z, r: radius }, obstacle);
      if (push !== null) {
        x += push.x;
        z += push.z;
        moved = true;
      }
    }
    hit ||= moved;
    if (!moved) {
      break;
    }
  }
  const limitedX = Math.min(
    Math.max(x, bounds.minX + radius),
    bounds.maxX - radius,
  );
  const limitedZ = Math.min(
    Math.max(z, bounds.minZ + radius),
    bounds.maxZ - radius,
  );
  if (limitedX !== x || limitedZ !== z) {
    hit = true;
    x = limitedX;
    z = limitedZ;
  }
  return hit ? { ...state, x, z, speed: 0 } : state;
}
