import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  type WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CONFIG } from "../config";
import type { HearseState } from "../logic/hearse";
import { buildHearse } from "./hearse";
import { skyDome } from "./intro";
import { PALETTE } from "./palette";

/** Night colours. The ground is the surface colour of the palette (PRD section 6). */
const GROUND_COLOR = PALETTE.grassDark;
const PATH_COLOR = PALETTE.pathShadow;
const FOG_COLOR = "#5a4f58";
/** Dusk sky (VISUAL_REFERENCE.md): warm glow low, blue-grey high. */
const SKY_LOW = PALETTE.horizonGlow;
const SKY_HIGH = PALETTE.skyTop;
const MOON_COLOR = 0xa9b4d6;

const CANDLE_COLOR = PALETTE.candle;

const LOOK_HEIGHT = 1.1;
const SHADOW_SIZE = 16;
const MOON_OFFSET = new Vector3(-14, 26, 10);

interface Prop {
  model: string;
  x: number;
  z: number;
  scale: number;
  turn?: number;
}

const STONE_SCALE = 2;
const PINE_SCALE = 4.3;
const STONES = [
  "gravestone-round",
  "gravestone-cross",
  "gravestone-bevel",
  "gravestone-wide",
  "gravestone-broken",
  "cross",
] as const;

/**
 * Decoration only: rows of graves on both sides of the start path and pines further out.
 * The hearse cannot hit them yet.
 */
function props(): Prop[] {
  const list: Prop[] = [];
  let index = 0;
  for (let z = -70; z <= 24; z += 7) {
    for (const x of [-9, -15, -22, 9, 15, 22]) {
      const wobble = ((index * 37) % 11) / 11;
      list.push({
        model: STONES[index % STONES.length] ?? "gravestone-round",
        x: x + (wobble - 0.5) * 2,
        z: z + (((index * 53) % 7) / 7 - 0.5) * 2,
        scale: STONE_SCALE,
        turn: (wobble - 0.5) * 0.5,
      });
      index += 1;
    }
  }
  const pines = ["pine", "pine-crooked", "pine-fall"] as const;
  for (let i = 0; i < 22; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    list.push({
      model: pines[i % pines.length] ?? "pine",
      x: side * (30 + ((i * 7) % 9)),
      z: -80 + i * 5.2,
      scale: PINE_SCALE,
      turn: i,
    });
  }
  return list;
}

export interface GameScene {
  scene: Scene;
  camera: PerspectiveCamera;
  /** Resolves when the models are in the scene. */
  loaded: Promise<void>;
  /** Put the hearse and the light where the state says, and move the camera. */
  update: (hearse: HearseState, frameSeconds: number) => void;
  /** Put the camera at once at its place for this state (no smooth follow). */
  snap: (hearse: HearseState) => void;
  resize: (width: number, height: number) => void;
}

