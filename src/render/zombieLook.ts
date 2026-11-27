/**
 * The slow shambling walk of a zombie. A phase of 1 is one full cycle (two steps).
 * All angles are in radians. The functions are pure.
 */
export interface ZombiePose {
  /** Swing of the legs: the left leg gets +legSwing, the right leg -legSwing. */
  legSwing: number;
  /** Small swing of the arms around "straight forward". */
  armSwing: number;
  /** Lift of the body in metres. */
  bob: number;
  /** Side sway of the body. */
  sway: number;
}

export function zombiePose(phase: number): ZombiePose {
  const angle = phase * Math.PI * 2;
  return {
    legSwing: 0.45 * Math.sin(angle),
    armSwing: 0.16 * Math.sin(angle + 1.2),
    bob: 0.04 * (0.5 + 0.5 * Math.cos(angle * 2)),
    sway: 0.07 * Math.sin(angle),
  };
}
