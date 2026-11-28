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
import type { Zombie } from "../logic/zombies";
import { createRandom } from "../logic/random";
import { PALETTE } from "./palette";

/**
 * The pop effect (docs/VISUAL_REFERENCE.md, target 4): a hit zombie squashes for
 * `CONFIG.pop.squashSeconds` and disappears. A burst of small leaves and dust pieces flies up and
 * out, turns, and falls in `CONFIG.pop.burstSeconds`. All pieces are instances of one pooled
 * InstancedMesh with one material: nothing is created or destroyed during play. No red, no gore.
 */

/** Colours of the pieces: ochre dust, brown earth and dry leaves. */
export const POP_COLORS = [
  PALETTE.popDust,
  PALETTE.popEarth,
  PALETTE.popLeaf,
] as const;

const GROUND_Y = 0.05;
const START_Y = 0.5;
/** Share of the flight at the end in which a piece shrinks to nothing. */
const FADE_SHARE = 0.15;

/** One flying piece. Positions are in metres, angles in radians. */
export interface Piece {
  x: number;
  z: number;
  /** Start speed: sideways (x, z) and up (y). */
  vx: number;
  vy: number;
  vz: number;
  /** Gravity that lands the piece on the ground exactly at the end of the flight. */
  gravity: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  /** Size of the piece (x, y, z) in metres. A leaf is flat, a dust piece is round. */
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  color: string;
}

/** The pieces of one burst at (x, z). `random` gives numbers in [0, 1). */
export function makeBurst(x: number, z: number, random: () => number): Piece[] {
  const { min, max } = CONFIG.pop.pieces;
  const count = min + Math.floor(random() * (max - min + 1));
  const time = CONFIG.pop.burstSeconds;
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const out = 1.6 + random() * 3;
    const vy = 3 + random() * 3;
    const leaf = i % 3 !== 0;
    const size = 0.2 + random() * 0.14;
    pieces.push({
      x,
      z,
      vx: Math.sin(angle) * out,
      vz: Math.cos(angle) * out,
      vy,
      gravity: (2 * (START_Y + vy * time - GROUND_Y)) / (time * time),
      spinX: (random() - 0.5) * 14,
      spinY: (random() - 0.5) * 14,
      spinZ: (random() - 0.5) * 14,
      // Leaves are flat and long, dust pieces are small and round.
      sizeX: leaf ? size * 1.7 : size,
      sizeY: leaf ? size * 0.25 : size,
      sizeZ: leaf ? size * 1.1 : size,
      color: POP_COLORS[i % POP_COLORS.length] ?? PALETTE.popDust,
    });
  }
  return pieces;
}

/** Position of a piece `age` seconds after the pop. */
export function piecePosition(
  piece: Piece,
  age: number,
): { x: number; y: number; z: number } {
  return {
    x: piece.x + piece.vx * age,
    y: START_Y + piece.vy * age - 0.5 * piece.gravity * age * age,
    z: piece.z + piece.vz * age,
  };
}

/** Scale of a piece at `age`: 1 in flight, down to 0 at the end. */
export function pieceScale(age: number): number {
  const time = CONFIG.pop.burstSeconds;
  if (age < 0 || age >= time) {
    return 0;
  }
  const fadeStart = time * (1 - FADE_SHARE);
  return age < fadeStart ? 1 : (time - age) / (time - fadeStart);
}

/** How much a zombie is squashed at `age` after the hit: 0 (none) to 1 (flat), or null when gone. */
export function squashAt(age: number): number | null {
  const time = CONFIG.pop.squashSeconds;
  return age >= time ? null : Math.max(age, 0) / time;
}

/** A zombie that squashes before it disappears. */
export interface Squashed {
  zombie: Zombie;
  /** 0 (none) to 1 (flat). */
  squash: number;
}

export interface PopLayer {
  group: Group;
  /** A zombie was hit: squash it and start a burst at its place. */
  hit: (zombie: Zombie) => void;
  /** Move the pieces on by the frame time. */
  update: (frameSeconds: number) => void;
  /** The zombies that squash now. The zombie layer draws them. */
  squashed: () => readonly Squashed[];
}

interface Slot {
  piece: Piece | null;
  age: number;
}

export function createPopLayer(seed: number): PopLayer {
  const group = new Group();
  group.name = "pop";
  const size = CONFIG.pop.maxBursts * CONFIG.pop.pieces.max;
  const mesh = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    // One material for all pieces. It is not lit, so the pieces keep their palette colours in
    // the dark. The instance colour sets the tint.
    new MeshBasicMaterial(),
    size,
  );
  mesh.name = "pop-pieces";
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
    mesh.setColorAt(i, color.set(PALETTE.popDust));
  }

  const random = createRandom(seed);
  const squashing: { zombie: Zombie; age: number }[] = [];
  const squashList: Squashed[] = [];
  const matrix = new Matrix4();
  const place = new Vector3();
  const spin = new Quaternion();
  const euler = new Euler();
  const scale = new Vector3();

  function hit(zombie: Zombie): void {
    squashing.push({ zombie, age: 0 });
    const burst = makeBurst(zombie.x, zombie.z, random);
    let next = 0;
    for (const [index, slot] of slots.entries()) {
      const piece = burst[next];
      if (piece === undefined) {
        break;
      }
      if (slot.piece === null) {
        slot.piece = piece;
        slot.age = 0;
        mesh.setColorAt(index, color.set(piece.color));
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
    for (let i = squashing.length - 1; i >= 0; i -= 1) {
      const entry = squashing[i];
      if (entry === undefined) {
        continue;
      }
      entry.age += dt;
      if (squashAt(entry.age) === null) {
        squashing.splice(i, 1);
      }
    }
    squashList.length = 0;
    for (const entry of squashing) {
      squashList.push({
        zombie: entry.zombie,
        squash: squashAt(entry.age) ?? 1,
      });
    }

    let active = false;
    for (const [index, slot] of slots.entries()) {
      const piece = slot.piece;
      if (piece === null) {
        continue;
      }
      slot.age += dt;
      active = true;
      const factor = pieceScale(slot.age);
      if (factor === 0) {
        slot.piece = null;
        mesh.setMatrixAt(index, hidden);
        continue;
      }
      const at = piecePosition(piece, slot.age);
      spin.setFromEuler(
        euler.set(
          piece.spinX * slot.age,
          piece.spinY * slot.age,
          piece.spinZ * slot.age,
        ),
      );
      matrix.compose(
        place.set(at.x, Math.max(at.y, GROUND_Y), at.z),
        spin,
        scale.set(
          piece.sizeX * factor,
          piece.sizeY * factor,
          piece.sizeZ * factor,
        ),
      );
      mesh.setMatrixAt(index, matrix);
    }
    if (active) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return { group, hit, update, squashed: () => squashList };
}
