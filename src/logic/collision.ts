import { CONFIG } from "../config";
import { withKnock, type HearseState } from "./hearse";

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
/** A contact that never happened: more time than the grace time. */
const LONG_AGO = 1e9;

/** A grave that the hearse can hit. */
export interface GraveBody {
  id: number;
  x: number;
  z: number;
  r: number;
  /** False for the target grave of a delivery: it never breaks. */
  breakable: boolean;
}

/** The hearse hit a solid obstacle or a soft grave. `impact` is the speed into it in m/s. */
export interface BumpEvent {
  type: "bump";
  x: number;
  z: number;
  impact: number;
}

/** The hearse broke a grave. */
export interface GraveBrokenEvent {
  type: "graveBroken";
  id: number;
  x: number;
  z: number;
}

export interface Resolved {
  hearse: HearseState;
  events: (BumpEvent | GraveBrokenEvent)[];
}

interface Contact {
  nx: number;
  nz: number;
  depth: number;
  /** Restitution of the obstacle. */
  e: number;
  /** The point on the hearse circle that touches the obstacle. */
  px: number;
  pz: number;
}

interface Hard {
  shape: Shape;
  e: number;
}

/** The two circles of the hearse: in front of and behind the middle, on the heading axis. */
export function hearseCircles(
  state: Pick<HearseState, "x" | "z" | "heading">,
): [Circle, Circle] {
  const { colliderOffset: offset, colliderRadius: r } = CONFIG.collision;
  const dx = Math.sin(state.heading) * offset;
  const dz = Math.cos(state.heading) * offset;
  return [
    { kind: "circle", x: state.x + dx, z: state.z + dz, r },
    { kind: "circle", x: state.x - dx, z: state.z - dz, r },
  ];
}

/**
 * The vector that moves a circle out of the hearse body: the two hearse circles and the part
 * between them (a capsule). Null when they do not touch. A circle on the axis leaves to the side.
 */
export function pushOutOfHearse(
  circle: Mover,
  hearse: Pick<HearseState, "x" | "z" | "heading">,
): Vec | null {
  const { colliderOffset: offset, colliderRadius: r } = CONFIG.collision;
  const ax = Math.sin(hearse.heading);
  const az = Math.cos(hearse.heading);
  const along = Math.min(
    offset,
    Math.max(-offset, (circle.x - hearse.x) * ax + (circle.z - hearse.z) * az),
  );
  const dx = circle.x - (hearse.x + ax * along);
  const dz = circle.z - (hearse.z + az * along);
  const distance = Math.hypot(dx, dz);
  const reach = r + circle.r;
  if (distance >= reach) {
    return null;
  }
  if (distance < 1e-9) {
    return { x: az * reach, z: -ax * reach };
  }
  const scale = (reach - distance) / distance;
  return { x: dx * scale, z: dz * scale };
}

/** The velocity of the hearse on the ground: the heading part plus the knock-back. */
export function hearseVelocity(state: HearseState): Vec {
  return {
    x: Math.sin(state.heading) * state.speed + (state.knock?.x ?? 0),
    z: Math.cos(state.heading) * state.speed + (state.knock?.z ?? 0),
  };
}

/** Speed loss per second of a scrape: none along the wall, much more when it points into it. */
function scrapeLoss(speed: number, into: number): number {
  const along = Math.sqrt(Math.max(0, speed * speed - into * into));
  const bend = 1 - along / speed;
  return speed * CONFIG.collision.scrapeDrag * bend * bend;
}

function withVelocity(state: HearseState, v: Vec): HearseState {
  const along = Math.max(
    0,
    v.x * Math.sin(state.heading) + v.z * Math.cos(state.heading),
  );
  const knockX = v.x - Math.sin(state.heading) * along;
  const knockZ = v.z - Math.cos(state.heading) * along;
  return withKnock(
    { ...state, speed: along },
    Math.hypot(knockX, knockZ) > 1e-6 ? { x: knockX, z: knockZ } : undefined,
  );
}

