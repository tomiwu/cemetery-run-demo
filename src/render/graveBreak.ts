import {
  Color,
  DynamicDrawUsage,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import { CONFIG } from "../config";
import { createRandom } from "../logic/random";
import { PALETTE } from "./palette";

/**
 * Grave break and bump dust (PRD D22). A broken grave throws 6 to 10 cartoon stone pieces and some
 * dust up. They fall in `CONFIG.graveHit.flightSeconds`. A wall bump gives a small dust puff.
 * All pieces are instances of one pooled InstancedMesh with one material: nothing is created or
 * destroyed during play. The colours are stone grey and beige, dust ochre and earth brown (no red).
 */

export const STONE_COLORS = [PALETTE.stoneGrey, PALETTE.stoneBeige] as const;
export const DUST_COLORS = [PALETTE.popDust, PALETTE.popEarth] as const;

const GROUND_Y = 0.05;
const START_Y = 0.4;
/** Share of the flight at the end in which a piece shrinks to nothing. */
const FADE_SHARE = 0.2;

export interface BreakPiece {
  x: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Gravity that lands the piece on the ground exactly at the end of the flight. */
  gravity: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  size: number;
  color: string;
}

function piece(
  x: number,
  z: number,
  random: () => number,
  kind: { out: number; up: number; size: number; colors: readonly string[] },
  index: number,
): BreakPiece {
  const time = CONFIG.graveHit.flightSeconds;
  const angle = random() * Math.PI * 2;
  const out = kind.out * (0.5 + random());
  const vy = kind.up * (0.7 + random() * 0.6);
  return {
    x,
    z,
    vx: Math.sin(angle) * out,
    vz: Math.cos(angle) * out,
    vy,
    gravity: (2 * (START_Y + vy * time - GROUND_Y)) / (time * time),
    spinX: (random() - 0.5) * 12,
    spinY: (random() - 0.5) * 12,
    spinZ: (random() - 0.5) * 12,
    size: kind.size * (0.7 + random() * 0.6),
    color: kind.colors[index % kind.colors.length] ?? PALETTE.stoneGrey,
  };
}

/** The pieces of one grave break at (x, z): 6 to 10 stone pieces and the dust. */
export function makeBreak(
  x: number,
  z: number,
  random: () => number,
): BreakPiece[] {
  const { min, max } = CONFIG.graveHit.stonePieces;
  const stones = min + Math.floor(random() * (max - min + 1));
  const pieces: BreakPiece[] = [];
  for (let i = 0; i < stones; i += 1) {
    pieces.push(
      piece(
        x,
        z,
        random,
        { out: 2.2, up: 3.6, size: 0.25, colors: STONE_COLORS },
        i,
      ),
    );
  }
  for (let i = 0; i < CONFIG.graveHit.dustPieces; i += 1) {
    pieces.push(
      piece(
        x,
        z,
        random,
        { out: 1.6, up: 2.2, size: 0.18, colors: DUST_COLORS },
        i,
      ),
    );
  }
  return pieces;
}

/** A small dust puff of a bump at (x, z). */
export function makePuff(
  x: number,
  z: number,
  random: () => number,
): BreakPiece[] {
  const pieces: BreakPiece[] = [];
  for (let i = 0; i < CONFIG.collision.puffPieces; i += 1) {
    pieces.push(
      piece(
        x,
        z,
        random,
        { out: 1.2, up: 1.8, size: 0.1, colors: DUST_COLORS },
        i,
      ),
    );
  }
  return pieces;
}

/** Position of a piece `age` seconds after the break. */
export function breakPosition(
  item: BreakPiece,
  age: number,
): { x: number; y: number; z: number } {
  return {
    x: item.x + item.vx * age,
    y: START_Y + item.vy * age - 0.5 * item.gravity * age * age,
    z: item.z + item.vz * age,
  };
}

/** Scale of a piece at `age`: 1 in flight, down to 0 at the end. */
export function breakScale(age: number): number {
  const time = CONFIG.graveHit.flightSeconds;
  if (age < 0 || age >= time) {
    return 0;
  }
  const fadeStart = time * (1 - FADE_SHARE);
  return age < fadeStart ? 1 : (time - age) / (time - fadeStart);
}

export interface BreakLayer {
  group: Group;
  /** A grave broke at (x, z): stone pieces and dust fly. */
  breakAt: (x: number, z: number) => void;
  /** A bump at (x, z): a small dust puff. */
  puffAt: (x: number, z: number) => void;
  /** Move the pieces on by the frame time. */
  update: (frameSeconds: number) => void;
  /** Number of pieces in flight (for tests). */
  active: () => number;
}

interface Slot {
  piece: BreakPiece | null;
  age: number;
}

export function createBreakLayer(seed: number): BreakLayer {
  const group = new Group();
  group.name = "grave-break";
  const per = CONFIG.graveHit.stonePieces.max + CONFIG.graveHit.dustPieces;
  const size = CONFIG.graveHit.maxBursts * per;
  const mesh = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    // Not lit, so the pieces keep their palette colours in the dark.
    new MeshBasicMaterial(),
    size,
  );
  mesh.name = "grave-break-pieces";
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  group.add(mesh);

  const slots: Slot[] = Array.from({ length: size }, () => ({
    piece: null,
    age: 0,
  }));
  const hidden = new Matrix4().makeScale(0, 0, 0);
  const color = new Color();
  for (let i = 0; i < size; i += 1) {
    mesh.setMatrixAt(i, hidden);
    mesh.setColorAt(i, color.set(PALETTE.stoneGrey));
  }

  const random = createRandom(seed);
  const matrix = new Matrix4();
  const place = new Vector3();
  const spin = new Quaternion();
  const euler = new Euler();
  const scale = new Vector3();

  function start(pieces: readonly BreakPiece[]): void {
    let next = 0;
    for (const [index, slot] of slots.entries()) {
      const item = pieces[next];
      if (item === undefined) {
        break;
      }
      if (slot.piece === null) {
        slot.piece = item;
        slot.age = 0;
        mesh.setColorAt(index, color.set(item.color));
        next += 1;
      }
    }
    // If the pool is full, the rest of the pieces are dropped.
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  function update(frameSeconds: number): void {
    const dt = Math.min(Math.max(frameSeconds, 0), 0.1);
    let moved = false;
    for (const [index, slot] of slots.entries()) {
      const item = slot.piece;
      if (item === null) {
        continue;
      }
      slot.age += dt;
      moved = true;
      const factor = breakScale(slot.age);
      if (factor === 0) {
        slot.piece = null;
        mesh.setMatrixAt(index, hidden);
        continue;
      }
      const at = breakPosition(item, slot.age);
      spin.setFromEuler(
        euler.set(
          item.spinX * slot.age,
          item.spinY * slot.age,
          item.spinZ * slot.age,
        ),
      );
      matrix.compose(
        place.set(at.x, Math.max(at.y, GROUND_Y), at.z),
        spin,
        scale.set(
          item.size * factor,
          item.size * factor * 0.8,
          item.size * factor,
        ),
      );
      mesh.setMatrixAt(index, matrix);
    }
    if (moved) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return {
    group,
    breakAt: (x, z) => {
      start(makeBreak(x, z, random));
    },
    puffAt: (x, z) => {
      start(makePuff(x, z, random));
    },
    update,
    active: () => slots.filter((slot) => slot.piece !== null).length,
  };
}
