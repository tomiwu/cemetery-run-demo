import {
  BufferGeometry,
  BoxGeometry,
  ConeGeometry,
  TorusGeometry,
} from "three";
import { GeometryBatch, mixColor, seeded } from "./geometry";
import { PALETTE } from "./palette";
import { CEMETERY, GATE_Z } from "./terrain";

/**
 * The cemetery gate and the low brick wall: a black wrought-iron double gate (open) between
 * two red-brick pillars with small lanterns. Built from simple shapes, coloured with the palette.
 */

const PILLAR_X = 2.9;
const PILLAR_SIZE = 0.95;
const PILLAR_HEIGHT = 2.6;
const LEAF_LENGTH = 2.4;
const LEAF_HEIGHT = 1.85;
const WALL_HEIGHT = 1.15;
const WALL_THICKNESS = 0.55;
const OPEN_ANGLE = 1.15;

function leaf(batch: GeometryBatch, side: number, groundY: number): void {
  // Build the leaf in a frame that starts at the hinge and runs along local +x.
  const hingeX = side * (PILLAR_X - PILLAR_SIZE / 2);
  const turn = side > 0 ? Math.PI + OPEN_ANGLE : -OPEN_ANGLE;
  const add = (
    geometry: BufferGeometry,
    localX: number,
    localY: number,
  ): void => {
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    batch.add(geometry, {
      x: hingeX + localX * cos,
      y: groundY + localY,
      z: GATE_Z - localX * sin,
      turn,
      color: PALETTE.iron,
    });
  };
  // Frame: two posts, three rails.
  add(new BoxGeometry(0.07, LEAF_HEIGHT, 0.07), 0.04, LEAF_HEIGHT / 2);
  add(
    new BoxGeometry(0.07, LEAF_HEIGHT, 0.07),
    LEAF_LENGTH - 0.04,
    LEAF_HEIGHT / 2,
  );
  for (const y of [0.25, 1.0, LEAF_HEIGHT - 0.12]) {
    add(new BoxGeometry(LEAF_LENGTH, 0.06, 0.05), LEAF_LENGTH / 2, y);
  }
  // Bars with spear tips.
  const bars = 11;
  for (let i = 1; i < bars; i += 1) {
    const x = (i * LEAF_LENGTH) / bars;
    add(new BoxGeometry(0.035, LEAF_HEIGHT - 0.15, 0.035), x, LEAF_HEIGHT / 2);
    add(new ConeGeometry(0.05, 0.16, 4), x, LEAF_HEIGHT + 0.02);
  }
  // A ring in the middle of the leaf: the wrought-iron scroll.
  const ring = new TorusGeometry(0.3, 0.022, 5, 12);
  add(ring, LEAF_LENGTH / 2, 1.0);
}

function pillar(
  scenery: GeometryBatch,
  glow: GeometryBatch,
  x: number,
  groundY: number,
): void {
  scenery.add(new BoxGeometry(PILLAR_SIZE, PILLAR_HEIGHT + 0.6, PILLAR_SIZE), {
    x,
    y: groundY + (PILLAR_HEIGHT - 0.6) / 2,
    z: GATE_Z,
    color: PALETTE.brick,
  });
  // Stone base and cap.
  scenery.add(new BoxGeometry(PILLAR_SIZE + 0.2, 0.3, PILLAR_SIZE + 0.2), {
    x,
    y: groundY + 0.15,
    z: GATE_Z,
    color: PALETTE.stoneCap,
  });
  scenery.add(new BoxGeometry(PILLAR_SIZE + 0.25, 0.2, PILLAR_SIZE + 0.25), {
    x,
    y: groundY + PILLAR_HEIGHT + 0.1,
    z: GATE_Z,
    color: PALETTE.stoneCap,
  });
  // Small lantern: iron foot, warm glass, iron roof.
  const top = groundY + PILLAR_HEIGHT + 0.2;
  scenery.add(new BoxGeometry(0.46, 0.08, 0.46), {
    x,
    y: top + 0.04,
    z: GATE_Z,
    color: PALETTE.iron,
  });
  scenery.add(new ConeGeometry(0.34, 0.26, 4), {
    x,
    y: top + 0.7,
    z: GATE_Z,
    turn: Math.PI / 4,
    color: PALETTE.iron,
  });
  glow.add(new BoxGeometry(0.34, 0.5, 0.34), {
    x,
    y: top + 0.33,
    z: GATE_Z,
    color: PALETTE.headlight,
  });
}

/** The gate: pillars, lanterns and two open iron leaves. */
export function addGate(scenery: GeometryBatch, glow: GeometryBatch): void {
  const groundY = CEMETERY.height;
  for (const side of [-1, 1]) {
    pillar(scenery, glow, side * PILLAR_X, groundY);
    leaf(scenery, side, groundY);
  }
}

/** The low red-brick wall around the cemetery. The gate is a gap in the front wall. */
export function addWalls(scenery: GeometryBatch): void {
  const random = seeded(21);
  const groundY = CEMETERY.height;
  const segment = (
    x: number,
    z: number,
    length: number,
    alongX: boolean,
  ): void => {
    const color = mixColor(PALETTE.brickDark, PALETTE.brick, random());
    scenery.add(
      new BoxGeometry(
        alongX ? length : WALL_THICKNESS,
        WALL_HEIGHT + 1,
        alongX ? WALL_THICKNESS : length,
      ),
      { x, y: groundY + WALL_HEIGHT / 2 - 0.5, z, color },
    );
    // A darker cap stone on the top.
    scenery.add(
      new BoxGeometry(
        alongX ? length : WALL_THICKNESS + 0.12,
        0.1,
        alongX ? WALL_THICKNESS + 0.12 : length,
      ),
      { x, y: groundY + WALL_HEIGHT + 0.03, z, color: PALETTE.brickCap },
    );
  };
  const step = 3;
  const gap = PILLAR_X + PILLAR_SIZE / 2;
  for (const side of [-1, 1]) {
    for (let x = gap; x < CEMETERY.maxX; x += step) {
      const length = Math.min(step, CEMETERY.maxX - x);
      segment(side * (x + length / 2), GATE_Z, length, true);
    }
    for (let z = GATE_Z; z < CEMETERY.maxZ; z += step) {
      const length = Math.min(step, CEMETERY.maxZ - z);
      segment(side * CEMETERY.maxX, z + length / 2, length, false);
    }
  }
  for (let x = -CEMETERY.maxX; x < CEMETERY.maxX; x += step) {
    segment(x + step / 2, CEMETERY.maxZ, step, true);
  }
  // Brick posts along the front wall.
  for (const x of [-12, -6, 6, 12, -CEMETERY.maxX, CEMETERY.maxX]) {
    scenery.add(new BoxGeometry(0.75, WALL_HEIGHT + 0.5, 0.75), {
      x,
      y: groundY + (WALL_HEIGHT + 0.5) / 2 - 0.1,
      z: GATE_Z,
      color: PALETTE.brick,
    });
  }
}
