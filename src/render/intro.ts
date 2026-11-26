import {
  AmbientLight,
  BackSide,
  Box3,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { sampleIntro } from "../logic/intro";
import { buildHearse } from "./hearse";

/** Sky gradient (PRD section 6): warm low, dark high. */
const SKY_LOW = new Color("#E0A24A");
const SKY_HIGH = new Color("#161513");
const FOG_COLOR = "#8f6a40";
const LAMP_LIGHT = "#E0A24A";

/** Vertical view angle, and the narrowest side-to-side view angle, in degrees. */
const BASE_FOV = 55;
const WIDE_FOV = 70;
const MAX_FOV = 90;

const ROAD_WIDTH = 6;
const ROAD_START_Z = -110;
const ROAD_END_Z = 60;

interface Placement {
  model: string;
  x: number;
  z: number;
  scale: number;
  /** Height above the ground. */
  y?: number;
  /** Turn around the y axis, in radians. */
  turn?: number;
  /** Move the model so its depth is centred on z (fence and wall pieces). */
  centre?: boolean;
}

const GATE_SCALE = 5;
const PINE_SCALE = 4.3;
const STONE_SCALE = 3;

/** Wall pieces on both sides of the gate. Each piece is one scaled unit wide. */
const WALL_X = [10, 15, 20, 25] as const;

const PLACEMENTS: readonly Placement[] = [
  {
    model: "iron-fence-border-gate",
    x: 0,
    z: 0,
    scale: GATE_SCALE,
    centre: true,
  },
  ...[-1, 1].flatMap((side): Placement[] => [
    {
      model: "stone-wall-column",
      x: side * GATE_SCALE,
      z: 0,
      scale: GATE_SCALE,
      centre: true,
    },
    ...WALL_X.map((x) => ({
      model: "stone-wall",
      x: side * x,
      z: 0,
      scale: GATE_SCALE,
      centre: true,
    })),
  ]),
  // Pines along the road: at least 6 and at most 10.
  { model: "pine", x: -9, z: -40, scale: PINE_SCALE },
  { model: "pine-crooked", x: 10, z: -34, scale: PINE_SCALE, turn: 1 },
  { model: "pine-fall", x: -12, z: -24, scale: PINE_SCALE, turn: 2 },
  { model: "pine", x: 12, z: -19, scale: PINE_SCALE, turn: 3 },
  { model: "pine-crooked", x: -10, z: -11, scale: PINE_SCALE, turn: 4 },
  { model: "pine", x: 15, z: -7, scale: PINE_SCALE, turn: 5 },
  { model: "pine-fall", x: -17, z: -50, scale: PINE_SCALE },
  { model: "pine", x: 9.5, z: -52, scale: PINE_SCALE, turn: 2 },
  // Inside the cemetery.
  { model: "crypt-large", x: 0, z: 44, scale: 5 },
  { model: "crypt-large-roof", x: 0, z: 44, y: 5, scale: 5 },
  { model: "gravestone-round", x: -9, z: 16, scale: STONE_SCALE, turn: 0.2 },
  { model: "gravestone-cross", x: 8, z: 20, scale: STONE_SCALE, turn: -0.15 },
  { model: "gravestone-bevel", x: -14, z: 28, scale: STONE_SCALE },
  { model: "gravestone-wide", x: 13, z: 32, scale: STONE_SCALE, turn: 0.1 },
  { model: "gravestone-broken", x: -7, z: 36, scale: STONE_SCALE },
  { model: "pumpkin-carved", x: 5, z: 12, scale: 2 },
];

const LIGHTPOST = { x: -4.2, z: -1.5, scale: 3.6 } as const;

function skyDome(): Mesh {
  const geometry = new SphereGeometry(200, 20, 12);
  const position = geometry.getAttribute("position");
  const colors: number[] = [];
  const color = new Color();
  for (let i = 0; i < position.count; i += 1) {
    const height = Math.max(0, position.getY(i) / 200);
    const k = Math.min(1, Math.pow(height / 0.55, 0.7));
    color.copy(SKY_LOW).lerp(SKY_HIGH, k);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  const sky = new Mesh(
    geometry,
    new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false }),
  );
  sky.name = "sky";
  return sky;
}

function flatPlane(
  width: number,
  length: number,
  x: number,
  y: number,
  z: number,
  color: string,
): Mesh {
  const mesh = new Mesh(
    new PlaneGeometry(width, length),
    new MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

/** Fields on both sides of the road, in strips, and the road. */
function ground(): Group {
  const group = new Group();
  group.name = "ground";
  const length = ROAD_END_Z - ROAD_START_Z;
  const centreZ = (ROAD_START_Z + ROAD_END_Z) / 2;
  group.add(flatPlane(600, 600, 0, -0.02, 0, "#26301f"));
  const shades = ["#34432a", "#3d4a2c", "#4a4630", "#3a3f27"];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      const width = 14;
      const x = side * (ROAD_WIDTH / 2 + 1 + width * i + width / 2);
      group.add(
        flatPlane(
          width,
          ROAD_END_Z - ROAD_START_Z,
          x,
          i % 2 === 0 ? 0 : 0.01,
          centreZ,
          shades[(i + (side > 0 ? 1 : 0)) % shades.length] ?? "#34432a",
        ),
      );
    }
  }
  // Grass verge, road and a pale path inside the cemetery.
  group.add(flatPlane(ROAD_WIDTH + 2, length, 0, 0.02, centreZ, "#3b3a2a"));
  group.add(flatPlane(ROAD_WIDTH, length, 0, 0.05, centreZ, "#3a3a3d"));
  return group;
}

