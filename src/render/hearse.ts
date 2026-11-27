import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  EquirectangularReflectionMapping,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  RGBAFormat,
  Shape,
  SpotLight,
  SRGBColorSpace,
  type Texture,
} from "three";
import { GeometryBatch, mergePlain } from "./geometry";
import { PALETTE } from "./palette";

/**
 * The hearse is built in code: a long black estate car (VISUAL_REFERENCE.md, "Hearse").
 * Long low bonnet, raked windscreen, long flat roof, tall rear with a near-vertical tailgate.
 * No badge, no logo, no text, blank plate. It is about 5.4 m long, 1.9 m wide, and it
 * points to +z. The origin is on the ground, in the middle.
 */

export interface HearseModel {
  group: Group;
  /** The four wheel groups. Turn `rotation.x` to spin a wheel. */
  wheels: Group[];
  wheelRadius: number;
  /** The one real light of the hearse: a warm cone on the road. */
  headlights: SpotLight;
}

type Point = readonly [number, number];

const HALF_LENGTH = 2.66;
const WIDTH = 1.9;
const HALF_WIDTH = WIDTH / 2;
const BEVEL = 0.03;
const WHEEL_RADIUS = 0.36;
const WHEEL_X = 0.87;
const FRONT_AXLE = 1.75;
const REAR_AXLE = -1.45;
const GLASS_OFFSET = 0.012;
const CHROME_OFFSET = 0.017;
const CURTAIN_OFFSET = 0.02;
const CURTAIN_FOLD = 0.035;
const FRONT_FACE = HALF_LENGTH + BEVEL;

/** Side profile of the body as (z, y) points. */
const BODY_PROFILE: readonly Point[] = [
  [-HALF_LENGTH, 0.42],
  [HALF_LENGTH, 0.42],
  [HALF_LENGTH, 0.78],
  [HALF_LENGTH - 0.12, 0.9],
  [1.35, 0.98],
  [0.5, 1.5],
  [-0.1, 1.53],
  [-1.2, 1.58],
  [-HALF_LENGTH + 0.08, 1.59],
  [-HALF_LENGTH, 1.5],
];

/** Side windows as (z, y) points: front door, rear door, long rear window. */
const FRONT_WINDOW: readonly Point[] = [
  [0.99, 1.12],
  [0.4, 1.47],
  [-0.5, 1.48],
  [-0.5, 1.12],
];
const REAR_DOOR_WINDOW: readonly Point[] = [
  [-0.6, 1.12],
  [-0.6, 1.49],
  [-1.38, 1.5],
  [-1.38, 1.12],
];
const LONG_WINDOW: readonly Point[] = [
  [-1.5, 1.12],
  [-1.5, 1.5],
  [-2.57, 1.51],
  [-2.57, 1.12],
];
const SIDE_WINDOWS = [FRONT_WINDOW, REAR_DOOR_WINDOW, LONG_WINDOW] as const;

/** The curved "S" line in the rear panel, below the long window. */
const SWOOSH: readonly Point[] = [
  [-1.35, 1.06],
  [-1.65, 1.0],
  [-1.95, 0.97],
  [-2.25, 1.0],
  [-2.45, 1.07],
  [-2.58, 1.2],
];

/** Curtain panels in the long window, gathered at both ends: [z from, z to]. */
const CURTAIN_PANELS: readonly Point[] = [
  [-1.52, -1.95],
  [-2.1, -2.55],
];
const CURTAIN_FOLDS = 5;

let skyTexture: Texture | undefined;

/**
 * A small sky gradient (amber low, mauve, blue-grey high) used as reflection map.
 * The glossy paint shows the sky on the roof and the bonnet.
 */
