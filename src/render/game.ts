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
import { createRandom } from "../logic/random";
import { buildBuildings } from "./buildings";
import { patches, type Spot } from "./glow";
import {
  buildGraves,
  lanternMeshes,
  pumpkinMesh,
  type Lantern,
} from "./graves";
import { groundGeometry } from "./landscape";
import { buildTrees } from "./trees";
import { createZombieLayer } from "./zombies";
import type { Zombie } from "../logic/zombies";
import { PALETTE } from "./palette";

/** Dusk colours (VISUAL_REFERENCE.md): grass ground, amber glow low in the sky, blue-grey high. */
const GROUND_COLOR = PALETTE.grassOlive;
const FOG_COLOR = "#6F5F5E";
const MOON_COLOR = PALETTE.moon;

const LOOK_HEIGHT = 1.1;
/**
 * Side shift of the view axis, as a share of the camera side offset. The full value
 * (-lookAhead / offset.z) puts the hearse on the axis. A little less keeps the hearse a bit
 * left of the middle of the screen, like in the target image.
 */
const LOOK_SIDE = (-CONFIG.camera.lookAhead / CONFIG.camera.offset.z) * 0.85;
const SHADOW_SIZE = 18;
const MOON_OFFSET = new Vector3(-14, 26, 10);

export interface GameScene {
  scene: Scene;
  camera: PerspectiveCamera;
  /** Resolves when the models are in the scene. */
  loaded: Promise<void>;
  /** Put the hearse and the light where the state says, and move the camera. */
  update: (
    hearse: HearseState,
    zombies: readonly Zombie[],
    frameSeconds: number,
  ) => void;
  /** Put the camera at once at its place for this state (no smooth follow). */
  snap: (hearse: HearseState) => void;
  resize: (width: number, height: number) => void;
}

export function createGameScene(
  renderer: WebGLRenderer,
  map: CemeteryMap,
): GameScene {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = new Color(FOG_COLOR);
  scene.fog = new Fog(FOG_COLOR, 38, 130);
  const camera = new PerspectiveCamera(CONFIG.camera.fov, 1, 0.5, 300);

  // Dusk sky: amber at the horizon, mauve, then blue-grey.
  const sky = skyDome(
    new Color(PALETTE.haze),
    new Color(PALETTE.skyTop),
    0.75,
    new Color(PALETTE.skyMiddle),
    new Color(PALETTE.horizonGlow),
    0.2,
  );
  scene.add(sky);

  // Grass far away, and the fine ground with the dirt paths near the walls.
  const outer = new Mesh(
    new PlaneGeometry(900, 900),
    new MeshStandardMaterial({ color: PALETTE.grassOlive, roughness: 1 }),
  );
  outer.name = "ground-far";
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.03;
  outer.receiveShadow = true;
  scene.add(outer);
  const ground = new Mesh(
    groundGeometry(map.roads),
    new MeshStandardMaterial({
      vertexColors: true,
      color: GROUND_COLOR,
      roughness: 1,
      flatShading: true,
    }),
  );
  ground.material.color.set("#ffffff");
  ground.name = "ground";
  ground.receiveShadow = true;
  scene.add(ground);

  const buildings = buildBuildings(map);
  scene.add(buildings.group);
  const graves = buildGraves(map.graves, CONFIG.map.seed + 31);
  scene.add(graves.group);
  scene.add(pumpkinMesh(map.pumpkins));
  scene.add(buildTrees(map, CONFIG.map.seed + 61));

  // Candle lanterns on the graves and at the chapel door (the candle slots of the map).
  const lanterns: Lantern[] = [
    ...graves.lanterns,
    ...map.candleSlots.map((slot, index) => ({
      x: slot.x,
      z: slot.z,
      red: index % 2 === 0,
      size: 1.5,
    })),
  ];
  scene.add(lanternMeshes(lanterns, true));

  // Low ground fog between the graves.
  const fogRandom = createRandom(CONFIG.map.seed + 77);
  const fogSpots: Spot[] = [];
  for (let i = 0; i < 46; i += 1) {
    fogSpots.push({
      x: (fogRandom() - 0.5) * 2 * (map.bounds.maxX + 6),
      y: 0.35 + fogRandom() * 0.5,
      z: (fogRandom() - 0.5) * 2 * (map.bounds.maxZ + 6),
      size: 9 + fogRandom() * 9,
    });
  }
  const groundFog = patches(fogSpots, {
    color: "#8E96A8",
    opacity: 0.18,
    additive: false,
    power: 1.2,
  });
  groundFog.name = "ground-fog";
  scene.add(groundFog);

  const zombieLayer = createZombieLayer();
  scene.add(zombieLayer.group);

  // Cool blue fill from the sky, a warm ground bounce.
  scene.add(new AmbientLight(0x7a7f9c, 0.8));
  scene.add(new HemisphereLight(0x8fa0cc, 0x4a3f33, 1.2));

  // Cold moonlight. Only the hearse and the chapel cast a shadow.
  const moon = new DirectionalLight(MOON_COLOR, 1.3);
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
      // The glossy paint shows the dusk sky on the roof and the bonnet. Glass and chrome
      // also reflect it, so the windows read against the black paint.
      const material = object.material as MeshStandardMaterial;
      if (object.name === "body") {
        material.envMapIntensity = 3.2;
      } else if (object.name === "window") {
        material.envMapIntensity = 3.5;
      } else if (object.name === "chrome") {
        material.envMapIntensity = 2.4;
      }
    }
  });
  scene.add(hearse.group);

  const offset = new Vector3(
    CONFIG.camera.offset.x,
    CONFIG.camera.offset.y,
    CONFIG.camera.offset.z,
  );
  const focus = new Vector3();
  const anchor = new Vector3();
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
    anchor.set(state.x, 0, state.z);
    // The camera looks a little ahead (north) of the hearse, so the sky and tree line show.
    focus.set(
      state.x + CONFIG.camera.offset.x * LOOK_SIDE,
      LOOK_HEIGHT,
      state.z - CONFIG.camera.lookAhead,
    );
  }

  function pointCamera(): void {
    camera.lookAt(focus);
    sky.position.copy(camera.position);
  }

  function update(
    state: HearseState,
    zombies: readonly Zombie[],
    frameSeconds: number,
  ): void {
    placeHearse(state, frameSeconds);
    zombieLayer.update(zombies, frameSeconds);
    wanted.copy(anchor).add(offset);
    const k = 1 - Math.exp(-CONFIG.camera.follow * Math.max(0, frameSeconds));
    camera.position.lerp(wanted, k);
    pointCamera();
  }

  function snap(state: HearseState): void {
    placeHearse(state, 0);
    camera.position.copy(anchor).add(offset);
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
  const loaded = zombieLayer.loaded;
  return { scene, camera, loaded, update, snap, resize };
}
