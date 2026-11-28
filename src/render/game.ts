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
  pathEdgeProps,
  pumpkinMesh,
  type Lantern,
} from "./graves";
import { groundGeometry } from "./landscape";
import { buildTrees } from "./trees";
import { createPopLayer } from "./pop";
import { createZombieLayer } from "./zombies";
import type { Zombie } from "../logic/zombies";
import { PALETTE } from "./palette";

/** Dusk colours (VISUAL_REFERENCE.md): grass ground, amber glow low in the sky, blue-grey high. */
const GROUND_COLOR = PALETTE.grassOlive;
const FOG_COLOR = "#6F5F5E";
const MOON_COLOR = PALETTE.moon;

const LOOK_HEIGHT = 0.4;
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
  /** A zombie was hit: start the pop effect. */
  pop: (zombie: Zombie) => void;
  /** Shake the camera: a small height in metres for a short time in seconds. */
  shake: (amplitude: number, seconds: number) => void;
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
    0.4,
    new Color(PALETTE.skyMiddle),
    new Color(PALETTE.horizonGlow),
    // Amber only in the lowest part of the sky, then mauve, then blue-grey.
    { glow: 0.08, mid: 0.28 },
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
  const mainRoad = map.roads[0];
  const edge =
    mainRoad === undefined
      ? undefined
      : pathEdgeProps(mainRoad, CONFIG.map.seed + 91);
  if (edge !== undefined) {
    scene.add(edge.group);
  }
  const lanterns: Lantern[] = [
    ...graves.lanterns,
    ...(edge?.lanterns ?? []),
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
  for (let i = 0; i < 30; i += 1) {
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
  // Large soft white-grey wisps between the grave rows, 0.5 to 1.5 m above the ground.
  const wispSpots: Spot[] = [];
  for (let i = 0; i < 8; i += 1) {
    wispSpots.push({
      x: (i % 2 === 0 ? -1 : 1) * (6 + fogRandom() * 8),
      y: 0.5 + fogRandom(),
      z: -24 + i * 6.5 + fogRandom() * 3,
      size: 7 + fogRandom() * 4,
    });
  }
  const wisps = patches(wispSpots, {
    color: "#9AA0A8",
    opacity: 0.2,
    additive: true,
    power: 1.4,
  });
  wisps.name = "fog-wisps";
  scene.add(wisps);

  const zombieLayer = createZombieLayer();
  scene.add(zombieLayer.group);
  const popLayer = createPopLayer(CONFIG.spawn.seed + 101);
  scene.add(popLayer.group);

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
      // Deep black glossy paint: the dusk sky shows on the roof and the bonnet.
      if (object.name === "body") {
        const paint = object.material as MeshStandardMaterial;
        paint.envMapIntensity = 3.2;
        paint.metalness = 0.6;
        paint.roughness = 0.25;
        paint.color.set(PALETTE.hearseBody);
      }
      // The windows, the chrome line and the curtains must read in the dusk light.
      const material = object.material as MeshStandardMaterial;
      if (object.name === "window") {
        material.envMapIntensity = 4;
        material.emissive.set("#1C1E22");
        material.emissiveIntensity = 0.6;
      } else if (object.name === "chrome") {
        material.envMapIntensity = 3;
        material.emissive.set("#5A5A5A");
      } else if (object.name === "curtain") {
        material.emissive.set("#E8E0CF");
        material.emissiveIntensity = 0.3;
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
  /** The followed camera place, without the shake. */
  const base = new Vector3();
  let shakeAmplitude = 0;
  let shakeSeconds = 0;
  let shakeLeft = 0;
  let shakeClock = 0;
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

  /** The camera is at the base place plus a small, fast shake that fades out. */
  function pointCamera(frameSeconds: number): void {
    camera.position.copy(base);
    if (shakeLeft > 0) {
      shakeClock += frameSeconds;
      shakeLeft = Math.max(0, shakeLeft - frameSeconds);
      const fade = shakeLeft / shakeSeconds;
      camera.position.y += shakeAmplitude * fade * Math.sin(shakeClock * 90);
      camera.position.x += shakeAmplitude * fade * Math.cos(shakeClock * 70);
    }
    camera.lookAt(focus);
    sky.position.copy(camera.position);
  }

  function update(
    state: HearseState,
    zombies: readonly Zombie[],
    frameSeconds: number,
  ): void {
    placeHearse(state, frameSeconds);
    popLayer.update(frameSeconds);
    zombieLayer.update(zombies, frameSeconds, popLayer.squashed());
    wanted.copy(anchor).add(offset);
    const k = 1 - Math.exp(-CONFIG.camera.follow * Math.max(0, frameSeconds));
    base.lerp(wanted, k);
    pointCamera(Math.max(0, frameSeconds));
  }

  function shake(amplitude: number, seconds: number): void {
    shakeAmplitude = amplitude;
    shakeSeconds = Math.max(seconds, 1e-3);
    shakeLeft = seconds;
  }

  function snap(state: HearseState): void {
    placeHearse(state, 0);
    base.copy(anchor).add(offset);
    shakeLeft = 0;
    pointCamera(0);
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
  return {
    scene,
    camera,
    loaded,
    update,
    pop: popLayer.hit,
    shake,
    snap,
    resize,
  };
}