export function createGameScene(
  renderer: WebGLRenderer,
  baseUrl: string,
): GameScene {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = new Color(FOG_COLOR);
  scene.fog = new Fog(FOG_COLOR, 22, 80);
  const camera = new PerspectiveCamera(CONFIG.camera.fov, 1, 0.5, 300);

  const sky = skyDome(new Color(SKY_LOW), new Color(SKY_HIGH), 0.35);
  scene.add(sky);

  const ground = new Mesh(
    new PlaneGeometry(600, 600),
    new MeshStandardMaterial({
      color: GROUND_COLOR,
      roughness: 1,
      flatShading: true,
    }),
  );
  ground.name = "ground";
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const path = new Mesh(
    new PlaneGeometry(5, 220),
    new MeshStandardMaterial({
      color: PATH_COLOR,
      roughness: 1,
      flatShading: true,
    }),
  );
  path.name = "path";
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.01, -40);
  path.receiveShadow = true;
  scene.add(path);

  scene.add(new AmbientLight(0x8a8590, 1.5));
  scene.add(new HemisphereLight(0x9a93a0, 0x4a3f33, 1.6));

  // Cold moonlight. Only the hearse casts a shadow.
  const moon = new DirectionalLight(MOON_COLOR, 2.2);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -SHADOW_SIZE;
  moon.shadow.camera.right = SHADOW_SIZE;
  moon.shadow.camera.top = SHADOW_SIZE;
  moon.shadow.camera.bottom = -SHADOW_SIZE;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 80;
  moon.shadow.bias = -0.0004;
  scene.add(moon, moon.target);

  const hearse = buildHearse();
  hearse.group.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true;
    }
  });
  scene.add(hearse.group);

  const loader = new GLTFLoader();
  const templates = new Map<string, Promise<Group>>();
  function template(name: string): Promise<Group> {
    let known = templates.get(name);
    if (known === undefined) {
      known = loader
        .loadAsync(`${baseUrl}assets/models/${name}.glb`)
        .then((gltf) => gltf.scene);
      templates.set(name, known);
    }
    return known;
  }
  async function place(prop: Prop): Promise<void> {
    const model = (await template(prop.model)).clone();
    const holder = new Group();
    holder.add(model);
    holder.scale.setScalar(prop.scale);
    holder.position.set(prop.x, 0, prop.z);
    holder.rotation.y = prop.turn ?? 0;
    scene.add(holder);
  }
  const items = props();
  const loaded = Promise.all(items.map(place)).then(() => undefined);

  // Many small warm candle points beside the graves (a key part of the mood).
  const stones = items.filter((prop) => !prop.model.startsWith("pine"));
  const candles = new InstancedMesh(
    new SphereGeometry(0.13, 8, 6),
    new MeshBasicMaterial({ color: CANDLE_COLOR }),
    stones.length,
  );
  const candlePlace = new Matrix4();
  stones.forEach((stone, i) => {
    const side = stone.x < 0 ? 1 : -1;
    candlePlace.setPosition(stone.x + side * 0.9, 0.35, stone.z + 0.6);
    candles.setMatrixAt(i, candlePlace);
  });
  scene.add(candles);

  const offset = new Vector3(
    CONFIG.camera.offset.x,
    CONFIG.camera.offset.y,
    CONFIG.camera.offset.z,
  );
  const focus = new Vector3();
  const wanted = new Vector3();
  let wheelAngle = 0;

  function placeHearse(state: HearseState, frameSeconds: number): void {
    hearse.group.position.set(state.x, 0, state.z);
    hearse.group.rotation.y = state.heading;
    wheelAngle += (state.speed * frameSeconds) / hearse.wheelRadius;
    for (const wheel of hearse.wheels) {
      wheel.rotation.x = wheelAngle;
    }
    moon.position.set(state.x, 0, state.z).add(MOON_OFFSET);
    moon.target.position.set(state.x, 0, state.z);
    focus.set(state.x, LOOK_HEIGHT, state.z);
  }

  function pointCamera(): void {
    camera.lookAt(focus);
    sky.position.copy(camera.position);
  }

  function update(state: HearseState, frameSeconds: number): void {
    placeHearse(state, frameSeconds);
    wanted.copy(focus).add(offset);
    const k = 1 - Math.exp(-CONFIG.camera.follow * Math.max(0, frameSeconds));
    camera.position.lerp(wanted, k);
    pointCamera();
  }

  function snap(state: HearseState): void {
    placeHearse(state, 0);
    camera.position.copy(focus).add(offset);
    pointCamera();
  }

  function resize(width: number, height: number): void {
    camera.aspect = width / Math.max(height, 1);
    // On a narrow (portrait) screen, widen the view so the hearse and the ground ahead stay in frame.
    const halfWide = Math.tan((CONFIG.camera.wideFov * Math.PI) / 360);
    camera.fov = Math.min(
      CONFIG.camera.maxFov,
      Math.max(
        CONFIG.camera.fov,
        (2 * Math.atan(halfWide / camera.aspect) * 180) / Math.PI,
      ),
    );
    camera.updateProjectionMatrix();
  }

  snap({ x: 0, z: 0, heading: Math.PI, speed: 0 });
  return { scene, camera, loaded, update, snap, resize };
}
