import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { createRandom } from "../logic/random";
import {
  breakPosition,
  breakScale,
  createBreakLayer,
  DUST_COLORS,
  makeBreak,
  makePuff,
  STONE_COLORS,
} from "./graveBreak";

const G = CONFIG.graveHit;

describe("makeBreak", () => {
  it("makes 6 to 10 stone pieces and the dust, in the palette and not red", () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const pieces = makeBreak(1, 2, createRandom(seed));
      const stones = pieces.filter((item) =>
        (STONE_COLORS as readonly string[]).includes(item.color),
      );
      const dust = pieces.filter((item) =>
        (DUST_COLORS as readonly string[]).includes(item.color),
      );
      expect(stones.length).toBeGreaterThanOrEqual(G.stonePieces.min);
      expect(stones.length).toBeLessThanOrEqual(G.stonePieces.max);
      expect(dust).toHaveLength(G.dustPieces);
      expect(stones.length + dust.length).toBe(pieces.length);
    }
  });

  it("uses only the four colours of the brief", () => {
    const colors = new Set(
      makeBreak(0, 0, createRandom(3)).map((p) => p.color),
    );
    for (const color of colors) {
      expect(["#B9B4AA", "#CFC6B4", "#B5A993", "#6B4E2E"]).toContain(color);
    }
  });

  it("lands every piece on the ground at the end of the flight", () => {
    for (const item of makeBreak(4, -3, createRandom(5))) {
      expect(breakPosition(item, 0).y).toBeCloseTo(0.4);
      expect(breakPosition(item, G.flightSeconds).y).toBeCloseTo(0.05, 6);
      // It goes up first.
      expect(breakPosition(item, 0.15).y).toBeGreaterThan(0.4);
    }
  });
});

describe("makePuff", () => {
  it("is a small dust puff", () => {
    const puff = makePuff(0, 0, createRandom(2));
    expect(puff).toHaveLength(CONFIG.collision.puffPieces);
    for (const item of puff) {
      expect((DUST_COLORS as readonly string[]).includes(item.color)).toBe(
        true,
      );
      expect(item.size).toBeLessThan(0.3);
    }
  });
});

describe("breakScale", () => {
  it("is 1 in flight, falls to 0 at the end and is 0 outside", () => {
    expect(breakScale(0.1)).toBe(1);
    expect(breakScale(G.flightSeconds * 0.95)).toBeLessThan(1);
    expect(breakScale(G.flightSeconds)).toBe(0);
    expect(breakScale(-1)).toBe(0);
  });
});

describe("createBreakLayer", () => {
  it("uses one pooled instanced mesh and frees the slots after the flight", () => {
    const layer = createBreakLayer(7);
    expect(layer.group.children).toHaveLength(1);
    expect(layer.active()).toBe(0);
    layer.breakAt(1, 1);
    expect(layer.active()).toBeGreaterThanOrEqual(
      G.stonePieces.min + G.dustPieces,
    );
    for (let i = 0; i < 3; i += 1) {
      layer.update(0.1);
    }
    expect(layer.active()).toBeGreaterThan(0);
    for (let i = 0; i < 4; i += 1) {
      layer.update(0.1);
    }
    expect(layer.active()).toBe(0);
  });

  it("drops pieces when the pool is full and never grows", () => {
    const layer = createBreakLayer(7);
    const mesh = layer.group.children[0];
    for (let i = 0; i < G.maxBursts * 3; i += 1) {
      layer.breakAt(i, 0);
    }
    expect(layer.active()).toBeLessThanOrEqual(
      G.maxBursts * (G.stonePieces.max + G.dustPieces),
    );
    expect(layer.group.children[0]).toBe(mesh);
    layer.puffAt(0, 0);
  });
});
