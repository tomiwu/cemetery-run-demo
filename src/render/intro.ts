import {
  AmbientLight,
  BackSide,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  Vector3,
  AdditiveBlending,
} from "three";
import { sampleIntro } from "../logic/intro";
import { addChapel, addGraves, addTrees } from "./cemetery";
import { addGate, addWalls } from "./gate";
import { GeometryBatch, mixColor, seeded, smoothstep } from "./geometry";
import { buildHearse } from "./hearse";
import { PALETTE } from "./palette";
import {
  CEMETERY,
  GATE_Z,
  groundGeometry,
  heightAt,
  riverGeometry,
  roadCentre,
  roadGeometry,
} from "./terrain";

/** Vertical view angle, and the narrowest side-to-side view angle, in degrees. */
const BASE_FOV = 55;
const WIDE_FOV = 70;
const MAX_FOV = 90;

const SKY_RADIUS = 200;
/** The view looks a little ahead of the hearse, toward the chapel on the hill. */
const LOOK_AHEAD = new Vector3(0, CEMETERY.height + 3.5, 44);

/**
 * Sky gradient (VISUAL_REFERENCE.md): warm amber at the horizon, mauve in the middle,
 * blue-grey high. With only `low` and `high` it is a plain two-colour gradient.
 */
export function skyDome(
  low: Color,
  high: Color,
  spread = 0.55,
  mid?: Color,
  glow?: Color,
): Mesh {
  const geometry = new SphereGeometry(SKY_RADIUS, 20, 12);
  const position = geometry.getAttribute("position");
  const colors: number[] = [];
  const color = new Color();
  const stops: readonly (readonly [number, Color])[] =
    mid === undefined && glow === undefined
      ? [
          [0, low],
          [1, high],
        ]
      : [
          [0, low],
          [0.26, glow ?? low],
          [0.5, mid ?? high],
          [1, high],
        ];
  for (let i = 0; i < position.count; i += 1) {
    const height = Math.max(0, position.getY(i) / SKY_RADIUS);
    const p = Math.min(1, Math.pow(height / spread, 0.7));
    let index = 0;
    while (index < stops.length - 2 && p > (stops[index + 1]?.[0] ?? 1)) {
      index += 1;
    }
    const from = stops[index];
    const to = stops[index + 1];
    if (from === undefined || to === undefined) {
      throw new Error("The sky needs two colours.");
    }
    const k = Math.min(1, Math.max(0, (p - from[0]) / (to[0] - from[0])));
    color.copy(from[1]).lerp(to[1], k);
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

/** Soft flat clouds in the sky, one draw call. They are children of the sky dome. */
function clouds(): Mesh {
  const random = seeded(11);
  const batch = new GeometryBatch();
  const shape = new SphereGeometry(1, 8, 5);
  for (let i = 0; i < 12; i += 1) {
    const azimuth = (random() - 0.5) * 2.6;
    const elevation = 0.18 + random() * 0.5;
    const radius = SKY_RADIUS * 0.93;
    batch.add(shape, {
      x: radius * Math.cos(elevation) * Math.sin(azimuth),
      y: radius * Math.sin(elevation),
      z: radius * Math.cos(elevation) * Math.cos(azimuth),
      scale: [20 + random() * 26, 2.2 + random() * 1.8, 6 + random() * 5],
      turn: azimuth,
      color: mixColor(
        PALETTE.skyMiddle,
        PALETTE.horizonGlow,
        0.45 - elevation * 0.5,
      ),
    });
  }
  const mesh = new Mesh(
    batch.build(),
    new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      fog: false,
    }),
  );
  mesh.name = "clouds";
  return mesh;
}

export interface IntroScene {
  scene: Scene;
  camera: PerspectiveCamera;
  /** Resolves when the scene is ready. All shapes are built in code, so this is at once. */
  loaded: Promise<void>;
  /** Put the hearse and the camera where they are at `progress` (0..1). */
  update: (progress: number) => void;
  resize: (width: number, height: number) => void;
}

