import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  IcosahedronGeometry,
  Shape,
} from "three";
import { GeometryBatch, mixColor, seeded } from "./geometry";
import { PALETTE } from "./palette";
import { CEMETERY, GATE_Z, heightAt, riverCentre, roadCentre } from "./terrain";

/** Where the small chapel stands, and its size. */
export const CHAPEL = {
  x: 0,
  z: 46,
  width: 6.4,
  length: 9,
  wall: 4.4,
} as const;

export interface Candle {
  x: number;
  y: number;
  z: number;
}

/** Triangular prism for the gable roof. The ridge runs along z. */
function roofGeometry(
  width: number,
  height: number,
  length: number,
): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, -length / 2);
  return geometry;
}

/** An arched shape (door or window) that faces -z: a box with a round top. */
function arch(batch: GeometryBatch, options: ArchOptions): void {
  const { x, y, z, width, height, color, facing } = options;
  const turn = facing === "side" ? Math.PI / 2 : 0;
  const straight = height - width / 2;
  const place = (
    dx: number,
    dy: number,
  ): { x: number; y: number; z: number } =>
    facing === "side"
      ? { x, y: y + dy, z: z + dx }
      : { x: x + dx, y: y + dy, z };
  const depth = 0.1;
  batch.add(new BoxGeometry(width, straight, depth), {
    ...place(0, straight / 2),
    turn,
    color,
  });
  const top = new CylinderGeometry(
    width / 2,
    width / 2,
    depth,
    8,
    1,
    false,
    0,
    Math.PI,
  );
  top.rotateX(Math.PI / 2);
  top.rotateZ(Math.PI / 2);
  batch.add(top, { ...place(0, straight), turn, color });
}

interface ArchOptions {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  color: string;
  facing: "front" | "side";
}

/**
 * Small red-brick chapel: steep gable roof, a bell turret with a cross, an arched door with
 * warm light and tall arched windows. The door faces the road (-z).
 */
export function addChapel(scenery: GeometryBatch, glow: GeometryBatch): void {
  const groundY = CEMETERY.height;
  const { x, z, width, length, wall } = CHAPEL;
  scenery.add(new BoxGeometry(width + 0.5, 0.4, length + 0.5), {
    x,
    y: groundY + 0.1,
    z,
    color: PALETTE.chapelBase,
  });
  scenery.add(new BoxGeometry(width, wall, length), {
    x,
    y: groundY + wall / 2,
    z,
    color: PALETTE.brick,
  });
  // A small side wing, lower.
  scenery.add(new BoxGeometry(3, wall - 1.2, 3.4), {
    x: x + width / 2 + 1.3,
    y: groundY + (wall - 1.2) / 2,
    z: z + 1.5,
    color: PALETTE.brickDark,
  });
  scenery.add(roofGeometry(3.6, 1.8, 3.8), {
    x: x + width / 2 + 1.3,
    y: groundY + wall - 1.2,
    z: z + 1.5,
    color: PALETTE.chapelRoof,
  });
  // Steep gable roof, with a small overhang.
  scenery.add(roofGeometry(width + 0.9, 3.6, length + 0.9), {
    x,
    y: groundY + wall,
    z,
    color: PALETTE.chapelRoof,
  });
  // Bell turret and cross on the front gable.
  const turretZ = z - length / 2 + 1.1;
  scenery.add(new BoxGeometry(1.1, 1.6, 1.1), {
    x,
    y: groundY + wall + 3.6 - 0.4 + 0.8,
    z: turretZ,
    color: PALETTE.brick,
  });
  scenery.add(new ConeGeometry(0.95, 1.4, 4), {
    x,
    y: groundY + wall + 3.6 + 1.4 + 0.55,
    z: turretZ,
    turn: Math.PI / 4,
    color: PALETTE.chapelRoof,
  });
  scenery.add(new BoxGeometry(0.1, 0.8, 0.1), {
    x,
    y: groundY + wall + 3.6 + 2.65,
    z: turretZ,
    color: PALETTE.iron,
  });
  scenery.add(new BoxGeometry(0.5, 0.1, 0.1), {
    x,
    y: groundY + wall + 3.6 + 2.8,
    z: turretZ,
    color: PALETTE.iron,
  });
  // Warm arched door and windows (glow).
  const front = z - length / 2 - 0.06;
  arch(glow, {
    x,
    y: groundY + 0.3,
    z: front,
    width: 1.3,
    height: 2.4,
    color: PALETTE.horizonGlowWarm,
    facing: "front",
  });
  for (const side of [-1, 1]) {
    arch(glow, {
      x: x + side * 1.9,
      y: groundY + 1.5,
      z: front,
      width: 0.6,
      height: 1.8,
      color: PALETTE.candle,
      facing: "front",
    });
    for (const dz of [-2.4, 0.4, 2.8]) {
      arch(glow, {
        x: x + side * (width / 2 + 0.06),
        y: groundY + 1.5,
        z: z + dz,
        width: 0.65,
        height: 1.9,
        color: PALETTE.candle,
        facing: "side",
      });
    }
  }
}

