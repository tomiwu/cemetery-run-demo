import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  type WebGLRenderer,
} from "three";
import { CONFIG } from "../config";
import type { HearseState } from "../logic/hearse";
import type { CemeteryMap } from "../logic/map";
import { buildHearse } from "./hearse";
import { skyDome } from "./intro";
import { buildMapScene } from "./map";
import { PALETTE } from "./palette";

/** Night colours. The ground is the surface colour of the palette (PRD section 6). */
const GROUND_COLOR = PALETTE.mapGrass;
const FOG_COLOR = PALETTE.gameFog;
/** Dusk sky (VISUAL_REFERENCE.md): warm glow low, blue-grey high. */
const SKY_LOW = PALETTE.horizonGlow;
const SKY_HIGH = PALETTE.skyTop;
const MOON_COLOR = PALETTE.moon;

const LOOK_HEIGHT = 1.1;
const SHADOW_SIZE = 16;
const MOON_OFFSET = new Vector3(-14, 26, 10);

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
  map: CemeteryMap,
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

  const mapScene = buildMapScene(map, baseUrl);
  scene.add(mapScene.group);

  scene.add(new AmbientLight(0x8a8590, 2));
  scene.add(new HemisphereLight(0x9a93a0, 0x4a3f33, 2));

  // Cold moonlight. Only the hearse and the chapel cast a shadow.
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

  snap({ ...map.hearseStart, speed: 0 });
  return { scene, camera, loaded: mapScene.loaded, update, snap, resize };
}
