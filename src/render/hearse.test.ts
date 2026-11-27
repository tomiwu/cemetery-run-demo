import {
  Box3,
  Mesh,
  Vector3,
  type BufferGeometry,
  type MeshStandardMaterial,
  type Object3D,
} from "three";
import { describe, expect, it } from "vitest";
import { buildHearse } from "./hearse";

function triangles(root: Object3D): number {
  let total = 0;
  root.traverse((object) => {
    if (object instanceof Mesh) {
      const geometry = object.geometry as BufferGeometry;
      const count =
        geometry.index?.count ?? geometry.getAttribute("position").count;
      total += count / 3;
    }
  });
  return total;
}

describe("buildHearse", () => {
  const hearse = buildHearse();

  it("uses fewer than 3000 triangles", () => {
    expect(triangles(hearse.group)).toBeLessThan(3000);
  });

  it("is about 5.4 m long and points to +z", () => {
    const size = new Box3().setFromObject(hearse.group).getSize(new Vector3());
    expect(size.z).toBeGreaterThan(5.2);
    expect(size.z).toBeLessThan(5.6);
    expect(size.x).toBeLessThan(size.z);
  });

  it("has warm headlights at the front and red lights at the back", () => {
    const front = hearse.group.getObjectByName("headlight");
    const rear = hearse.group.getObjectByName("taillight");
    expect(front?.position.z).toBeGreaterThan(0);
    expect(rear?.position.z).toBeLessThan(0);
  });

  it("has 4 wheels", () => {
    expect(hearse.wheels).toHaveLength(4);
  });

  it("has no text, no badge and no logo", () => {
    hearse.group.traverse((object) => {
      expect(object.name).not.toMatch(/badge|logo|text|label|emblem/i);
      expect(object.type).not.toBe("Sprite");
      if (object instanceof Mesh) {
        const material = object.material as MeshStandardMaterial;
        expect(material.map).toBeNull();
      }
    });
  });

  it("builds a new model on each call", () => {
    expect(buildHearse().group).not.toBe(hearse.group);
  });
});

describe("buildHearse look", () => {
  const hearse = buildHearse();

  it("has a glossy black body with a sky reflection", () => {
    const body = hearse.group.getObjectByName("body") as Mesh;
    const paint = body.material as MeshStandardMaterial;
    expect(paint.roughness).toBeCloseTo(0.25, 1);
    expect(paint.metalness).toBeCloseTo(0.6, 1);
    expect(paint.envMap).not.toBeNull();
    expect(paint.color.getHexString()).toBe("0e0e0f");
  });

  it("has one spot light for the headlight cone", () => {
    let spots = 0;
    hearse.group.traverse((object) => {
      if (object.type === "SpotLight") {
        spots += 1;
      }
    });
    expect(spots).toBe(1);
  });

  it("has a long high roof: tall at the rear, with a low bonnet", () => {
    const box = new Box3().setFromObject(hearse.group);
    expect(box.max.y).toBeGreaterThan(1.55);
    expect(box.max.y).toBeLessThan(1.7);
    const bonnet = new Box3().setFromObject(
      hearse.group.getObjectByName("headlight") as Object3D,
    );
    expect(bonnet.max.y).toBeLessThan(0.9);
  });

  it("has cream curtains and chrome", () => {
    expect(hearse.group.getObjectByName("curtain")).toBeDefined();
    expect(hearse.group.getObjectByName("chrome")).toBeDefined();
  });
});
