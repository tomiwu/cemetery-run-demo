import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export { createRandom as seeded } from "../logic/random";

export interface PartOptions {
  x?: number;
  y?: number;
  z?: number;
  /** One number for all axes, or one per axis. */
  scale?: number | readonly [number, number, number];
  /** Turn around the y axis, in radians. */
  turn?: number;
  /** Tilt around the x axis, in radians (applied before the turn). */
  tilt?: number;
  /** Lean around the z axis, in radians (applied first). */
  lean?: number;
  color?: string | Color;
}

const UP = new Vector3(0, 1, 0);
const RIGHT = new Vector3(1, 0, 0);
const FORWARD = new Vector3(0, 0, 1);

/**
 * Collects many shapes in one geometry with vertex colours, so a whole set of
 * trees or headstones is one draw call.
 */
export class GeometryBatch {
  private readonly parts: BufferGeometry[] = [];

  get size(): number {
    return this.parts.length;
  }

  /** Number of vertices so far. The merged geometry keeps the order of the parts. */
  get vertexCount(): number {
    return this.parts.reduce(
      (total, part) => total + part.getAttribute("position").count,
      0,
    );
  }

  add(source: BufferGeometry, options: PartOptions = {}): this {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.deleteAttribute("uv");
    const scale = options.scale ?? 1;
    const scaleVector =
      typeof scale === "number"
        ? new Vector3(scale, scale, scale)
        : new Vector3(scale[0], scale[1], scale[2]);
    const rotation = new Quaternion()
      .setFromAxisAngle(UP, options.turn ?? 0)
      .multiply(new Quaternion().setFromAxisAngle(RIGHT, options.tilt ?? 0))
      .multiply(new Quaternion().setFromAxisAngle(FORWARD, options.lean ?? 0));
    const matrix = new Matrix4().compose(
      new Vector3(options.x ?? 0, options.y ?? 0, options.z ?? 0),
      rotation,
      scaleVector,
    );
    geometry.applyMatrix4(matrix);
    if (!("normal" in geometry.attributes)) {
      geometry.computeVertexNormals();
    }
    const color = new Color(options.color ?? "#ffffff");
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    this.parts.push(geometry);
    return this;
  }

  build(): BufferGeometry {
    return mergeGeometries(this.parts, false);
  }
}

/** Merge plain geometries (no colours) that use one material. */
export function mergePlain(sources: readonly BufferGeometry[]): BufferGeometry {
  const parts = sources.map((source) => {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.deleteAttribute("uv");
    if (!("normal" in geometry.attributes)) {
      geometry.computeVertexNormals();
    }
    return geometry;
  });
  return mergeGeometries(parts, false);
}

/** A colour between `a` and `b`. `k` is 0..1. */
export function mixColor(a: string, b: string, k: number): Color {
  return new Color(a).lerp(new Color(b), Math.min(1, Math.max(0, k)));
}

export type GradientStop = readonly [number, string | Color];

const scratch = new Color();

/** The colour of a gradient at `position`, written to `target`. Stops go from low to high. */
export function gradientAt(
  stops: readonly GradientStop[],
  position: number,
  target: Color,
): Color {
  let index = 0;
  while (index < stops.length - 2 && position > (stops[index + 1]?.[0] ?? 1)) {
    index += 1;
  }
  const from = stops[index];
  const to = stops[index + 1];
  if (from === undefined || to === undefined) {
    throw new Error("A gradient needs two colour stops.");
  }
  const k = Math.min(1, Math.max(0, (position - from[0]) / (to[0] - from[0])));
  return target.set(from[1]).lerp(scratch.set(to[1]), k);
}

export function smoothstep(
  edge0: number,
  edge1: number,
  value: number,
): number {
  const k = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return k * k * (3 - 2 * k);
}
