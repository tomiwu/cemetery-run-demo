import type { CONFIG } from "../config";
import type { Box, Circle, Shape, Vec } from "./collision";
import { seededRandom } from "./random";

/**
 * The cemetery map. It is pure data, made from `CONFIG.map` and a seed: the same config gives
 * the same map. x goes right, z goes toward the camera. The gate is in the south wall
 * (z = +length / 2), the chapel is at the north end (z = -length / 2).
 */

export type MapConfig = Omit<(typeof CONFIG)["map"], "seed"> & {
  seed: number;
};

/** A rectangle that is aligned with the axes. */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Placement extends Vec {
  /** Turn around the y axis in radians. */
  turn: number;
}

export interface GravePlacement extends Placement {
  /** Which gravestone model to use, 0 up to `graves.variants - 1`. */
  variant: number;
  /** True when the grave has a stone border and not a plain mound. */
  border: boolean;
}

export interface TreePlacement extends Placement {
  /** Which tree model to use, 0 up to `trees.variants - 1`. */
  variant: number;
}

export interface LightpostPlacement extends Placement {
  /** True for a real point light. The others only glow. */
  lit: boolean;
}

export interface CemeteryMap {
  /** The inside of the walls. */
  bounds: Box;
  roads: Rect[];
  /** Everything that blocks the hearse: circles for trees and stones, boxes for walls and chapel. */
  obstacles: Shape[];
  /** The wall boxes (also in `obstacles`). */
  walls: Box[];
  /** The closed gate (also in `obstacles`). */
  gate: Box;
  spawnPoints: Vec[];
  /** `z` is the centre. The door is at `z + depth / 2`. */
  chapel: { x: number; z: number; width: number; depth: number };
  candleSlots: Vec[];
  hearseStart: { x: number; z: number; heading: number };
  graves: GravePlacement[];
  trees: TreePlacement[];
  pumpkins: Placement[];
  lightposts: LightpostPlacement[];
}

function box(minX: number, maxX: number, minZ: number, maxZ: number): Box {
  return { kind: "box", minX, maxX, minZ, maxZ };
}

function circle(x: number, z: number, r: number): Circle {
  return { kind: "circle", x, z, r };
}

function rect(minX: number, maxX: number, minZ: number, maxZ: number): Rect {
  return { minX, maxX, minZ, maxZ };
}

function distanceToRect(x: number, z: number, area: Rect): number {
  const dx = Math.max(area.minX - x, 0, x - area.maxX);
  const dz = Math.max(area.minZ - z, 0, z - area.maxZ);
  return Math.hypot(dx, dz);
}

function distanceToShape(x: number, z: number, shape: Shape): number {
  return shape.kind === "circle"
    ? Math.hypot(x - shape.x, z - shape.z) - shape.r
    : distanceToRect(x, z, shape);
}

/** Tree places: two strips along the side walls, the north corners and one by the gate. */
const TREE_SPOTS: readonly (readonly [number, number])[] = [
  [-27.2, -19],
  [27.2, -12],
  [-27.2, -6],
  [27.2, 0],
  [-27.2, 8],
  [27.2, 14],
  [-27.2, 19],
  [27.2, 21],
  [-26, -40],
  [26, -40],
  [-15, -39],
  [15, -39],
  [-27.2, 37],
];

