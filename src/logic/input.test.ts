import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { createInput, keyVector, type InputState } from "./input";

const length = (v: { x: number; y: number }): number => Math.hypot(v.x, v.y);

function ready(): InputState {
  return createInput(CONFIG.joystick);
}

describe("pointer joystick", () => {
  it("gives zero before any touch", () => {
    expect(ready().vector()).toEqual({ x: 0, y: 0 });
  });

  it("gives zero inside the dead zone", () => {
    const input = ready();
    input.pointerDown(1, 100, 100);
    input.pointerMove(1, 105, 105);
    expect(input.vector()).toEqual({ x: 0, y: 0 });
  });

  it("gives screen up as +y", () => {
    const input = ready();
    input.pointerDown(1, 100, 300);
    input.pointerMove(1, 100, 200);
    const v = input.vector();
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });

  it("gives screen right as +x", () => {
    const input = ready();
    input.pointerDown(1, 100, 300);
    input.pointerMove(1, 200, 300);
    const v = input.vector();
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });

  it("scales between the dead zone and full deflection", () => {
    const input = ready();
    const { deadZone, fullDeflection } = CONFIG.joystick;
    const mid = (deadZone + fullDeflection) / 2;
    input.pointerDown(1, 0, 0);
    input.pointerMove(1, mid, 0);
    expect(length(input.vector())).toBeCloseTo(0.5);
  });

  it("limits the length to 1", () => {
    const input = ready();
    input.pointerDown(1, 0, 0);
    input.pointerMove(1, 500, -500);
    expect(length(input.vector())).toBeCloseTo(1);
  });

  it("gives zero after release", () => {
    const input = ready();
    input.pointerDown(1, 0, 0);
    input.pointerMove(1, 100, 0);
    input.pointerUp(1);
    expect(input.vector()).toEqual({ x: 0, y: 0 });
    expect(input.origin()).toBeNull();
  });

  it("counts only the first pointer", () => {
    const input = ready();
    input.pointerDown(1, 0, 0);
    input.pointerDown(2, 300, 300);
    input.pointerMove(2, 300, 100);
    expect(input.vector()).toEqual({ x: 0, y: 0 });
    input.pointerUp(2);
    input.pointerMove(1, 100, 0);
    expect(input.vector().x).toBeCloseTo(1);
    expect(input.origin()).toEqual({ x: 0, y: 0 });
  });

  it("ignores a move without a touch", () => {
    const input = ready();
    input.pointerMove(1, 50, 50);
    expect(input.vector()).toEqual({ x: 0, y: 0 });
  });

  it("accepts a new touch after release", () => {
    const input = ready();
    input.pointerDown(1, 0, 0);
    input.pointerUp(1);
    input.pointerDown(2, 10, 10);
    input.pointerMove(2, 10, -90);
    expect(input.vector().y).toBeCloseTo(1);
  });

  it("gives the thumb position", () => {
    const input = ready();
    expect(input.thumb()).toBeNull();
    input.pointerDown(1, 5, 6);
    input.pointerMove(1, 20, 30);
    expect(input.thumb()).toEqual({ x: 20, y: 30 });
  });
});

describe("keys", () => {
  it("map arrows and WASD", () => {
    expect(keyVector(new Set(["ArrowUp"]))).toEqual({ x: 0, y: 1 });
    expect(keyVector(new Set(["w"]))).toEqual({ x: 0, y: 1 });
    expect(keyVector(new Set(["ArrowDown"]))).toEqual({ x: 0, y: -1 });
    expect(keyVector(new Set(["S"]))).toEqual({ x: 0, y: -1 });
    expect(keyVector(new Set(["ArrowLeft"]))).toEqual({ x: -1, y: 0 });
    expect(keyVector(new Set(["a"]))).toEqual({ x: -1, y: 0 });
    expect(keyVector(new Set(["ArrowRight"]))).toEqual({ x: 1, y: 0 });
    expect(keyVector(new Set(["D"]))).toEqual({ x: 1, y: 0 });
  });

  it("normalise a diagonal", () => {
    const v = keyVector(new Set(["ArrowUp", "ArrowRight"]));
    expect(length(v)).toBeCloseTo(1);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeGreaterThan(0);
  });

  it("cancel opposite keys", () => {
    expect(keyVector(new Set(["ArrowLeft", "ArrowRight"]))).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("ignore other keys", () => {
    expect(keyVector(new Set(["q", "Enter"]))).toEqual({ x: 0, y: 0 });
  });

  it("combine with the pointer: the larger vector wins", () => {
    const input = ready();
    input.keyDown("ArrowLeft");
    expect(input.vector()).toEqual({ x: -1, y: 0 });
    input.pointerDown(1, 0, 0);
    input.pointerMove(1, 0, 40);
    // The pointer is about 0.5 long: the key wins.
    expect(input.vector()).toEqual({ x: -1, y: 0 });
    input.keyUp("ArrowLeft");
    expect(input.vector().y).toBeLessThan(0);
  });

  it("ignore a key up for a key that is not down", () => {
    const input = ready();
    input.keyUp("w");
    expect(input.vector()).toEqual({ x: 0, y: 0 });
  });

  it("clear all keys and the pointer on reset", () => {
    const input = ready();
    input.keyDown("w");
    input.pointerDown(1, 0, 0);
    input.reset();
    expect(input.vector()).toEqual({ x: 0, y: 0 });
    expect(input.origin()).toBeNull();
  });
});
