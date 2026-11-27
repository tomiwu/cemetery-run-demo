import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import { mixColor, seeded, smoothstep } from "./geometry";
import { PALETTE } from "./palette";

/**
 * The land of the intro: fields, a low hill with the cemetery on top, a winding dirt road
 * and a river. All functions are pure: the same input gives the same land.
 * The road runs along +z, the cemetery gate is at z = GATE_Z.
 */

export const GATE_Z = 16;

/** The flat top of the hill, where the cemetery stands. */
export const CEMETERY = {
  minX: -22,
  maxX: 22,
  minZ: GATE_Z,
  maxZ: 58,
  height: 4.2,
} as const;

const ROAD_WIDTH = 4.6;
const RIVER_HALF_WIDTH = 4.2;

/** Side-to-side offset of the road centre. The road is straight near the gate. */
export function roadCentre(z: number): number {
  const winding = smoothstep(4, -14, z);
  return winding * (6.5 * Math.sin(z / 13 + 0.6) + 1.6 * Math.sin(z / 5.3));
}

/** Side-to-side offset of the river centre. The river is on the left of the road. */
export function riverCentre(z: number): number {
  return (
    roadCentre(z) * 0.4 +
    17 -
    4 * Math.sin(z / 26 + 1.1) +
    28 * smoothstep(-10, 40, z)
  );
}

/** Distance from a point to the cemetery top (0 inside). */
function cemeteryDistance(x: number, z: number): number {
  const dx = Math.max(Math.abs(x) - CEMETERY.maxX, 0);
  const dz = Math.max(CEMETERY.minZ - 2 - z, z - CEMETERY.maxZ, 0);
  return Math.hypot(dx, dz);
}

function baseHeight(x: number, z: number): number {
  const d = cemeteryDistance(x, z);
  const hill = CEMETERY.height * (1 - smoothstep(0, 24, d));
  const flatRoad = smoothstep(5, 24, Math.abs(x - roadCentre(z)));
  const rolling =
    (Math.sin(x * 0.07 + 1.3) * Math.sin(z * 0.05 + 0.4) +
      0.5 * Math.sin(x * 0.13 + z * 0.09)) *
    1.1 *
    flatRoad *
    smoothstep(0, 14, d);
  const far =
    smoothstep(85, 175, Math.hypot(x, z - 20)) *
    17 *
    (0.6 + 0.4 * Math.sin(x * 0.035 + z * 0.02 + 2));
  return hill + rolling + far;
}

/** Ground height at a point. The river bed is lower than the banks. */
export function heightAt(x: number, z: number): number {
  const distance = Math.abs(x - riverCentre(z));
  const bed = 0.6 * (1 - smoothstep(2, 7, distance));
  return baseHeight(x, z) - bed;
}

const FIELD_COLORS: readonly string[] = [
  PALETTE.foliageDark,
  PALETTE.foliageLight,
  PALETTE.fieldWarm,
  PALETTE.grassDark,
  PALETTE.fieldOlive,
];

function groundColor(x: number, z: number, noise: number): Color {
  if (cemeteryDistance(x, z) < 2) {
    return mixColor(PALETTE.groundCemetery, PALETTE.foliageDark, noise);
  }
  const cell = Math.floor((x + 400) / 30 + Math.sin(z * 0.021) * 0.9);
  const row = Math.floor((z + 400) / 41 + Math.sin(x * 0.017) * 0.8);
  const index = Math.abs(cell * 7 + row * 3) % FIELD_COLORS.length;
  const field = mixColor(
    FIELD_COLORS[index] ?? PALETTE.foliageDark,
    FIELD_COLORS[(index + 1) % FIELD_COLORS.length] ?? PALETTE.foliageDark,
    noise * 0.6,
  );
  const hills = smoothstep(85, 175, Math.hypot(x, z - 20));
  return field.lerp(new Color(PALETTE.hills), hills * 0.6);
}

/** The ground: one mesh with vertex colours. Flat shading gives the low-poly look. */
export function groundGeometry(): BufferGeometry {
  const size = 420;
  const segments = 140;
  const centreZ = 40;
  const random = seeded(7);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= segments; row += 1) {
    for (let column = 0; column <= segments; column += 1) {
      const x = (column / segments - 0.5) * size;
      const z = centreZ + (row / segments - 0.5) * size;
      positions.push(x, heightAt(x, z), z);
      const color = groundColor(x, z, random());
      colors.push(color.r, color.g, color.b);
    }
  }
  const stride = segments + 1;
  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
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

interface RibbonOptions {
  centre: (z: number) => number;
  zFrom: number;
  zTo: number;
  step: number;
  halfWidth: number;
  /** Height of the ribbon at the point. */
  height: (x: number, z: number) => number;
  /** Colour at the side position `u` (-1..1) and the distance `z`. */
  color: (u: number, z: number) => Color;
}

const ACROSS = [-1, -0.6, -0.2, 0.2, 0.6, 1] as const;

function ribbon(options: RibbonOptions): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const steps = Math.ceil((options.zTo - options.zFrom) / options.step);
  for (let i = 0; i <= steps; i += 1) {
    const z = options.zFrom + (i * (options.zTo - options.zFrom)) / steps;
    const centre = options.centre(z);
    for (const u of ACROSS) {
      const x = centre + u * options.halfWidth;
      positions.push(x, options.height(x, z), z);
      const color = options.color(u, z);
      colors.push(color.r, color.g, color.b);
    }
  }
  const stride = ACROSS.length;
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j + 1 < stride; j += 1) {
      const a = i * stride + j;
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

/** The dirt road, pale in the middle and dark at the edges, from far away to the chapel. */
export function roadGeometry(): BufferGeometry {
  return ribbon({
    centre: roadCentre,
    zFrom: -130,
    zTo: 40,
    step: 2.5,
    halfWidth: ROAD_WIDTH / 2,
    height: (x, z) => heightAt(x, z) + 0.05,
    color: (u, z) => {
      const rut = Math.abs(u);
      const lit = mixColor(PALETTE.pathShadow, PALETTE.pathRut, 1 - rut ** 2);
      const patch = 0.5 + 0.5 * Math.sin(z * 0.9 + u * 3);
      lit.lerp(new Color(PALETTE.pathLit), patch * 0.15);
      // The edge fades into the grass.
      return lit.lerp(
        new Color(PALETTE.foliageDark),
        smoothstep(0.8, 1, rut) * 0.6,
      );
    },
  });
}

/** Water level at a point of the river. */
function waterHeight(z: number): number {
  return baseHeight(riverCentre(z), z) - 0.25;
}

/** The river. It mirrors the sky: mauve near, glowing amber far away. */
export function riverGeometry(): BufferGeometry {
  return ribbon({
    centre: riverCentre,
    zFrom: -130,
    zTo: 170,
    step: 4,
    halfWidth: RIVER_HALF_WIDTH,
    height: (_x, z) => waterHeight(z),
    color: (u, z) => {
      const far = smoothstep(-30, 150, z);
      // Near water is dark blue-grey like the high sky; far water glows like the horizon.
      const sky = mixColor(PALETTE.skyTop, PALETTE.water, 0.3 + far * 0.7)
        .lerp(new Color(PALETTE.horizonGlow), far * 0.75)
        .multiplyScalar(0.6 + 0.4 * far);
      const streak = 0.5 + 0.5 * Math.sin(z * 0.35 + u * 2);
      sky.lerp(new Color(PALETTE.horizonGlowLight), streak * 0.18 * far);
      return sky.lerp(
        new Color(PALETTE.foliageDark),
        smoothstep(0.7, 1, Math.abs(u)) * 0.45,
      );
    },
  });
}
