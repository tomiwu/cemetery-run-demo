import { InstancedMesh, Light, Mesh, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { createIntroScene } from "./intro";

function count(root: Object3D): { draws: number; lights: number } {
  let draws = 0;
  let lights = 0;
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof InstancedMesh) {
      draws += 1;
    }
    if (object instanceof Light) {
      lights += 1;
    }
  });
  return { draws, lights };
}

describe("createIntroScene", () => {
  const intro = createIntroScene();

  it("needs at most 120 draw calls", () => {
    expect(count(intro.scene).draws).toBeLessThanOrEqual(120);
  });

  it("has many candle points as instances", () => {
    const candles = intro.scene.getObjectByName("candles");
    expect(candles).toBeInstanceOf(InstancedMesh);
    expect((candles as InstancedMesh).count).toBeGreaterThan(50);
  });

  it("uses few real lights", () => {
    // Sky, sun, fill, one lamp at the gate and the hearse cone. No light per candle.
    expect(count(intro.scene).lights).toBeLessThanOrEqual(7);
  });

  it("is ready at once and moves the camera with the progress", () => {
    const before = intro.camera.position.clone();
    intro.update(0.9);
    expect(intro.camera.position.distanceTo(before)).toBeGreaterThan(1);
  });
});
