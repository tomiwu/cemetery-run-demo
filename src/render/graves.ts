import {
  BoxGeometry,
  ConeGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import type { GravePlacement, Placement, Rect } from "../logic/map";
import { createRandom } from "../logic/random";
import { GeometryBatch, mergePlain, mixColor } from "./geometry";
import { patches, type Spot } from "./glow";
import { PALETTE } from "./palette";

/**
 * Upright headstones on stone bases, in rows (rounded tops, crosses and plinth graves), with
 * flat low stone borders. All stones are one mesh. Candle lanterns are instanced.
 */

type StoneKind = "round" | "cross" | "plinth" | "bevel";
const KINDS: readonly StoneKind[] = [
  "round",
  "cross",
  "round",
  "plinth",
  "bevel",
  "round",
  "cross",
];

/** Half a round disc that stands up: the arched top of a headstone. */
function arch(width: number, depth: number): BufferGeometry {
  const top = new CylinderGeometry(
    width / 2,
    width / 2,
    depth,
    10,
    1,
    false,
    0,
    Math.PI,
  );
  top.rotateX(Math.PI / 2);
  top.rotateZ(Math.PI / 2);
  return top;
}

/** Local frame of a grave: x right, z toward the front (south), turned by `turn`. */
function frame(grave: Placement) {
  const cos = Math.cos(grave.turn);
  const sin = Math.sin(grave.turn);
  return (lx: number, lz: number) => ({
    x: grave.x + lx * cos + lz * sin,
    z: grave.z - lx * sin + lz * cos,
  });
}

function addStone(
  batch: GeometryBatch,
  grave: GravePlacement,
  random: () => number,
): void {
  const at = frame(grave);
  const kind = KINDS[grave.variant % KINDS.length] ?? "round";
  const tone = mixColor(PALETTE.stoneGrey, PALETTE.stoneBeige, random());
  tone.multiplyScalar(0.82 + random() * 0.18);
  const dark = tone.clone().multiplyScalar(0.8);
  const part = (
    geometry: BufferGeometry,
    lx: number,
    y: number,
    lz: number,
    color: Color | string,
  ): void => {
    const place = at(lx, lz);
    batch.add(geometry, {
      x: place.x,
      y,
      z: place.z,
      turn: grave.turn,
      color,
    });
  };

  const baseWidth = kind === "plinth" ? 0.95 : 0.85;
  const baseDepth = kind === "plinth" ? 0.6 : 0.4;
  part(
    new BoxGeometry(baseWidth, 0.16, baseDepth),
    0,
    0.08,
    0,
    PALETTE.stoneBase,
  );

  if (kind === "round" || kind === "bevel") {
    const width = kind === "round" ? 0.62 : 0.78;
    const height = kind === "round" ? 1.0 : 0.88;
    const straight = height - width / 2;
    part(
      new BoxGeometry(width, straight, 0.14),
      0,
      0.16 + straight / 2,
      0,
      tone,
    );
    part(arch(width, 0.14), 0, 0.16 + straight, 0, tone);
    // A darker plate on the front: the stone face (no text).
    part(
      new BoxGeometry(width * 0.58, straight * 0.5, 0.02),
      0,
      0.16 + straight * 0.5,
      0.075,
      dark,
    );
  } else if (kind === "cross") {
    part(new BoxGeometry(0.22, 1.05, 0.14), 0, 0.16 + 0.525, 0, tone);
    part(new BoxGeometry(0.66, 0.2, 0.14), 0, 0.16 + 0.75, 0, tone);
    part(new BoxGeometry(0.34, 0.18, 0.2), 0, 0.25, 0, dark);
  } else {
    // Plinth grave: a wide foot, a shaft, a cap and a small round finial.
    part(new BoxGeometry(0.72, 0.28, 0.46), 0, 0.3, 0, dark);
    part(new BoxGeometry(0.5, 0.55, 0.3), 0, 0.72, 0, tone);
    part(new BoxGeometry(0.62, 0.1, 0.4), 0, 1.04, 0, tone);
    part(new SphereGeometry(0.13, 6, 4), 0, 1.2, 0, tone);
    part(new BoxGeometry(0.3, 0.26, 0.02), 0, 0.72, 0.16, dark);
  }

  if (grave.border) {
    // A flat, low stone border around the grave plot, in front of the stone.
    const border = PALETTE.stoneBase;
    const edge = 0.08;
    part(new BoxGeometry(0.9, 0.07, edge), 0, 0.035, 1.75, border);
    part(new BoxGeometry(0.9, 0.07, edge), 0, 0.035, 0.3, border);
    part(new BoxGeometry(edge, 0.07, 1.5), -0.45, 0.035, 1.02, border);
    part(new BoxGeometry(edge, 0.07, 1.5), 0.45, 0.035, 1.02, border);
    part(new BoxGeometry(0.74, 0.03, 1.38), 0, 0.015, 1.02, PALETTE.mapEarth);
  }
}

/** Where the lantern of a grave stands, or null when the grave has none. */
export function lanternSpot(
  grave: GravePlacement,
  random: () => number,
): { x: number; z: number; red: boolean } | null {
  const lit = random() < 0.9;
  const side = random() < 0.5 ? -1 : 1;
  const red = random() < 0.5;
  if (!lit) {
    return null;
  }
  const place = frame(grave)(side * 0.62, 0.55);
  return { x: place.x, z: place.z, red };
}

export interface Lantern {
  x: number;
  z: number;
  red: boolean;
  /** Scale of the lantern. */
  size: number;
}

export interface GraveLayer {
  group: Group;
  lanterns: Lantern[];
}

/** Shared lantern shapes: an iron frame, and the glass body that takes a red or white colour. */
export function lanternMeshes(
  items: readonly Lantern[],
  glowPools: boolean,
): Group {
  const group = new Group();
  group.name = "lanterns";
  const frameParts = new GeometryBatch();
  frameParts.add(new BoxGeometry(0.22, 0.05, 0.22), {
    y: 0.025,
    color: PALETTE.iron,
  });
  frameParts.add(new ConeGeometry(0.17, 0.12, 4), {
    y: 0.43,
    turn: Math.PI / 4,
    color: PALETTE.iron,
  });
  frameParts.add(new SphereGeometry(0.035, 5, 4), {
    y: 0.5,
    color: PALETTE.iron,
  });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      frameParts.add(new BoxGeometry(0.025, 0.32, 0.025), {
        x: sx * 0.095,
        y: 0.21,
        z: sz * 0.095,
        color: PALETTE.iron,
      });
    }
  }
  const glass = mergePlain([new BoxGeometry(0.17, 0.3, 0.17)]);
  glass.translate(0, 0.2, 0);
  const flame = new SphereGeometry(0.075, 6, 4);
  flame.scale(1, 1.7, 1);
  flame.translate(0, 0.2, 0);

  const frameMesh = new InstancedMesh(
    frameParts.build(),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.7,
      flatShading: true,
    }),
    items.length,
  );
  const glassMesh = new InstancedMesh(
    glass,
    new MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.92,
    }),
    items.length,
  );
  const flameMesh = new InstancedMesh(
    flame,
    new MeshBasicMaterial({ color: PALETTE.flame, fog: false }),
    items.length,
  );
  const matrix = new Matrix4();
  const red = new Color(PALETTE.candleRed);
  const white = new Color(PALETTE.candleWhite);
  items.forEach((item, index) => {
    matrix.makeScale(item.size, item.size, item.size);
    matrix.setPosition(item.x, 0, item.z);
    frameMesh.setMatrixAt(index, matrix);
    glassMesh.setMatrixAt(index, matrix);
    flameMesh.setMatrixAt(index, matrix);
    glassMesh.setColorAt(index, item.red ? red : white);
  });
  for (const mesh of [frameMesh, glassMesh, flameMesh]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }
  frameMesh.name = "lantern-frame";
  glassMesh.name = "lantern-glass";
  flameMesh.name = "lantern-flame";
  group.add(frameMesh, glassMesh, flameMesh);

  if (glowPools) {
    const pools: Spot[] = items.map((item) => ({
      x: item.x,
      y: 0.04,
      z: item.z,
      size: 1.2,
    }));
    const pool = patches(pools, {
      color: PALETTE.candleGlow,
      opacity: 0.5,
      additive: true,
      power: 2.2,
    });
    pool.name = "candle-pools";
    group.add(pool);
  }
  // A small soft glow around each flame (0.3 m), one draw call.
  const halo = patches(
    items.map((item) => ({
      x: item.x,
      y: 0.2 * item.size,
      z: item.z,
      size: 0.3 * item.size + 0.1,
    })),
    { color: PALETTE.flame, opacity: 0.9, additive: true, power: 1.5 },
  );
  halo.name = "flame-glow";
  group.add(halo);
  return group;
}

