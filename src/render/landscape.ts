import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import type { Rect } from "../logic/map";
import { mixColor, seeded, smoothstep } from "./geometry";
import { PALETTE } from "./palette";

/**
 * The ground of the game: grass with small colour noise, and narrow warm dirt paths on the road
 * rectangles of the map. The paths only change the colour. The collision shapes do not change.
 * All functions are pure: the same input gives the same ground.
 */

/** The path is this much narrower than the road rectangle on each side, and its edge is soft. */
const PATH_INSET = 1.25;
const PATH_SOFT_EDGE = 0.5;

/** Distance from a point to a rectangle (0 inside). */
function distanceToRect(x: number, z: number, area: Rect): number {
  const dx = Math.max(area.minX - x, 0, x - area.maxX);
  const dz = Math.max(area.minZ - z, 0, z - area.maxZ);
  return Math.hypot(dx, dz);
}

/** How much of the dirt path is at a point: 1 on the path, 0 on the grass, soft between. */
export function pathAmount(
  roads: readonly Rect[],
  x: number,
  z: number,
): number {
  // A slow wobble of the edge gives a gentle curve to the straight road rectangles.
  const wobble =
    0.45 * Math.sin(z * 0.23 + x * 0.11) + 0.3 * Math.sin(x * 0.37 - z * 0.19);
  let nearest = Infinity;
  for (const road of roads) {
    const inner: Rect = {
      minX: road.minX + PATH_INSET,
      maxX: road.maxX - PATH_INSET,
      minZ: road.minZ + PATH_INSET,
      maxZ: road.maxZ - PATH_INSET,
    };
    nearest = Math.min(nearest, distanceToRect(x, z, inner));
  }
  return 1 - smoothstep(0, PATH_SOFT_EDGE, nearest + wobble);
}

/** Dirt colour at `k` (0..1): from the dark to the light end of the path range. */
export function pathColor(k: number): Color {
  // A little extra warmth: the cool sky light would make the dirt look grey.
  return mixColor(PALETTE.pathDirt, PALETTE.pathDirtLight, k).lerp(
    new Color(PALETTE.pathDirtWarm),
    0.22,
  );
}

/** Dark olive grass colour at `k` (0..1). */
export function grassColor(k: number): Color {
  return mixColor(PALETTE.grassOlive, PALETTE.grassOliveLight, k);
}

const GRID = 0.75;
const REACH_X = 38;
const REACH_Z = 54;
/** Largest random colour change of a vertex (4 %). */
const NOISE = 0.04;

/**
 * The ground inside and near the walls: a fine grid with smooth vertex colours (no flat colour
 * per triangle), and the dirt paths in the colour. It is flat (y = 0). The grass outside is a
 * plain plane.
 */
export function groundGeometry(roads: readonly Rect[]): BufferGeometry {
  const random = seeded(23);
  const columns = Math.round((REACH_X * 2) / GRID);
  const rows = Math.round((REACH_Z * 2) / GRID);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const x = -REACH_X + column * GRID;
      const z = -REACH_Z + row * GRID;
      const path = pathAmount(roads, x, z);
      // Slow patches of light and dark, and a gravel grain on the path.
      const patch = 0.5 + 0.5 * Math.sin(x * 0.17) * Math.sin(z * 0.13);
      const grass = grassColor(0.25 + patch * 0.5);
      const dirt = pathColor(0.5 + (patch - 0.5) * 0.3);
      const color = grass
        .lerp(dirt, path)
        .multiplyScalar(1 + (random() - 0.5) * 2 * NOISE);
      positions.push(x, 0, z);
      colors.push(color.r, color.g, color.b);
    }
  }
  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