/**
 * Move the hearse out of the obstacles and keep it inside `bounds` (the walls), then change the
 * velocity (PRD D22). Only a velocity that points into the obstacle changes, so a hearse that
 * moves away is free at once:
 * - First step of a contact with an impact of `bumpMinImpact` or more: the part along the obstacle keeps `tangentKeep`, the part into it
 *   comes back reversed times the restitution (at least `minRebound` for a hard hit). The forward
 *   speed is the part of the new velocity along the heading, the rest is the knock-back.
 * - Later steps of the same contact (a scrape): only the position changes, so the hearse slides.
 *   A scrape that points into the wall loses speed (`scrapeLoss`).
 * - A contact that lasts too long at a low speed gets an extra push out.
 * A grave breaks at `graveHit.breakSpeed` or more: the hearse keeps `speedFactor` of its speed and
 * there is no push. Slower, the grave is a soft obstacle (restitution 0).
 * The same state object comes back when there was no contact for a while.
 */
export function resolveHearse(
  state: HearseState,
  dt: number,
  obstacles: readonly Shape[],
  bounds: Box,
  graves: readonly GraveBody[] = [],
): Resolved {
  const events: (BumpEvent | GraveBrokenEvent)[] = [];
  const cc = CONFIG.collision;
  const r = cc.colliderRadius;
  let working = state;

  // Graves: fast hits break them, the others stay as soft obstacles.
  const hard: Hard[] = obstacles.map((shape) => ({
    shape,
    e: shape.kind === "box" ? cc.restitution.wall : cc.restitution.tree,
  }));
  const velocity = hearseVelocity(state);
  const groundSpeed = Math.hypot(velocity.x, velocity.z);
  const start = hearseCircles(state);
  let factor = 1;
  for (const grave of graves) {
    const touched = start.some((body) => circleVsCircle(body, grave) !== null);
    if (
      touched &&
      grave.breakable &&
      groundSpeed >= CONFIG.graveHit.breakSpeed
    ) {
      events.push({
        type: "graveBroken",
        id: grave.id,
        x: grave.x,
        z: grave.z,
      });
      factor *= CONFIG.graveHit.speedFactor;
    } else {
      hard.push({
        shape: { kind: "circle", x: grave.x, z: grave.z, r: grave.r },
        e: cc.restitution.soft,
      });
    }
  }
  if (factor !== 1) {
    const knock = state.knock;
    working = withKnock(
      { ...state, speed: state.speed * factor },
      knock === undefined
        ? undefined
        : { x: knock.x * factor, z: knock.z * factor },
    );
  }

  // Push out. A few passes: a push out of one obstacle can move the hearse into the next one.
  let x = working.x;
  let z = working.z;
  const contacts: Contact[] = [];
  for (let pass = 0; pass < PASSES; pass += 1) {
    let moved = false;
    for (const item of hard) {
      for (const body of hearseCircles({ ...working, x, z })) {
        const push = pushOut(body, item.shape);
        if (push === null) {
          continue;
        }
        const depth = Math.hypot(push.x, push.z);
        x += push.x;
        z += push.z;
        moved = true;
        const nx = push.x / depth;
        const nz = push.z / depth;
        contacts.push({
          nx,
          nz,
          depth,
          e: item.e,
          px: body.x - nx * r,
          pz: body.z - nz * r,
        });
      }
    }
    if (!moved) {
      break;
    }
  }
  // The walls: keep both circles inside.
  let shiftX = 0;
  let shiftZ = 0;
  for (const body of hearseCircles({ ...working, x, z })) {
    const lowX = bounds.minX + r - body.x;
    const highX = bounds.maxX - r - body.x;
    const lowZ = bounds.minZ + r - body.z;
    const highZ = bounds.maxZ - r - body.z;
    if (lowX > shiftX) shiftX = lowX;
    if (highX < shiftX) shiftX = highX;
    if (lowZ > shiftZ) shiftZ = lowZ;
    if (highZ < shiftZ) shiftZ = highZ;
  }
  for (const [shift, nx, nz] of [
    [shiftX, Math.sign(shiftX), 0],
    [shiftZ, 0, Math.sign(shiftZ)],
  ] as const) {
    if (shift !== 0) {
      contacts.push({
        nx,
        nz,
        depth: Math.abs(shift),
        e: cc.restitution.wall,
        px: x - nx * r,
        pz: z - nz * r,
      });
    }
  }
  x += shiftX;
  z += shiftZ;

  const apart = state.apart ?? LONG_AGO;
  if (contacts.length === 0) {
    const touch = state.touch ?? 0;
    if (factor === 1 && apart >= cc.contactGraceSeconds && touch === 0) {
      return { hearse: state, events };
    }
    const nextApart = Math.min(apart + dt, cc.contactGraceSeconds);
    return {
      hearse: {
        ...working,
        touch: nextApart >= cc.contactGraceSeconds ? 0 : touch,
        apart: nextApart,
      },
      events,
    };
  }

  // One normal for the contact: the pushes added up. The deepest push gives the restitution.
  let sumX = 0;
  let sumZ = 0;
  let deepest = contacts[0] as Contact;
  for (const contact of contacts) {
    sumX += contact.nx * (contact.depth + 1e-6);
    sumZ += contact.nz * (contact.depth + 1e-6);
    if (contact.depth > deepest.depth) {
      deepest = contact;
    }
  }
  const sum = Math.hypot(sumX, sumZ);
  const nx = sum > 1e-9 ? sumX / sum : 0;
  const nz = sum > 1e-9 ? sumZ / sum : 0;
  x += nx * cc.pushOutExtra;
  z += nz * cc.pushOutExtra;

  let next: HearseState = { ...working, x, z };
  const fresh = apart >= cc.contactGraceSeconds;
  const v = hearseVelocity(next);
  const vn = v.x * nx + v.z * nz;
  if (vn < 0) {
    const into = -vn;
    // A weak touch (under the bump impact) has no response: the scrape rule below holds it.
    if (fresh && into >= cc.bumpMinImpact) {
      let back = deepest.e * into;
      if (deepest.e > 0) {
        back = Math.max(back, cc.minRebound);
      }
      next = withVelocity(next, {
        x: cc.tangentKeep * (v.x - vn * nx) + back * nx,
        z: cc.tangentKeep * (v.z - vn * nz) + back * nz,
      });
      events.push({
        type: "bump",
        x: deepest.px,
        z: deepest.pz,
        impact: into,
      });
    } else {
      // A scrape: the position push-out slides the hearse. Only the knock into the wall goes.
      const knock = next.knock;
      const knockInto = knock === undefined ? 0 : knock.x * nx + knock.z * nz;
      const headInto =
        -(Math.sin(next.heading) * nx + Math.cos(next.heading) * nz) *
        next.speed;
      next = withKnock(
        {
          ...next,
          speed:
            headInto > 0 && next.speed > 0
              ? Math.max(0, next.speed - scrapeLoss(next.speed, headInto) * dt)
              : next.speed,
        },
        knock !== undefined && knockInto < 0
          ? { x: knock.x - knockInto * nx, z: knock.z - knockInto * nz }
          : knock,
      );
    }
  }

  // Contact time. A short gap does not end a contact.
  let touch = (fresh ? 0 : (state.touch ?? 0)) + dt;
  const after = hearseVelocity(next);
  if (
    touch > cc.unstick.seconds &&
    Math.hypot(after.x, after.z) < cc.unstick.speed
  ) {
    next = {
      ...next,
      x: next.x + nx * cc.unstick.push,
      z: next.z + nz * cc.unstick.push,
    };
    touch = 0;
  }
  return { hearse: { ...next, touch, apart: 0 }, events };
}
