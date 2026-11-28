import { describe, expect, it } from "vitest";
import { Color, SRGBColorSpace } from "three";
import { CONFIG } from "../config";
import { createRandom } from "../logic/random";
import {
  POP_COLORS,
  makeBurst,
  pieceScale,
  piecePosition,
  squashAt,
} from "./pop";

describe("makeBurst", () => {
  it("makes 14 to 20 pieces", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const count = makeBurst(0, 0, createRandom(seed)).length;
      expect(count).toBeGreaterThanOrEqual(CONFIG.pop.pieces.min);
      expect(count).toBeLessThanOrEqual(CONFIG.pop.pieces.max);
    }
  });

  it("uses only dust, earth and leaf colours, and none is red", () => {
    const burst = makeBurst(0, 0, createRandom(3));
    const hsl = { h: 0, s: 0, l: 0 };
    for (const piece of burst) {
      expect(POP_COLORS).toContain(piece.color);
      new Color(piece.color).getHSL(hsl, SRGBColorSpace);
      // Hue in turns: red is near 0 or 1. Ochre, brown and leaf are orange to yellow.
      expect(hsl.h).toBeGreaterThan(0.06);
      expect(hsl.h).toBeLessThan(0.2);
    }
    expect(new Set(burst.map((piece) => piece.color)).size).toBe(3);
  });

  it("flies up and out, and lands at the end of the burst time", () => {
    const [piece] = makeBurst(2, -3, createRandom(5));
    if (piece === undefined) {
      throw new Error("No piece.");
    }
    const mid = piecePosition(piece, CONFIG.pop.burstSeconds / 3);
    expect(mid.y).toBeGreaterThan(0.5);
    expect(Math.hypot(mid.x - 2, mid.z + 3)).toBeGreaterThan(0.3);
    const end = piecePosition(piece, CONFIG.pop.burstSeconds);
    expect(end.y).toBeCloseTo(0.05, 6);
  });

  it("gives the same burst for the same seed", () => {
    expect(makeBurst(1, 1, createRandom(9))).toEqual(
      makeBurst(1, 1, createRandom(9)),
    );
  });
});

describe("pieceScale", () => {
  it("is 1 in flight and 0 at the end", () => {
    expect(pieceScale(0)).toBe(1);
    expect(pieceScale(CONFIG.pop.burstSeconds * 0.5)).toBe(1);
    expect(pieceScale(CONFIG.pop.burstSeconds * 0.95)).toBeGreaterThan(0);
    expect(pieceScale(CONFIG.pop.burstSeconds * 0.95)).toBeLessThan(1);
    expect(pieceScale(CONFIG.pop.burstSeconds)).toBe(0);
  });
});

describe("squashAt", () => {
  it("goes from 0 to 1 in the squash time, then the zombie is gone", () => {
    expect(squashAt(0)).toBe(0);
    expect(squashAt(CONFIG.pop.squashSeconds / 2)).toBeCloseTo(0.5, 9);
    expect(squashAt(CONFIG.pop.squashSeconds)).toBeNull();
  });
});
