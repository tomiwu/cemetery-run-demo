import { MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { createFader, fadeToward, occludes } from "./occlusion";

const target = { x: 0, y: 0.8, z: 0 };
const camera = { x: 4.5, y: 8.5, z: 8.5 };
const MARGIN = CONFIG.camera.occlusionMargin;

describe("occludes", () => {
  it("is true for a tall tree on the line from the hearse to the camera", () => {
    const tree = { x: 2.25, z: 4.25, radius: 1, height: 10 };
    expect(occludes(camera, target, tree, MARGIN)).toBe(true);
  });

  it("is false for a tree far from the line", () => {
    const tree = { x: -8, z: 4, radius: 1, height: 10 };
    expect(occludes(camera, target, tree, MARGIN)).toBe(false);
  });

  it("is false for a prop behind the hearse or behind the camera", () => {
    expect(
      occludes(camera, target, { x: -2, z: -4, radius: 1, height: 10 }, MARGIN),
    ).toBe(false);
    expect(
      occludes(camera, target, { x: 9, z: 17, radius: 1, height: 10 }, MARGIN),
    ).toBe(false);
  });

  it("is false for a low prop under the line of sight", () => {
    // Near the camera the line is high: a 1 m post does not hide the hearse there.
    const post = { x: 3.6, z: 6.8, radius: 0.3, height: 1 };
    expect(occludes(camera, target, post, MARGIN)).toBe(false);
    // Close to the hearse the same post is higher than the line.
    const near = { x: 0.5, z: 0.9, radius: 0.3, height: 2 };
    expect(occludes(camera, target, near, MARGIN)).toBe(true);
  });

  it("is false when the camera is above the target", () => {
    expect(
      occludes(
        { ...target },
        target,
        { x: 0, z: 0, radius: 1, height: 9 },
        MARGIN,
      ),
    ).toBe(false);
  });
});

describe("fadeToward", () => {
  it("moves by at most the step and stops at the goal", () => {
    expect(fadeToward(1, 0.3, 0.2)).toBeCloseTo(0.8);
    expect(fadeToward(0.4, 0.3, 0.2)).toBe(0.3);
    expect(fadeToward(0.3, 1, 0.2)).toBeCloseTo(0.5);
    expect(fadeToward(0.9, 1, 0.2)).toBe(1);
  });
});

describe("createFader", () => {
  it("fades a prop in the way to 30 % and back", () => {
    const material = new MeshBasicMaterial();
    const hidden = new MeshBasicMaterial();
    const fader = createFader([
      { x: 2.25, z: 4.25, radius: 1, height: 10, materials: [material] },
      { x: -8, z: 4, radius: 1, height: 10, materials: [hidden] },
    ]);
    for (let i = 0; i < 60; i += 1) {
      fader.update(camera, target, 1 / 60);
    }
    expect(material.opacity).toBeCloseTo(CONFIG.camera.occlusionOpacity);
    expect(hidden.opacity).toBe(1);
    expect(material.transparent).toBe(true);
    // The hearse moves away: the tree comes back.
    for (let i = 0; i < 60; i += 1) {
      fader.update(camera, { x: -30, y: 0.8, z: 0 }, 1 / 60);
    }
    expect(material.opacity).toBe(1);
  });
});