/** Is a point on the road, the chapel or the path? Graves keep away from these. */
function isFree(x: number, z: number): boolean {
  if (Math.abs(x) < 2.8 && z < CHAPEL.z + 2) {
    return false;
  }
  if (
    Math.abs(x - CHAPEL.x) < CHAPEL.width / 2 + 5 &&
    Math.abs(z - CHAPEL.z) < CHAPEL.length / 2 + 2.5
  ) {
    return false;
  }
  return true;
}

/**
 * Rows of small grey headstones (rounded and cross tops) with low grave borders.
 * Returns where the candles stand.
 */
export function addGraves(scenery: GeometryBatch): Candle[] {
  const random = seeded(33);
  const candles: Candle[] = [];
  const groundY = CEMETERY.height;
  for (let z = GATE_Z + 4; z <= CEMETERY.maxZ - 3; z += 3.9) {
    for (let x = -18.5; x <= 18.5; x += 3.1) {
      const gx = x + (random() - 0.5) * 0.9;
      const gz = z + (random() - 0.5) * 0.8;
      if (!isFree(gx, gz)) {
        continue;
      }
      const tone = mixColor(
        PALETTE.headstone,
        PALETTE.headstoneLight,
        random() * 0.6,
      );
      const turn = (random() - 0.5) * 0.3;
      const kind = random();
      const stoneY = groundY;
      if (kind < 0.55) {
        // Rounded top.
        scenery.add(new BoxGeometry(0.6, 0.85, 0.16), {
          x: gx,
          y: stoneY + 0.42,
          z: gz,
          turn,
          color: tone,
        });
        const top = new CylinderGeometry(
          0.3,
          0.3,
          0.16,
          8,
          1,
          false,
          0,
          Math.PI,
        );
        top.rotateX(Math.PI / 2);
        top.rotateZ(Math.PI / 2);
        scenery.add(top, { x: gx, y: stoneY + 0.85, z: gz, turn, color: tone });
      } else if (kind < 0.85) {
        // Cross top.
        scenery.add(new BoxGeometry(0.22, 1.2, 0.16), {
          x: gx,
          y: stoneY + 0.6,
          z: gz,
          turn,
          color: tone,
        });
        scenery.add(new BoxGeometry(0.7, 0.2, 0.16), {
          x: gx,
          y: stoneY + 0.9,
          z: gz,
          turn,
          color: tone,
        });
      } else {
        // Low wide stone.
        scenery.add(new BoxGeometry(0.9, 0.55, 0.2), {
          x: gx,
          y: stoneY + 0.27,
          z: gz,
          turn,
          color: tone,
        });
      }
      // Low grave border behind the stone.
      scenery.add(new BoxGeometry(0.85, 0.14, 1.7), {
        x: gx,
        y: stoneY + 0.05,
        z: gz + 1,
        turn,
        color: PALETTE.graveBorder,
      });
      if (random() < 0.78) {
        candles.push({ x: gx + 0.55, y: stoneY + 0.22, z: gz - 0.55 });
      }
    }
  }
  // Candles along the path to the chapel, and by the door.
  for (let z = GATE_Z + 2; z < CHAPEL.z - 6; z += 4) {
    for (const side of [-1, 1]) {
      candles.push({ x: side * 2.2, y: groundY + 0.2, z });
    }
  }
  candles.push(
    { x: -0.9, y: groundY + 0.4, z: CHAPEL.z - CHAPEL.length / 2 - 0.9 },
    { x: 0.9, y: groundY + 0.4, z: CHAPEL.z - CHAPEL.length / 2 - 0.9 },
  );
  return candles;
}

