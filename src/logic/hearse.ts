import type { Vec2 } from "./input";

/**
 * Hearse state on the ground plane. `heading` is the angle around the y axis.
 * The hearse drives toward (sin heading, cos heading): heading 0 points to +z
 * (toward the camera), heading PI points to -z (screen up).
 */
export interface HearseState {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface HearseConfig {
  readonly maxSpeed: number;
  readonly acceleration: number;
  readonly deceleration: number;
  readonly turnRate: number;
  readonly slowSpeed: number;
  readonly slowTurnShare: number;
  readonly maxStepSeconds: number;
}

export function initialHearse(
  x: number,
  z: number,
  heading: number,
): HearseState {
  return { x, z, heading, speed: 0 };
}

/** Smallest signed angle from `from` to `to`, in -PI..PI. */
function angleDifference(from: number, to: number): number {
  const turn = (to - from) % (2 * Math.PI);
  if (turn > Math.PI) {
    return turn - 2 * Math.PI;
  }
  if (turn < -Math.PI) {
    return turn + 2 * Math.PI;
  }
  return turn;
}

function approach(value: number, target: number, step: number): number {
  return value < target
    ? Math.min(target, value + step)
    : Math.max(target, value - step);
}

/**
 * One step of the hearse. The camera has a fixed world direction, so the input
 * vector is a world direction: screen up is -z, screen right is +x.
 */
export function stepHearse(
  state: HearseState,
  input: Vec2,
  dtSeconds: number,
  cfg: HearseConfig,
): HearseState {
  const dt = Math.min(Math.max(dtSeconds, 0), cfg.maxStepSeconds);
  const strength = Math.min(1, Math.hypot(input.x, input.y));

  let heading = state.heading;
  let speed: number;
  if (strength > 0) {
    const target = Math.atan2(input.x, -input.y);
    const share =
      cfg.slowTurnShare +
      (1 - cfg.slowTurnShare) * Math.min(1, state.speed / cfg.slowSpeed);
    const maxTurn = cfg.turnRate * share * dt;
    const difference = angleDifference(heading, target);
    heading += Math.max(-maxTurn, Math.min(maxTurn, difference));
    speed = approach(
      state.speed,
      cfg.maxSpeed * strength,
      (state.speed < cfg.maxSpeed * strength
        ? cfg.acceleration
        : cfg.deceleration) * dt,
    );
  } else {
    speed = approach(state.speed, 0, cfg.deceleration * dt);
  }

  return {
    x: state.x + Math.sin(heading) * speed * dt,
    z: state.z + Math.cos(heading) * speed * dt,
    heading,
    speed,
  };
}

/** State between two logic steps, for smooth drawing. `alpha` is 0..1. */
export function blendHearse(
  from: HearseState,
  to: HearseState,
  alpha: number,
): HearseState {
  const a = Math.min(1, Math.max(0, alpha));
  return {
    x: from.x + (to.x - from.x) * a,
    z: from.z + (to.z - from.z) * a,
    heading: from.heading + angleDifference(from.heading, to.heading) * a,
    speed: from.speed + (to.speed - from.speed) * a,
  };
}
