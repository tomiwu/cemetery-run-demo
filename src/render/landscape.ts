import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import type { Rect } from "../logic/map";
import { mixColor, smoothstep } from "./geometry";
import { PALETTE } from "./palette";

/**
 * The ground of the game: grass with small colour noise, and narrow warm dirt paths on the road
 * rectangles of the map. The paths only change the colour. The collision shapes do not change.
 * All functions are pure: the same input gives the same ground.
 */

/**
 * The path is this much narrower than the road rectangle on each side (a road of 5 m gives a
 * path of about 3 m), and its edge fades into the grass over half a metre.
 */
const PATH_INSET = 1;
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
  // A slow bend of the centre line gives a gentle S curve to the straight road rectangles.
  const bendX = x + 0.8 * Math.sin(z * 0.16);
  const bendZ = z + 0.8 * Math.sin(x * 0.16);
  let nearest = Infinity;
  for (const road of roads) {
    const inner: Rect = {
      minX: road.minX + PATH_INSET,
      maxX: road.maxX - PATH_INSET,
      minZ: road.minZ + PATH_INSET,
      maxZ: road.maxZ - PATH_INSET,
    };
    nearest = Math.min(nearest, distanceToRect(bendX, bendZ, inner));
  }
  return 1 - smoothstep(0, PATH_SOFT_EDGE, nearest);
}

/** Dirt colour at `k` (0..1): from the dark to the light end of the path range. */
export function pathColor(k: number): Color {
  // A little extra warmth: the cool sky light would make the dirt look grey.
  return mixColor(PALETTE.pathDirt, PALETTE.pathDirtLight, k).lerp(
    new Color(PALETTE.pathDirtWarm),
    0.3,
  );
}

/** Dark olive grass colour at `k` (0..1). */
export function grassColor(k: number): Color {
  return mixColor(PALETTE.grassOlive, PALETTE.grassOliveLight, k);
}

const GRID = 0.5;
const REACH_X = 38;
const REACH_Z = 54;

/** A smooth pseudo-random value (0..1) for a grid vertex. The same vertex always gives the same value. */
function vertexNoise(column: number, row: number, salt: number): number {
  const raw = Math.sin(column * 127.1 + row * 311.7 + salt * 74.7) * 43758.5453;
  return raw - Math.floor(raw);
}

/**
 * The ground inside and near the walls: a fine low-poly grid with smooth vertex colours (no
 * flat triangles), and the dirt paths in the colour. It is flat (y = 0). The grass outside is a
 * plain plane. The colour noise is small (about 4 per cent), so the grass shows soft variation.
 */
export function groundGeometry(roads: readonly Rect[]): BufferGeometry {
  const columns = Math.round((REACH_X * 2) / GRID);
  const rows = Math.round((REACH_Z * 2) / GRID);
  const stride = columns + 1;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const x = -REACH_X + column * GRID;
      const z = -REACH_Z + row * GRID;
      const path = pathAmount(roads, x, z);
      // Large soft patches, plus a small noise per vertex.
      const patch = 0.5 + 0.5 * Math.sin(x * 0.17) * Math.sin(z * 0.13);
      const grass = grassColor(0.15 + patch * 0.5).multiplyScalar(
        0.96 + vertexNoise(column, row, 1) * 0.08,
      );
      // Gravel: a lighter speckle in the dirt.
      const dirt = pathColor(0.35 + vertexNoise(column, row, 2) * 0.5);
      const color = grass.lerp(dirt, path);
      positions.push(x, 0, z);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      indices.push(a, c, b, b, c, c + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
