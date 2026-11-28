import {
  AdditiveBlending,
  Color,
  DataTexture,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
} from "three";

/** A small soft round alpha texture (64 px). The alpha falls smoothly from the middle. */
export function radialTexture(power = 2): DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const distance = Math.min(1, Math.hypot(dx, dy) * 2);
      const alpha = Math.pow(1 - distance, power);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export interface Spot {
  x: number;
  y: number;
  z: number;
  /** Diameter of the round patch in metres. */
  size: number;
}

export interface PatchOptions {
  color: string;
  opacity: number;
  /** Warm light adds to the ground. Fog and shade blend over it. */
  additive: boolean;
  power?: number;
}

/**
 * Flat soft round patches on the ground in one draw call: warm light pools (additive)
 * or low fog (normal blending). They are decals: they do not light anything.
 */
export function patches(
  spots: readonly Spot[],
  options: PatchOptions,
): InstancedMesh {
  const geometry = new PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({
    map: radialTexture(options.power ?? 2),
    color: new Color(options.color),
    transparent: true,
    opacity: options.opacity,
    depthWrite: false,
    blending: options.additive ? AdditiveBlending : NormalBlending,
  });
  const mesh = new InstancedMesh(geometry, material, spots.length);
  const matrix = new Matrix4();
  spots.forEach((spot, index) => {
    matrix.makeScale(spot.size, 1, spot.size);
    matrix.setPosition(spot.x, spot.y, spot.z);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return mesh;
}