export interface IntroScene {
  scene: Scene;
  camera: PerspectiveCamera;
  /** Resolves when the models are in the scene. */
  loaded: Promise<void>;
  /** Put the hearse and the camera where they are at `progress` (0..1). */
  update: (progress: number) => void;
  resize: (width: number, height: number) => void;
}

export function createIntroScene(baseUrl: string): IntroScene {
  const scene = new Scene();
  scene.background = SKY_HIGH.clone();
  scene.fog = new Fog(FOG_COLOR, 35, 190);

  const camera = new PerspectiveCamera(BASE_FOV, 1, 0.3, 450);
  const sky = skyDome();
  scene.add(sky);
  scene.add(ground());

  scene.add(new AmbientLight(0x8d86a8, 0.9));
  scene.add(new HemisphereLight(0xe0a24a, 0x2b2a35, 1.1));
  const sun = new DirectionalLight(0xffb36b, 2.6);
  sun.position.set(-60, 16, 70);
  scene.add(sun);
  const moon = new DirectionalLight(0x8fa4d8, 0.8);
  moon.position.set(40, 60, -50);
  scene.add(moon);

  const hearse = buildHearse();
  scene.add(hearse.group);
  const startZ = sampleIntro(0).hearse.z;

  const lampLight = new PointLight(LAMP_LIGHT, 90, 26, 2);
  scene.add(lampLight);

  const loader = new GLTFLoader();
  const templates = new Map<string, Group>();

  async function template(name: string): Promise<Group> {
    const known = templates.get(name);
    if (known) {
      return known;
    }
    const gltf = await loader.loadAsync(`${baseUrl}assets/models/${name}.glb`);
    templates.set(name, gltf.scene);
    return gltf.scene;
  }

  async function place(placement: Placement): Promise<void> {
    const source = await template(placement.model);
    const model = source.clone();
    const holder = new Group();
    if (placement.centre === true) {
      const centre = new Box3().setFromObject(model).getCenter(new Vector3());
      model.position.z -= centre.z;
    }
    holder.add(model);
    holder.scale.setScalar(placement.scale);
    holder.position.set(placement.x, placement.y ?? 0, placement.z);
    holder.rotation.y = placement.turn ?? 0;
    scene.add(holder);
  }

  async function placeLamp(): Promise<void> {
    const source = await template("lightpost-single");
    const post = source.clone();
    const holder = new Group();
    holder.add(post);
    holder.scale.setScalar(LIGHTPOST.scale);
    holder.position.set(LIGHTPOST.x, 0, LIGHTPOST.z);
    scene.add(holder);
    const lamp = new Mesh(
      new SphereGeometry(0.22, 8, 6),
      new MeshBasicMaterial({ color: "#FFE2A8", fog: false }),
    );
    lamp.name = "lamp-glow";
    const lampPosition = new Vector3(0, 1.22, 0.3).multiplyScalar(
      LIGHTPOST.scale,
    );
    lampPosition.add(holder.position);
    lamp.position.copy(lampPosition);
    lampLight.position.copy(lampPosition);
    scene.add(lamp);
  }

  const loaded = Promise.all([placeLamp(), ...PLACEMENTS.map(place)]).then(
    () => undefined,
  );

  function update(progress: number): void {
    const sample = sampleIntro(progress);
    hearse.group.position.set(sample.hearse.x, 0, sample.hearse.z);
    hearse.group.rotation.y = sample.hearse.heading;
    const spin = (sample.hearse.z - startZ) / hearse.wheelRadius;
    for (const wheel of hearse.wheels) {
      wheel.rotation.x = spin;
    }
    camera.position.set(sample.camera.x, sample.camera.y, sample.camera.z);
    camera.lookAt(sample.hearse.x, 1.1, sample.hearse.z);
    sky.position.copy(camera.position);
  }

  function resize(width: number, height: number): void {
    camera.aspect = width / Math.max(height, 1);
    // On a narrow (portrait) screen, widen the view so the hearse stays in frame.
    const halfWide = Math.tan((WIDE_FOV * Math.PI) / 360);
    camera.fov = Math.min(
      MAX_FOV,
      Math.max(
        BASE_FOV,
        (2 * Math.atan(halfWide / camera.aspect) * 180) / Math.PI,
      ),
    );
    camera.updateProjectionMatrix();
  }

  update(0);
  return { scene, camera, loaded, update, resize };
}