export function createIntroScene(): IntroScene {
  const scene = new Scene();
  scene.background = new Color(PALETTE.haze);
  scene.fog = new Fog(PALETTE.haze, 50, 235);

  const camera = new PerspectiveCamera(BASE_FOV, 1, 0.3, 450);
  const sky = skyDome(
    new Color(PALETTE.haze),
    new Color(PALETTE.skyTop),
    0.62,
    new Color(PALETTE.skyMiddle),
    new Color(PALETTE.horizonGlow),
  );
  sky.add(clouds());
  scene.add(sky);

  const land = new Mesh(
    groundGeometry(),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    }),
  );
  land.name = "ground";
  scene.add(land);
  const road = new Mesh(
    roadGeometry(),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    }),
  );
  road.name = "road";
  scene.add(road);
  const river = new Mesh(
    riverGeometry(),
    new MeshBasicMaterial({ vertexColors: true }),
  );
  river.name = "river";
  scene.add(river);

  // Trees, chapel, headstones, walls and gate: one mesh with vertex colours.
  const scenery = new GeometryBatch();
  const glow = new GeometryBatch();
  addTrees(scenery);
  addWalls(scenery);
  addGate(scenery, glow);
  addChapel(scenery, glow);
  const candles = addGraves(scenery);
  const buildings = new Mesh(
    scenery.build(),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
    }),
  );
  buildings.name = "scenery";
  scene.add(buildings);
  // Lanterns, windows and the door give their own warm light.
  const lit = new Mesh(
    glow.build(),
    new MeshBasicMaterial({ vertexColors: true }),
  );
  lit.name = "lit";
  scene.add(lit);

  // Many small candle lights: instanced emissive points and soft halos. No real lights.
  const flames = new InstancedMesh(
    new SphereGeometry(0.17, 6, 4),
    new MeshBasicMaterial({ color: PALETTE.candle }),
    candles.length,
  );
  flames.name = "candles";
  const halos = new InstancedMesh(
    new SphereGeometry(0.5, 8, 6),
    new MeshBasicMaterial({
      color: PALETTE.candleGlow,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    candles.length,
  );
  halos.name = "candle-glow";
  const place = new Matrix4();
  candles.forEach((candle, i) => {
    place.makeTranslation(candle.x, candle.y, candle.z);
    flames.setMatrixAt(i, place);
    place.makeTranslation(candle.x, candle.y + 0.1, candle.z);
    halos.setMatrixAt(i, place);
  });
  scene.add(flames, halos);

  // Light: dim cool sky, a low warm sun at the horizon, a cool fill, one warm lamp at the gate.
  scene.add(new AmbientLight(0x8d86a8, 1.0));
  scene.add(new HemisphereLight(0xc9b8c0, 0x4a3f33, 1.8));
  const sun = new DirectionalLight(0xffb36b, 1.3);
  sun.position.set(-60, 8, 100);
  scene.add(sun);
  const moon = new DirectionalLight(0x8fa4d8, 0.7);
  moon.position.set(30, 50, -40);
  scene.add(moon);
  const lamp = new PointLight(PALETTE.horizonGlowWarm, 60, 28, 2);
  lamp.position.set(0, CEMETERY.height + 4, GATE_Z + 2);
  scene.add(lamp);

  const hearse = buildHearse();
  hearse.group.rotation.order = "YXZ";
  scene.add(hearse.group);
  hearse.headlights.intensity = 170;
  const startZ = sampleIntro(0).hearse.z;

  const look = new Vector3();

  function update(progress: number): void {
    const sample = sampleIntro(progress);
    // The road winds: the hearse follows it. The keyframes stay straight data.
    const bend = roadCentre(sample.hearse.z);
    const slope =
      (roadCentre(sample.hearse.z + 1) - roadCentre(sample.hearse.z - 1)) / 2;
    const x = sample.hearse.x + bend;
    const z = sample.hearse.z;
    const heading = sample.hearse.heading + Math.atan(slope);
    const ground = heightAt(x, z);
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    const rise =
      heightAt(x + sin * 1.8, z + cos * 1.8) -
      heightAt(x - sin * 1.8, z - cos * 1.8);
    hearse.group.position.set(x, ground + 0.02, z);
    hearse.group.rotation.y = heading;
    hearse.group.rotation.x = -Math.atan(rise / 3.6);
    const spin = (z - startZ) / hearse.wheelRadius;
    for (const wheel of hearse.wheels) {
      wheel.rotation.x = spin;
    }
    camera.position.set(
      sample.camera.x + bend,
      sample.camera.y + ground,
      sample.camera.z,
    );
    look
      .set(x, ground + 1.2, z)
      .lerp(LOOK_AHEAD, 0.16 - 0.1 * smoothstep(0.7, 1, progress));
    camera.lookAt(look);
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
  return { scene, camera, loaded: Promise.resolve(), update, resize };
}
