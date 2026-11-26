import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
} from "three";

/**
 * The hearse is built in code: a black estate car with a long bonnet, a long flat roof
 * and a tall rear part. No badge, no logo, no text. It is about 5.2 m long, about
 * 1.9 m wide, and it points to +z. The origin is on the ground, in the middle.
 */

export interface HearseModel {
  group: Group;
  /** The four wheel groups. Turn `rotation.x` to spin a wheel. */
  wheels: Group[];
  wheelRadius: number;
}

const HALF_LENGTH = 2.55;
const WIDTH = 1.9;
const HALF_WIDTH = WIDTH / 2;
const WHEEL_RADIUS = 0.36;
const GLASS_OFFSET = 0.012;
const CURTAIN_OFFSET = 0.02;

/** Side profile of the body as (z, y) points. */
const BODY_PROFILE: readonly (readonly [number, number])[] = [
  [-HALF_LENGTH, 0.38],
  [HALF_LENGTH, 0.38],
  [HALF_LENGTH, 0.78],
  [HALF_LENGTH - 0.2, 0.95],
  [0.95, 1.02],
  [0.3, 1.52],
  [-HALF_LENGTH + 0.15, 1.58],
  [-HALF_LENGTH, 1.42],
];

/** Side windows as (z, y) points: front door, rear door, rear quarter. */
const SIDE_WINDOWS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0.65, 1.12],
    [0.28, 1.4],
    [-0.7, 1.41],
    [-0.7, 1.12],
  ],
  [
    [-0.8, 1.12],
    [-0.8, 1.41],
    [-1.7, 1.42],
    [-1.7, 1.12],
  ],
  [
    [-1.8, 1.12],
    [-1.8, 1.42],
    [-2.35, 1.43],
    [-2.35, 1.12],
  ],
];

/** Curtain strips in the rear side windows: [z min, z max, y min, y max]. */
const CURTAIN_STRIPS: readonly (readonly [number, number, number, number])[] = [
  [-1.7, -0.8, 1.31, 1.4],
  [-0.92, -0.8, 1.12, 1.4],
  [-2.35, -1.8, 1.32, 1.41],
  [-1.92, -1.8, 1.12, 1.41],
];

function bodyGeometry(): BufferGeometry {
  const shape = new Shape();
  BODY_PROFILE.forEach(([z, y], index) => {
    if (index === 0) {
      shape.moveTo(z, y);
    } else {
      shape.lineTo(z, y);
    }
  });
  const geometry = new ExtrudeGeometry(shape, {
    depth: WIDTH,
    bevelEnabled: false,
  });
  // Shape x -> world z, extrusion -> world -x, then centre on x.
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(HALF_WIDTH, 0, 0);
  return geometry;
}

/** A flat polygon in the side plane x = `x`. Both sides use the same points. */
function sideWindowGeometry(
  points: readonly (readonly [number, number])[],
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

/** The windscreen: a slanted quad across the car, just above the body. */
function windscreenGeometry(): BufferGeometry {
  const o = GLASS_OFFSET;
  const w = HALF_WIDTH - 0.07;
  const geometry = new BufferGeometry();
  const bottom: [number, number] = [0.88 + o * 0.61, 1.07 + o * 0.79];
  const top: [number, number] = [0.36 + o * 0.61, 1.47 + o * 0.79];
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        -w,
        bottom[1],
        bottom[0],
        w,
        bottom[1],
        bottom[0],
        w,
        top[1],
        top[0],
        -w,
        bottom[1],
        bottom[0],
        w,
        top[1],
        top[0],
        -w,
        top[1],
        top[0],
      ],
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function wheel(x: number, z: number): Group {
  const tireMaterial = new MeshStandardMaterial({
    color: 0x0c0c0c,
    roughness: 0.9,
    flatShading: true,
  });
  const hubMaterial = new MeshStandardMaterial({
    color: 0x8c8c8c,
    roughness: 0.5,
    metalness: 0.3,
    flatShading: true,
  });
  const tire = new Mesh(
    new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 14),
    tireMaterial,
  );
  const hub = new Mesh(new CylinderGeometry(0.19, 0.19, 0.28, 8), hubMaterial);
  tire.name = "tire";
  hub.name = "hub";
  tire.rotation.z = Math.PI / 2;
  hub.rotation.z = Math.PI / 2;
  const group = new Group();
  group.name = "wheel";
  group.add(tire, hub);
  group.position.set(x, WHEEL_RADIUS, z);
  return group;
}

export function buildHearse(): HearseModel {
  const group = new Group();
  group.name = "hearse";

  const paint = new MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.3,
    metalness: 0.25,
    flatShading: true,
  });
  const glass = new MeshStandardMaterial({
    color: 0x2e3033,
    roughness: 0.15,
    metalness: 0.1,
    side: DoubleSide,
  });
  const curtain = new MeshStandardMaterial({
    color: 0xc4c4c0,
    roughness: 0.9,
    side: DoubleSide,
  });
  const trim = new MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
  const headlight = new MeshStandardMaterial({
    color: 0xfff1cf,
    emissive: 0xffe3a8,
    emissiveIntensity: 0.9,
  });
  const taillight = new MeshStandardMaterial({
    color: 0x6b0f14,
    emissive: 0x4a0508,
    emissiveIntensity: 0.6,
  });

  const body = new Mesh(bodyGeometry(), paint);
  body.name = "body";
  group.add(body);

  for (const side of [-1, 1]) {
    const x = side * (HALF_WIDTH + GLASS_OFFSET);
    for (const points of SIDE_WINDOWS) {
      const pane = new Mesh(sideWindowGeometry(points, x), glass);
      pane.name = "window";
      group.add(pane);
    }
    const stripX = side * (HALF_WIDTH + CURTAIN_OFFSET);
    for (const [z0, z1, y0, y1] of CURTAIN_STRIPS) {
      const strip = new Mesh(new PlaneGeometry(z1 - z0, y1 - y0), curtain);
      strip.name = "curtain";
      strip.rotation.y = Math.PI / 2;
      strip.position.set(stripX, (y0 + y1) / 2, (z0 + z1) / 2);
      group.add(strip);
    }
  }

  const windscreen = new Mesh(windscreenGeometry(), glass);
  windscreen.name = "window";
  group.add(windscreen);

  const rearWindow = new Mesh(new PlaneGeometry(1.5, 0.34), glass);
  rearWindow.name = "window";
  rearWindow.rotation.y = Math.PI;
  rearWindow.position.set(0, 1.19, -HALF_LENGTH - GLASS_OFFSET);
  group.add(rearWindow);

  for (const z of [-1, 1]) {
    const bumper = new Mesh(new BoxGeometry(1.84, 0.2, 0.1), trim);
    bumper.name = "bumper";
    bumper.position.set(0, 0.48, z * HALF_LENGTH);
    group.add(bumper);
  }

  for (const side of [-1, 1]) {
    const front = new Mesh(new BoxGeometry(0.38, 0.14, 0.06), headlight);
    front.name = "headlight";
    front.position.set(side * 0.62, 0.68, HALF_LENGTH);
    group.add(front);

    const rear = new Mesh(new BoxGeometry(0.2, 0.34, 0.06), taillight);
    rear.name = "taillight";
    rear.position.set(side * 0.78, 1.1, -HALF_LENGTH);
    group.add(rear);
  }

  const wheels: Group[] = [];
  for (const side of [-1, 1]) {
    for (const z of [1.6, -1.5]) {
      const w = wheel(side * 0.86, z);
      wheels.push(w);
      group.add(w);
    }
  }

  return { group, wheels, wheelRadius: WHEEL_RADIUS };
}
