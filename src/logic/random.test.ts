import { describe, expect, it } from "vitest";
import { seededRandom } from "./random";

describe("seededRandom", () => {
  it("gives the same numbers for the same seed", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    for (let i = 0; i < 20; i += 1) {
      expect(a()).toBe(b());
    }
  });

  it("gives different numbers for different seeds", () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  it("stays in 0 up to 1", () => {
    const random = seededRandom(3);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