export function buildMap(cfg: MapConfig): CemeteryMap {
  const random = seededRandom(cfg.seed);
  const halfWidth = cfg.width / 2;
  const halfLength = cfg.length / 2;
  const wall = cfg.wallThickness;
  const halfRoad = cfg.roadWidth / 2;
  const bounds = box(-halfWidth, halfWidth, -halfLength, halfLength);

  // Walls and the closed gate.
  const gateHalf = cfg.gateWidth / 2;
  const walls: Box[] = [
    box(-halfWidth - wall, halfWidth + wall, -halfLength - wall, -halfLength),
    box(-halfWidth - wall, -halfWidth, -halfLength, halfLength),
    box(halfWidth, halfWidth + wall, -halfLength, halfLength),
    box(-halfWidth - wall, -gateHalf, halfLength, halfLength + wall),
    box(gateHalf, halfWidth + wall, halfLength, halfLength + wall),
  ];
  const gate = box(-gateHalf, gateHalf, halfLength, halfLength + wall);

  // Chapel at the north end, door to the south.
  const chapelDepth = cfg.chapel.depth;
  const chapel = {
    x: 0,
    z: -halfLength + 0.3 + chapelDepth / 2,
    width: cfg.chapel.width,
    depth: chapelDepth,
  };
  const doorZ = chapel.z + chapelDepth / 2;

  // Roads: the main road, the chapel plaza and the loop road.
  const loopX = cfg.loopHalfWidth;
  const loopZ = cfg.loopHalfLength;
  const roads: Rect[] = [
    rect(-halfRoad, halfRoad, doorZ, halfLength),
    rect(
      -cfg.chapel.plazaWidth / 2,
      cfg.chapel.plazaWidth / 2,
      doorZ,
      doorZ + cfg.chapel.plazaDepth,
    ),
    rect(
      -loopX - halfRoad,
      loopX + halfRoad,
      -loopZ - halfRoad,
      -loopZ + halfRoad,
    ),
    rect(
      -loopX - halfRoad,
      loopX + halfRoad,
      loopZ - halfRoad,
      loopZ + halfRoad,
    ),
    rect(
      -loopX - halfRoad,
      -loopX + halfRoad,
      -loopZ - halfRoad,
      loopZ + halfRoad,
    ),
    rect(
      loopX - halfRoad,
      loopX + halfRoad,
      -loopZ - halfRoad,
      loopZ + halfRoad,
    ),
  ];

  const obstacles: Shape[] = [
    ...walls,
    gate,
    box(
      chapel.x - chapel.width / 2,
      chapel.x + chapel.width / 2,
      chapel.z - chapelDepth / 2,
      doorZ,
    ),
  ];

  // Grave rows in the two fields.
  const g = cfg.graves;
  const graves: GravePlacement[] = [];
  const rowZ = (row: number): number => g.firstRow + row * g.rowSpacing;
  for (const side of [-1, 1]) {
    for (let row = 0; row < g.rows; row += 1) {
      for (let column = 0; column < g.columns; column += 1) {
        const x =
          side * (g.firstColumn + column * g.columnSpacing) +
          (random() - 0.5) * 2 * g.jitter;
        const z = rowZ(row) + (random() - 0.5) * 2 * g.jitter;
        const skip = random() < g.gap;
        const variant = Math.floor(random() * g.variants);
        const turn = (random() - 0.5) * 0.8;
        const border = random() < 0.4;
        if (skip) {
          continue;
        }
        graves.push({ x, z, variant, turn, border });
        obstacles.push(circle(x, z, g.radius));
      }
    }
  }

  const trees: TreePlacement[] = TREE_SPOTS.slice(0, cfg.trees.count).map(
    ([x, z]) => {
      const placed = {
        x: x + (random() - 0.5),
        z: z + (random() - 0.5) * 2,
        variant: Math.floor(random() * cfg.trees.variants),
        turn: random() * Math.PI * 2,
      };
      obstacles.push(circle(placed.x, placed.z, cfg.trees.radius));
      return placed;
    },
  );

  // Pumpkins between the graves of a row.
  const pumpkins: Placement[] = [];
  for (let i = 0; i < cfg.pumpkins.count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = (2 * i + 1) % g.rows;
    const column = i % (g.columns - 1);
    const x = side * (g.firstColumn + (column + 0.5) * g.columnSpacing);
    const z = rowZ(row) + 0.9;
    pumpkins.push({ x, z, turn: random() * Math.PI * 2 });
    obstacles.push(circle(x, z, cfg.pumpkins.radius));
  }

  // Lightposts: four with a light at the inner corners of the loop road, two at the gate.
  const lightposts: LightpostPlacement[] = [];
  const cornerX = loopX - halfRoad - 0.7;
  const cornerZ = loopZ - halfRoad - 0.7;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // The lamp arm points toward the road corner.
      lightposts.push({
        x: sx * cornerX,
        z: sz * cornerZ,
        turn: Math.atan2(sx, sz),
        lit: true,
      });
    }
  }
  for (const sx of [-1, 1]) {
    lightposts.push({
      x: sx * (gateHalf + 2.2),
      z: halfLength - 1.4,
      turn: Math.atan2(sx, 0.5),
      lit: false,
    });
  }
  for (const post of lightposts) {
    obstacles.push(circle(post.x, post.z, cfg.lightposts.radius));
  }

  // Candle slots in a row in front of the chapel door.
  const slots = cfg.candleSlots;
  const candleSlots: Vec[] = [];
  for (let i = 0; i < slots.count; i += 1) {
    candleSlots.push({
      x: chapel.x + (i - (slots.count - 1) / 2) * slots.spacing,
      z: doorZ + slots.fromDoor,
    });
  }

  // Spawn points: the free places in the gaps between the graves, spread over both fields.
  const candidates: Vec[] = [];
  for (let row = 0; row < g.rows; row += 1) {
    const z = rowZ(row) + g.rowSpacing / 2;
    for (const side of [-1, 1]) {
      for (let k = -1; k <= 2 * g.columns - 2; k += 1) {
        const x = side * (g.firstColumn + (k * g.columnSpacing) / 2);
        const free = obstacles.every(
          (shape) => distanceToShape(x, z, shape) >= cfg.spawns.clearance,
        );
        const offRoad = roads.every(
          (road) => distanceToRect(x, z, road) >= cfg.spawns.roadMargin,
        );
        if (
          free &&
          offRoad &&
          Math.abs(x) < halfWidth &&
          Math.abs(z) < halfLength
        ) {
          candidates.push({ x, z });
        }
      }
    }
  }
  const spawnPoints: Vec[] = [];
  for (let i = 0; i < cfg.spawns.count; i += 1) {
    const pick =
      candidates[
        Math.floor(((i + 0.5) * candidates.length) / cfg.spawns.count)
      ];
    if (pick !== undefined) {
      spawnPoints.push(pick);
    }
  }

  return {
    bounds,
    roads,
    obstacles,
    walls,
    gate,
    spawnPoints,
    chapel,
    candleSlots,
    hearseStart: { x: 0, z: halfLength - cfg.startFromGate, heading: Math.PI },
    graves,
    trees,
    pumpkins,
    lightposts,
  };
}
