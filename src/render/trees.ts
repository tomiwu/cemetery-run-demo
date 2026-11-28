import {
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { CONFIG } from "../config";
import type { CemeteryMap } from "../logic/map";
import type { Fadeable } from "./occlusion";
import { createRandom } from "../logic/random";
import { GeometryBatch, mixColor } from "./geometry";
import { PALETTE } from "./palette";

/**
 * Tall slim dark green poplars and cypresses along the walls, and a dark tree line behind the
 * wall. All trees are one mesh. Only the trees of the map block the hearse.
 */

function poplar(
  batch: GeometryBatch,
  x: number,
  z: number,
  height: number,
  tone: number,
  width = 1,
): void {
  const color = mixColor(PALETTE.poplar, PALETTE.poplarLight, tone);
  batch.add(new CylinderGeometry(0.16, 0.26, 1.8, 5), {
    x,
    y: 0.9,
    z,
    color: PALETTE.trunk,
  });
  // A slim pointed crown of two faceted shapes.
  batch.add(new IcosahedronGeometry(1, 1), {
    x,
    y: 1.2 + height * 0.42,
    z,
    scale: [1.05 * width, height * 0.42, 1.05 * width],
    turn: tone * 6,
    color,
  });
  batch.add(new IcosahedronGeometry(1, 0), {
    x,
    y: 1.2 + height * 0.78,
    z,
    scale: [0.72 * width, height * 0.26, 0.72 * width],
    turn: tone * 3,
    color: mixColor(
      PALETTE.poplar,
      PALETTE.poplarLight,
      Math.min(1, tone + 0.2),
    ),
  });
}

function roundTree(
  batch: GeometryBatch,
  x: number,
  z: number,
  size: number,
  tone: number,
): void {
  const color = mixColor(PALETTE.treeLine, PALETTE.poplar, tone);
  batch.add(new CylinderGeometry(0.3 * size, 0.45 * size, 2.4 * size, 5), {
    x,
    y: 1.2 * size,
    z,
    color: PALETTE.trunk,
  });
  batch.add(new IcosahedronGeometry(1, 1), {
    x,
    y: 4 * size,
    z,
    scale: [2.6 * size, 2.5 * size, 2.6 * size],
    turn: tone * 6,
    color,
  });
}

export interface Trees {
  /** The trees of the map: one mesh each, so that one can fade when it hides the hearse. */
  fadeables: Fadeable[];
  group: Group;
}

function treeMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
  });
}

export function buildTrees(map: CemeteryMap, seed: number): Trees {
  const random = createRandom(seed);
  const batch = new GeometryBatch();
  const halfWidth = map.bounds.maxX;
  const halfLength = map.bounds.maxZ;

  // The trees of the map (they block the hearse): tall cypresses along the walls. Each is its own
  // mesh, so that it can fade when it is between the camera and the hearse.
  const group = new Group();
  group.name = "trees";
  const fadeables: Fadeable[] = [];
  for (const tree of map.trees) {
    const single = new GeometryBatch();
    const height = 8.5 + random() * 2.5;
    poplar(single, tree.x, tree.z, height, random(), 1.05);
    const material = treeMaterial();
    const mesh = new Mesh(single.build(), material);
    mesh.name = "tree";
    group.add(mesh);
    fadeables.push({
      x: tree.x,
      z: tree.z,
      radius: CONFIG.map.trees.radius,
      height: 1.2 + height,
      materials: [material],
    });
  }
  // A row of poplars just outside each wall. Each is its own mesh and can fade, because the
  // camera looks through this row at the walls.
  const solo = (x: number, z: number, height: number, tone: number): void => {
    const single = new GeometryBatch();
    poplar(single, x, z, height, tone);
    const material = treeMaterial();
    const mesh = new Mesh(single.build(), material);
    mesh.name = "wall-tree";
    group.add(mesh);
    fadeables.push({
      x,
      z,
      radius: 1.2,
      height: 1.2 + height,
      materials: [material],
    });
  };
  const out = 3;
  for (let z = -halfLength - 1; z <= halfLength + 4; z += 5 + random() * 1.5) {
    for (const side of [-1, 1]) {
      solo(
        side * (halfWidth + out + random() * 0.8),
        z,
        9 + random() * 4,
        random(),
      );
    }
  }
  for (let x = -halfWidth + 2; x <= halfWidth - 2; x += 5.5 + random() * 1.5) {
    solo(x, -halfLength - out - random() * 0.8, 9 + random() * 4, random());
    if (Math.abs(x) > 9) {
      solo(x, halfLength + out + random() * 0.8, 8 + random() * 3, random());
    }
  }
  // A dark tree line behind: two rings of round and column trees.
  for (let ring = 0; ring < 2; ring += 1) {
    const reachX = halfWidth + 12 + ring * 9;
    const reachZ = halfLength + 12 + ring * 9;
    const total = 2 * (reachX + reachZ);
    const count = Math.round(total / (4.2 - ring * 0.6));
    for (let i = 0; i < count; i += 1) {
      const t = ((i + random() * 0.8) / count) * total;
      let x: number;
      let z: number;
      if (t < 2 * reachX) {
        x = -reachX + t;
        z = -reachZ;
      } else if (t < 2 * reachX + 2 * reachZ) {
        x = reachX;
        z = -reachZ + (t - 2 * reachX);
      } else if (t < 4 * reachX + 2 * reachZ) {
        x = reachX - (t - 2 * reachX - 2 * reachZ);
        z = reachZ;
      } else {
        x = -reachX;
        z = reachZ - (t - 4 * reachX - 2 * reachZ);
      }
      x += (random() - 0.5) * 3;
      z += (random() - 0.5) * 3;
      if (random() < 0.5) {
        poplar(batch, x, z, 10 + random() * 5, random() * 0.5, 1.15);
      } else {
        roundTree(batch, x, z, 1.1 + random() * 0.7, random() * 0.5);
      }
    }
  }
  const line = new Mesh(batch.build(), treeMaterial());
  line.name = "tree-line";
  group.add(line);
  return { fadeables, group };
}