/**
 * Small props at the edge of the main path: low stones, flowers and a few lanterns. They are
 * decoration only (no collision) and they frame the path in the near view.
 */
export function pathEdgeProps(
  road: Rect,
  seed: number,
): { group: Group; lanterns: Lantern[] } {
  const random = createRandom(seed);
  const batch = new GeometryBatch();
  const lanterns: Lantern[] = [];
  const flowers = ["#D9C9A3", "#B8605A", "#C9A24A", "#8E86B0"];
  for (let z = road.minZ + 2; z < road.maxZ - 1.5; z += 1.4) {
    for (const side of [-1, 1]) {
      const x = side * (road.maxX + 0.35 + random() * 0.5);
      const kind = random();
      const zz = z + (random() - 0.5) * 0.8;
      if (kind < 0.4) {
        batch.add(new BoxGeometry(0.34, 0.2, 0.26), {
          x,
          y: 0.1,
          z: zz,
          turn: random() * Math.PI,
          color: mixColor(PALETTE.stoneGrey, PALETTE.stoneBase, random()),
        });
      } else if (kind < 0.85) {
        const colour =
          flowers[Math.floor(random() * flowers.length)] ?? "#D9C9A3";
        for (let k = 0; k < 4; k += 1) {
          batch.add(new SphereGeometry(0.07, 5, 4), {
            x: x + (random() - 0.5) * 0.4,
            y: 0.14 + random() * 0.08,
            z: zz + (random() - 0.5) * 0.4,
            color: colour,
          });
        }
        batch.add(new BoxGeometry(0.34, 0.1, 0.34), {
          x,
          y: 0.05,
          z: zz,
          color: PALETTE.foliageLight,
        });
      } else {
        lanterns.push({ x, z: zz, red: random() < 0.5, size: 1 });
      }
    }
  }
  const mesh = new Mesh(
    batch.build(),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
    }),
  );
  mesh.name = "path-edge-props";
  const group = new Group();
  group.add(mesh);
  return { group, lanterns };
}

