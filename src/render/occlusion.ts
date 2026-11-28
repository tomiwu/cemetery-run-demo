import type { Material } from "three";
import { CONFIG } from "../config";

/**
 * Camera occlusion (PRD D22): trees and lamp posts between the camera and the hearse fade to
 * `CONFIG.camera.occlusionOpacity`, so the hearse stays in view at the walls.
 */

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** A prop that can fade: a round footprint on the ground, a height, and its materials. */
export interface Fadeable {
  x: number;
  z: number;
  /** Radius of the footprint (the crown or the head for a tree or a lamp) in metres. */
  radius: number;
  height: number;
  materials: Material[];
}

/**
 * True when the prop is between the camera and the target. The ground footprint must be near
 * the line from the target to the camera, and the prop must be higher than the line there.
 */
export function occludes(
  camera: Point3,
  target: Point3,
  prop: Pick<Fadeable, "x" | "z" | "radius" | "height">,
  margin: number,
): boolean {
  const dx = camera.x - target.x;
  const dz = camera.z - target.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared < 1e-9) {
    return false;
  }
  // Where along the line (0 = target, 1 = camera) the prop is nearest to the line.
  const t =
    ((prop.x - target.x) * dx + (prop.z - target.z) * dz) / lengthSquared;
  if (t <= 0 || t >= 1) {
    return false;
  }
  const distance = Math.hypot(
    prop.x - (target.x + dx * t),
    prop.z - (target.z + dz * t),
  );
  if (distance > prop.radius + margin) {
    return false;
  }
  return prop.height > target.y + (camera.y - target.y) * t;
}

/** Opacity that moves toward `goal` by at most `step`. */
export function fadeToward(value: number, goal: number, step: number): number {
  return value < goal
    ? Math.min(goal, value + step)
    : Math.max(goal, value - step);
}

export interface Fader {
  /** Move the opacity of all props toward the wanted value for this camera and target. */
  update: (camera: Point3, target: Point3, frameSeconds: number) => void;
  /** The current opacity of each prop (for tests). */
  opacities: () => number[];
}

export function createFader(props: readonly Fadeable[]): Fader {
  const opacity = props.map(() => 1);
  for (const prop of props) {
    for (const material of prop.materials) {
      // Always transparent: a switch at run time would need a new shader.
      material.transparent = true;
    }
  }
  return {
    update(camera, target, frameSeconds) {
      const step =
        CONFIG.camera.occlusionFadePerSecond * Math.max(0, frameSeconds);
      props.forEach((prop, index) => {
        const goal = occludes(
          camera,
          target,
          prop,
          CONFIG.camera.occlusionMargin,
        )
          ? CONFIG.camera.occlusionOpacity
          : 1;
        const next = fadeToward(opacity[index] ?? 1, goal, step);
        opacity[index] = next;
        for (const material of prop.materials) {
          material.opacity = next;
        }
      });
    },
    opacities: () => [...opacity],
  };
}
