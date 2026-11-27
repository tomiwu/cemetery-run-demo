import { CONFIG } from "../config";

/**
 * World frame of the intro: the road runs along the z axis, the cemetery gate is at z = 0.
 * Heading 0 means "drive toward +z". Units are metres.
 */
export interface IntroKeyframe {
  /** Intro progress, 0..1. */
  t: number;
  hearse: { x: number; z: number; heading: number };
  camera: { x: number; y: number; z: number };
}

export type IntroSample = Omit<IntroKeyframe, "t">;

/** Keyframes as pure data. The hearse drives up the road to the cemetery gate and turns to face the camera. */
export const INTRO_KEYFRAMES: readonly IntroKeyframe[] = [
  {
    t: 0,
    hearse: { x: 0, z: -46, heading: 0 },
    camera: { x: -4.5, y: 7, z: -55.5 },
  },
  {
    t: 0.3,
    hearse: { x: 0, z: -30, heading: 0 },
    camera: { x: -4.5, y: 6.6, z: -39.5 },
  },
  {
    t: 0.7,
    hearse: { x: 0, z: -4, heading: 0 },
    camera: { x: -4.8, y: 5.8, z: -13 },
  },
  {
    t: 0.8,
    hearse: { x: 0, z: 4, heading: 0 },
    camera: { x: -3.5, y: 4.6, z: -4.5 },
  },
  {
    t: 1,
    hearse: { x: 1, z: 10.5, heading: -2.3 },
    camera: { x: -1.25, y: 2.9, z: 3.75 },
  },
];

/** Progress of the intro, 0..1, for the time since it started. */
export function introProgress(elapsedSeconds: number): number {
  return clamp01(elapsedSeconds / CONFIG.introSeconds);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/** Linear interpolation between the keyframes. `t` is the progress, 0..1. */
export function sampleIntro(
  t: number,
  keyframes: readonly IntroKeyframe[] = INTRO_KEYFRAMES,
): IntroSample {
  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error("The intro needs at least one keyframe.");
  }
  const time = clamp01(t);
  let from = first;
  let to = last;
  for (let i = 1; i < keyframes.length; i += 1) {
    const candidate = keyframes[i];
    if (candidate !== undefined && time <= candidate.t) {
      to = candidate;
      from = keyframes[i - 1] ?? first;
      break;
    }
  }
  const span = to.t - from.t;
  const k = span > 0 ? clamp01((time - from.t) / span) : 1;
  return {
    hearse: {
      x: lerp(from.hearse.x, to.hearse.x, k),
      z: lerp(from.hearse.z, to.hearse.z, k),
      heading: lerp(from.hearse.heading, to.hearse.heading, k),
    },
    camera: {
      x: lerp(from.camera.x, to.camera.x, k),
      y: lerp(from.camera.y, to.camera.y, k),
      z: lerp(from.camera.z, to.camera.z, k),
    },
  };
}