function skyReflection(): Texture {
  if (skyTexture !== undefined) {
    return skyTexture;
  }
  const rows = 16;
  const columns = 4;
  const stops: readonly (readonly [number, string])[] = [
    [-1, "#141210"],
    [-0.05, "#1c1815"],
    [0.02, "#9A7A62"],
    [0.25, "#8A7078"],
    [0.55, "#7A7690"],
    [1, "#6a7088"],
  ];
  const data = new Uint8Array(rows * columns * 4);
  const mixed = new Color();
  const low = new Color();
  const high = new Color();
  for (let row = 0; row < rows; row += 1) {
    // Row 0 is the bottom of the image.
    const height = -1 + (2 * (row + 0.5)) / rows;
    let index = 0;
    while (index < stops.length - 2 && height > (stops[index + 1]?.[0] ?? 1)) {
      index += 1;
    }
    const from = stops[index] ?? stops[0];
    const to = stops[index + 1] ?? stops[stops.length - 1];
    if (from === undefined || to === undefined) {
      throw new Error("The sky reflection needs colour stops.");
    }
    const k = Math.min(1, Math.max(0, (height - from[0]) / (to[0] - from[0])));
    mixed.copy(low.set(from[1])).lerp(high.set(to[1]), k);
    for (let column = 0; column < columns; column += 1) {
      const offset = (row * columns + column) * 4;
      // Store sRGB bytes: the texture is tagged as sRGB.
      const srgb = mixed.clone().convertLinearToSRGB();
      data[offset] = Math.round(srgb.r * 255);
      data[offset + 1] = Math.round(srgb.g * 255);
      data[offset + 2] = Math.round(srgb.b * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(data, columns, rows, RGBAFormat);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  skyTexture = texture;
  return texture;
}

function bodyGeometry(): BufferGeometry {
  const shape = new Shape();
  BODY_PROFILE.forEach(([z, y], index) => {
    if (index === 0) {
      shape.moveTo(z, y);
    } else {
      shape.lineTo(z, y);
    }
  });
  const depth = WIDTH - 2 * BEVEL;
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: BEVEL,
    bevelThickness: BEVEL,
    bevelSegments: 1,
    steps: 1,
  });
  // Shape x -> world z, extrusion -> world -x, then centre on x.
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(depth / 2, 0, 0);
  return geometry;
}

/** A flat polygon in the side plane x = `x` (a fan of triangles). */
function sideWindowGeometry(
  points: readonly Point[],
  x: number,
): BufferGeometry {
  const positions: number[] = [];
  const [a, ...rest] = points;
  if (a === undefined) {
    throw new Error("A window needs points.");
  }
  for (let i = 0; i + 1 < rest.length; i += 1) {
    const b = rest[i];
    const c = rest[i + 1];
    if (b !== undefined && c !== undefined) {
      positions.push(x, a[1], a[0], x, b[1], b[0], x, c[1], c[0]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A thin flat line (two triangles per edge) in the side plane x = `x`. */
function lineGeometry(
  points: readonly Point[],
  x: number,
  width: number,
  closed: boolean,
): BufferGeometry {
  const positions: number[] = [];
  const edges = closed ? points.length : points.length - 1;
  for (let i = 0; i < edges; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a === undefined || b === undefined) {
      continue;
    }
    const dz = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dz, dy) || 1;
    // Perpendicular, in (z, y).
    const pz = (-dy / length) * (width / 2);
    const py = (dz / length) * (width / 2);
    const p0: Point = [a[0] + pz, a[1] + py];
    const p1: Point = [a[0] - pz, a[1] - py];
    const p2: Point = [b[0] - pz, b[1] - py];
    const p3: Point = [b[0] + pz, b[1] + py];
    for (const p of [p0, p1, p2, p0, p2, p3]) {
      positions.push(x, p[1], p[0]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Pleated curtain: a zigzag strip with vertical folds, on the side `side` (-1 or 1). */
function curtainGeometry(
  zFrom: number,
  zTo: number,
  side: number,
): BufferGeometry {
  const columns = CURTAIN_FOLDS * 2 + 1;
  const bottom = 1.13;
  const top = 1.49;
  const positions: number[] = [];
  const column = (i: number): [number, number] => [
    zFrom + ((zTo - zFrom) * i) / (columns - 1),
    side * (HALF_WIDTH + CURTAIN_OFFSET + (i % 2 === 0 ? 0 : CURTAIN_FOLD)),
  ];
  for (let i = 0; i + 1 < columns; i += 1) {
    const [z0, x0] = column(i);
    const [z1, x1] = column(i + 1);
    positions.push(
      x0,
      bottom,
      z0,
      x1,
      bottom,
      z1,
      x1,
      top,
      z1,
      x0,
      bottom,
      z0,
      x1,
      top,
      z1,
      x0,
      top,
      z0,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The windscreen: a slanted quad across the car, on the raked line of the body. */
function windscreenGeometry(): BufferGeometry {
  const base = BODY_PROFILE[4];
  const roof = BODY_PROFILE[5];
  if (base === undefined || roof === undefined) {
    throw new Error("The body profile is too short.");
  }
  const dz = roof[0] - base[0];
  const dy = roof[1] - base[1];
  const length = Math.hypot(dz, dy);
  // Normal of the raked line, pointing up and to the front.
  const nz = dy / length;
  const ny = -dz / length;
  const lift = BEVEL + GLASS_OFFSET;
  const at = (t: number): Point => [
    base[0] + dz * t + nz * lift,
    base[1] + dy * t + ny * lift,
  ];
  const bottom = at(0.12);
  const top = at(0.95);
  const wideBottom = HALF_WIDTH - 0.06;
  const wideTop = HALF_WIDTH - 0.12;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        ...[-wideBottom, bottom[1], bottom[0]],
        ...[wideBottom, bottom[1], bottom[0]],
        ...[wideTop, top[1], top[0]],
        ...[-wideBottom, bottom[1], bottom[0]],
        ...[wideTop, top[1], top[0]],
        ...[-wideTop, top[1], top[0]],
      ],
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** One wheel: black tyre, and a silver 5-spoke alloy on a dark disc. */
function wheel(x: number, z: number, hubMaterial: MeshStandardMaterial): Group {
  const tireMaterial = new MeshStandardMaterial({
    color: PALETTE.tire,
    roughness: 0.9,
    flatShading: true,
  });
  const tire = new Mesh(
    new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 16),
    tireMaterial,
  );
  tire.name = "tire";
  tire.rotation.z = Math.PI / 2;

  const hub = new Mesh(spokesGeometry(), hubMaterial);
  hub.name = "hub";
  const group = new Group();
  group.name = "wheel";
  group.add(tire, hub);
  group.position.set(x, WHEEL_RADIUS, z);
  return group;
}

/** The dark disc, the 5 silver spokes and a cap, as one geometry with vertex colours. */
function spokesGeometry(): BufferGeometry {
  const batch = new GeometryBatch();
  const disc = new CylinderGeometry(0.26, 0.26, 0.27, 16);
  disc.rotateZ(Math.PI / 2);
  batch.add(disc, { color: "#2A2A2C" });
  const cap = new CylinderGeometry(0.07, 0.07, 0.31, 8);
  cap.rotateZ(Math.PI / 2);
  batch.add(cap, { color: PALETTE.wheel });
  for (let i = 0; i < 5; i += 1) {
    const spoke = new BoxGeometry(0.29, 0.22, 0.07);
    spoke.translate(0, 0.14, 0);
    spoke.rotateX((i * 2 * Math.PI) / 5);
    batch.add(spoke, { color: PALETTE.wheel });
  }
  return batch.build();
}

function box(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
): BufferGeometry {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
}

export function buildHearse(): HearseModel {
  const group = new Group();
  group.name = "hearse";
  const sky = skyReflection();

  const paint = new MeshStandardMaterial({
    color: PALETTE.hearseBody,
    roughness: 0.25,
    metalness: 0.6,
    envMap: sky,
    envMapIntensity: 1.8,
  });
  const glass = new MeshStandardMaterial({
    color: PALETTE.glass,
    roughness: 0.1,
    metalness: 0.3,
    envMap: sky,
    envMapIntensity: 2,
    side: DoubleSide,
  });
  const chrome = new MeshStandardMaterial({
    color: PALETTE.chrome,
    roughness: 0.2,
    metalness: 1,
    envMap: sky,
    envMapIntensity: 1.5,
    side: DoubleSide,
  });
  const curtain = new MeshStandardMaterial({
    color: PALETTE.curtain,
    roughness: 0.9,
    side: DoubleSide,
  });
  const trim = new MeshStandardMaterial({
    color: PALETTE.iron,
    roughness: 0.6,
    side: DoubleSide,
  });
  const plate = new MeshStandardMaterial({
    color: PALETTE.plate,
    roughness: 0.6,
  });
  const headlight = new MeshStandardMaterial({
    color: PALETTE.headlight,
    emissive: PALETTE.headlight,
    emissiveIntensity: 1,
  });
  const taillight = new MeshStandardMaterial({
    color: PALETTE.taillight,
    emissive: PALETTE.taillight,
    emissiveIntensity: 0.7,
  });
  const hubMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.35,
    metalness: 0.8,
    envMap: sky,
    envMapIntensity: 1.5,
    flatShading: true,
  });

  const body = new Mesh(bodyGeometry(), paint);
  body.name = "body";
  group.add(body);

  const glassParts: BufferGeometry[] = [];
  const chromeParts: BufferGeometry[] = [];
  const trimParts: BufferGeometry[] = [];
  const curtainParts: BufferGeometry[] = [];

  for (const side of [-1, 1]) {
    const glassX = side * (HALF_WIDTH + GLASS_OFFSET);
    const chromeX = side * (HALF_WIDTH + CHROME_OFFSET);
    for (const points of SIDE_WINDOWS) {
      glassParts.push(sideWindowGeometry(points, glassX));
      chromeParts.push(lineGeometry(points, chromeX, 0.025, true));
    }
    chromeParts.push(lineGeometry(SWOOSH, chromeX, 0.03, false));
    // Door lines, a sill strip and the arches over the wheels.
    for (const z of [-0.55, -1.44]) {
      trimParts.push(
        lineGeometry(
          [
            [z, 0.5],
            [z, 1.1],
          ],
          side * (HALF_WIDTH + 0.006),
          0.012,
          false,
        ),
      );
    }
    chromeParts.push(
      box(0.02, 0.035, 2.2, side * (HALF_WIDTH + 0.005), 0.5, 0.1),
    );
    for (const z of [FRONT_AXLE, REAR_AXLE]) {
      const arch = new CircleGeometry(0.44, 14, 0, Math.PI);
      arch.rotateY((side * Math.PI) / 2);
      arch.translate(side * (HALF_WIDTH + 0.004), WHEEL_RADIUS, z);
      trimParts.push(arch);
    }
    for (const [from, to] of CURTAIN_PANELS) {
      curtainParts.push(curtainGeometry(from, to, side));
    }
  }

  glassParts.push(windscreenGeometry());
  // Rear window of the tall tailgate.
  const rearGlass = new BoxGeometry(1.5, 0.34, 0.01);
  rearGlass.translate(0, 1.33, -(FRONT_FACE + GLASS_OFFSET));
  glassParts.push(rearGlass);

  // Bumpers, chrome strips and the grille (bars only, no emblem).
  for (const sign of [-1, 1]) {
    const z = sign * (FRONT_FACE + 0.02);
    trimParts.push(box(1.86, 0.22, 0.12, 0, 0.5, z));
    chromeParts.push(box(1.5, 0.025, 0.02, 0, 0.58, z + sign * 0.065));
  }
  trimParts.push(box(0.95, 0.2, 0.04, 0, 0.7, FRONT_FACE + 0.01));
  for (let i = 0; i < 4; i += 1) {
    chromeParts.push(
      box(0.9, 0.018, 0.02, 0, 0.63 + i * 0.045, FRONT_FACE + 0.035),
    );
  }

  const windowMesh = new Mesh(mergePlain(glassParts), glass);
  windowMesh.name = "window";
  const chromeMesh = new Mesh(mergePlain(chromeParts), chrome);
  chromeMesh.name = "chrome";
  const trimMesh = new Mesh(mergePlain(trimParts), trim);
  trimMesh.name = "trim";
  const curtainMesh = new Mesh(mergePlain(curtainParts), curtain);
  curtainMesh.name = "curtain";
  group.add(windowMesh, chromeMesh, trimMesh, curtainMesh);

  // Wide warm headlights at the front, large dark red tail lights at the back.
  const front = new Mesh(
    mergePlain([-1, 1].map((side) => box(0.5, 0.12, 0.05, side * 0.66, 0, 0))),
    headlight,
  );
  front.name = "headlight";
  front.position.set(0, 0.72, FRONT_FACE + 0.015);
  const rear = new Mesh(
    mergePlain([-1, 1].map((side) => box(0.62, 0.16, 0.05, side * 0.7, 0, 0))),
    taillight,
  );
  rear.name = "taillight";
  rear.position.set(0, 0.98, -(FRONT_FACE + 0.015));
  // A blank light plate: no number, no text.
  const rearPlate = new Mesh(box(0.52, 0.12, 0.02, 0, 0, 0), plate);
  rearPlate.name = "plate";
  rearPlate.position.set(0, 0.68, -(FRONT_FACE + 0.01));
  group.add(front, rear, rearPlate);

  const wheels: Group[] = [];
  for (const side of [-1, 1]) {
    for (const z of [FRONT_AXLE, REAR_AXLE]) {
      const w = wheel(side * WHEEL_X, z, hubMaterial);
      wheels.push(w);
      group.add(w);
    }
  }

  // One warm cone on the road in front of the hearse.
  const headlights = new SpotLight(PALETTE.headlight, 420, 34, 0.75, 0.7, 1.4);
  headlights.name = "headlight-cone";
  headlights.position.set(0, 0.8, HALF_LENGTH - 0.2);
  headlights.target.position.set(0, 0, HALF_LENGTH + 10);
  group.add(headlights, headlights.target);

  return { group, wheels, wheelRadius: WHEEL_RADIUS, headlights };
}