export function buildGraves(
  graves: readonly GravePlacement[],
  seed: number,
): GraveLayer {
  const random = createRandom(seed);
  const batch = new GeometryBatch();
  const lanterns: Lantern[] = [];
  for (const grave of graves) {
    addStone(batch, grave, random);
    const spot = lanternSpot(grave, random);
    if (spot !== null) {
      lanterns.push({ ...spot, size: 1.15 });
    }
  }
  const stones = new Mesh(
    batch.build(),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
    }),
  );
  stones.name = "graves";
  const group = new Group();
  group.add(stones);
  return { group, lanterns };
}

/** Small muted pumpkins between the graves (a collision circle each). */
export function pumpkinMesh(items: readonly Placement[]): Mesh {
  const batch = new GeometryBatch();
  for (const item of items) {
    batch.add(new IcosahedronGeometry(0.2, 1), {
      x: item.x,
      y: 0.16,
      z: item.z,
      scale: [1.15, 0.85, 1.15],
      turn: item.turn,
      color: "#B06E2E",
    });
    batch.add(new BoxGeometry(0.07, 0.12, 0.07), {
      x: item.x,
      y: 0.34,
      z: item.z,
      color: "#2A2A1C",
    });
  }
  const mesh = new Mesh(
    batch.build(),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    }),
  );
  mesh.name = "pumpkins";
  return mesh;
}