/** Add a tall poplar: a columnar crown on a thin trunk. */
function poplar(
  batch: GeometryBatch,
  x: number,
  z: number,
  size: number,
  tone: number,
): void {
  const y = heightAt(x, z);
  const color = mixColor(PALETTE.foliageDark, PALETTE.foliageLight, tone);
  batch.add(new CylinderGeometry(0.18 * size, 0.28 * size, 2 * size, 5), {
    x,
    y: y + size,
    z,
    color: PALETTE.trunk,
  });
  batch.add(new IcosahedronGeometry(1, 1), {
    x,
    y: y + 5.2 * size,
    z,
    scale: [1.35 * size, 4.8 * size, 1.35 * size],
    turn: tone * 6,
    color,
  });
}

/** Add a round deciduous tree: a short trunk and a faceted crown. */
function roundTree(
  batch: GeometryBatch,
  x: number,
  z: number,
  size: number,
  tone: number,
): void {
  const y = heightAt(x, z);
  const color = mixColor(PALETTE.foliageDark, PALETTE.foliageLight, tone);
  batch.add(new CylinderGeometry(0.25 * size, 0.38 * size, 2.6 * size, 5), {
    x,
    y: y + 1.3 * size,
    z,
    color: PALETTE.trunk,
  });
  batch.add(new IcosahedronGeometry(1, 1), {
    x,
    y: y + 3.9 * size,
    z,
    scale: [2.3 * size, 2.1 * size, 2.3 * size],
    turn: tone * 6,
    color,
  });
}

/** Tall poplars and round trees along the road, by the river, and behind the cemetery. */
export function addTrees(scenery: GeometryBatch): void {
  const random = seeded(5);
  const place = (x: number, z: number): void => {
    // Keep the road and the river free.
    if (Math.abs(x - roadCentre(z)) < 5 || Math.abs(x - riverCentre(z)) < 5) {
      return;
    }
    const tone = random();
    if (random() < 0.5) {
      poplar(scenery, x, z, 0.8 + random() * 0.5, tone);
    } else {
      roundTree(scenery, x, z, 0.8 + random() * 0.55, tone);
    }
  };
  // Along the road, both sides, thinner at the start.
  for (let z = -105; z < 6; z += 5.5) {
    const centre = roadCentre(z);
    place(centre + 13 + random() * 14, z + random() * 3);
    place(centre - 12 - random() * 8, z + 2 + random() * 3);
    if (random() < 0.5) {
      place(centre + 30 + random() * 25, z + random() * 4);
    }
  }
  // Tall poplars at the front corners of the cemetery.
  for (const [x, z] of [
    [-27, 14],
    [27, 13],
    [-30, 26],
    [31, 28],
    [-9.5, 12],
    [12, 11],
  ] as const) {
    poplar(scenery, x, z, 1.25, random());
  }
  // A dark backdrop behind and beside the cemetery.
  for (let i = 0; i < 34; i += 1) {
    const x = -48 + i * 2.9 + (random() - 0.5) * 2;
    const z = CEMETERY.maxZ + 3 + random() * 14;
    if (random() < 0.45) {
      poplar(scenery, x, z, 1 + random() * 0.6, random());
    } else {
      roundTree(scenery, x, z, 1 + random() * 0.6, random());
    }
  }
  for (const side of [-1, 1]) {
    for (let z = 20; z < 62; z += 6.5) {
      roundTree(
        scenery,
        side * (CEMETERY.maxX + 3 + random() * 3),
        z,
        1 + random() * 0.5,
        random(),
      );
    }
  }
  // Fields: a few round bushes and rocks near the road.
  for (let i = 0; i < 26; i += 1) {
    const z = -100 + i * 4.2;
    const x = roadCentre(z) + (i % 2 === 0 ? 8.5 : -8.5) + (random() - 0.5) * 3;
    if (Math.abs(x - riverCentre(z)) < 5) {
      continue;
    }
    scenery.add(new IcosahedronGeometry(1, 0), {
      x,
      y: heightAt(x, z) + 0.2,
      z,
      scale: [
        0.5 + random() * 0.7,
        0.35 + random() * 0.4,
        0.5 + random() * 0.7,
      ],
      turn: random() * 3,
      color: mixColor(PALETTE.foliageDark, PALETTE.foliageLight, random()),
    });
  }
}
