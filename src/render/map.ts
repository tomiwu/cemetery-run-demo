import {
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Material,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRandom } from "../logic/random";
import type { CemeteryMap } from "../logic/map";
import { CONFIG } from "../config";
import { PALETTE } from "./palette";

/**
 * Draws the cemetery map (`src/logic/map.ts`) with the Kenney models. Every repeated model is one
 * InstancedMesh, so the whole map is a few dozen draw calls. Only the chapel casts a shadow.
 */

const STONES = [
  "gravestone-round",
  "gravestone-cross",
  "gravestone-bevel",
  "gravestone-wide",
  "gravestone-decorative",
  "gravestone-broken",
  "cross",
] as const;
const PINES = ["pine", "pine-crooked", "pine-fall"] as const;

const STONE_SCALE = 1.8;
const PINE_SCALE = 3.4;
const WALL_SCALE = 2;
const WALL_PIECE = 1;
const COLUMN_SCALE = [0.9, 2.4, 2.4] as const;
const GATE_SCALE = [3, 2.4, 2.4] as const;
/** Local offset that moves the centre line of a wall model to the origin. */
const WALL_CENTRE_Z = 0.4;
const GATE_CENTRE_Z = 0.325;
const LAMP_SCALE = 2.2;
const PUMPKIN_SCALE = 2.5;
const CHAPEL_MODEL_WIDTH = 1.86;
const CHAPEL_MODEL_HEIGHT = 1;
/** Lamp position on the lightpost model, before scale. */
const LAMP = new Vector3(0, 1.17, 0.3);
const LAMP_LIGHT = { intensity: 14, distance: 14, decay: 2 } as const;

/**
 * How a model looks. The Kenney palette is bright, so each model is either drawn with a solid
 * palette colour, or keeps its texture with less colour and a tint (night mood).
 */
interface Style {
  /** Solid colour. The texture is not used. */
  solid?: string;
  /** Tint that multiplies the texture colour. */
  tint?: string;
  /** Share of the texture colour that stays (0 = grey, 1 = unchanged). */
  saturation?: number;
  /** Warm glow that does not need light. */
  glow?: string;
}

const STONE_STYLE: Style = { tint: "#A99DA0", saturation: 0.12 };
const PINE_STYLE: Style = { tint: "#6B7458", saturation: 0.45 };
const STYLES: Record<string, Style> = {
  grave: { solid: PALETTE.graveBorder },
  "grave-border": { tint: "#8A7E78", saturation: 0.3 },
  pine: PINE_STYLE,
  "pine-crooked": PINE_STYLE,
  "pine-fall": PINE_STYLE,
  "stone-wall": { solid: PALETTE.brickDark },
  "stone-wall-column": { solid: PALETTE.brick },
  "iron-fence-border-gate": { solid: PALETTE.iron },
  "lightpost-single": { solid: PALETTE.iron },
  "crypt-large": { solid: PALETTE.brick },
  "crypt-large-roof": { solid: PALETTE.chapelRoof },
  "crypt-large-door": {
    solid: PALETTE.horizonGlowWarm,
    glow: PALETTE.horizonGlowWarm,
  },
  "pumpkin-carved": { tint: "#C0A080", saturation: 0.8 },
};

/** A copy of the material in the style of the night scene. */
function styled(source: Material, name: string): Material {
  const style = STYLES[name] ?? STONE_STYLE;
  if (!(source instanceof MeshStandardMaterial)) {
    return source;
  }
  const material = source.clone();
  material.roughness = 1;
  material.metalness = 0;
  if (style.solid !== undefined) {
    material.map = null;
    material.color.set(style.solid);
    material.flatShading = true;
  } else {
    material.color.set(style.tint ?? "#FFFFFF");
    const saturation = (style.saturation ?? 1).toFixed(3);
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float grey = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(grey), diffuseColor.rgb, ${saturation});`,
      );
    };
    material.customProgramCacheKey = () => `grade-${saturation}`;
  }
  if (style.glow !== undefined) {
    material.emissive.set(style.glow);
    material.emissiveIntensity = 0.6;
  }
  return material;
}

interface Instance {
  model: string;
  matrix: Matrix4;
  /** The instances of this model cast a shadow. */
  shadow?: boolean;
}

const UP = new Vector3(0, 1, 0);

/** Matrix for a placed model: position, turn around y, scale, then a local offset. */
function placed(
  x: number,
  y: number,
  z: number,
  turn: number,
  scale: number | readonly [number, number, number],
  offset: readonly [number, number, number] = [0, 0, 0],
): Matrix4 {
  const s =
    typeof scale === "number"
      ? new Vector3(scale, scale, scale)
      : new Vector3(scale[0], scale[1], scale[2]);
  const base = new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromAxisAngle(UP, turn),
    s,
  );
  return base.multiply(
    new Matrix4().makeTranslation(offset[0], offset[1], offset[2]),
  );
}

export interface MapScene {
  group: Group;
  /** Resolves when all models are in the scene. */
  loaded: Promise<void>;
  /** Real point lights at the lightposts. */
  lights: PointLight[];
}

/** One flat strip for each road rectangle, in one mesh. */
function roadsMesh(map: CemeteryMap): Mesh {
  const strips = map.roads.map((road, index) => {
    const strip = new PlaneGeometry(
      road.maxX - road.minX,
      road.maxZ - road.minZ,
    ).toNonIndexed();
    strip.rotateX(-Math.PI / 2);
    // A tiny height step avoids flicker where the strips overlap.
    strip.translate(
      (road.minX + road.maxX) / 2,
      0.02 + index * 0.0005,
      (road.minZ + road.maxZ) / 2,
    );
    strip.deleteAttribute("uv");
    return strip;
  });
  const mesh = new Mesh(
    mergeGeometries(strips, false),
    new MeshStandardMaterial({
      color: PALETTE.mapRoad,
      roughness: 1,
      flatShading: true,
    }),
  );
  mesh.name = "roads";
  mesh.receiveShadow = true;
  return mesh;
}

function instances(map: CemeteryMap): Instance[] {
  const list: Instance[] = [];
  const halfWidth = map.bounds.maxX;
  const halfLength = map.bounds.maxZ;
  const wall = CONFIG.map.wallThickness;

  for (const grave of map.graves) {
    list.push({
      model: STONES[grave.variant % STONES.length] ?? "gravestone-round",
      matrix: placed(grave.x, 0, grave.z, grave.turn, STONE_SCALE),
    });
    list.push({
      model: grave.border ? "grave-border" : "grave",
      matrix: placed(
        grave.x,
        0,
        grave.z,
        grave.turn,
        STONE_SCALE,
        [0, 0, 0.65],
      ),
    });
  }
  for (const tree of map.trees) {
    list.push({
      model: PINES[tree.variant % PINES.length] ?? "pine",
      matrix: placed(tree.x, 0, tree.z, tree.turn, PINE_SCALE),
    });
  }
  for (const pumpkin of map.pumpkins) {
    list.push({
      model: "pumpkin-carved",
      matrix: placed(pumpkin.x, 0, pumpkin.z, pumpkin.turn, PUMPKIN_SCALE),
    });
  }
  for (const post of map.lightposts) {
    list.push({
      model: "lightpost-single",
      matrix: placed(post.x, 0, post.z, post.turn, LAMP_SCALE),
    });
  }

  // Walls: pieces along each line, a column at the ends and at every fourth joint.
  const column = (x: number, z: number, turn: number): void => {
    list.push({
      model: "stone-wall-column",
      matrix: placed(x, 0, z, turn, COLUMN_SCALE, [0, 0, WALL_CENTRE_Z]),
    });
  };
  const line = (x0: number, z0: number, x1: number, z1: number): void => {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const count = Math.ceil(length / WALL_SCALE);
    const turn = Math.atan2(-(z1 - z0), x1 - x0);
    const piece = length / count;
    for (let i = 0; i < count; i += 1) {
      const k = (i + 0.5) / count;
      list.push({
        model: "stone-wall",
        matrix: placed(
          x0 + (x1 - x0) * k,
          0,
          z0 + (z1 - z0) * k,
          turn,
          [piece / WALL_PIECE, WALL_SCALE, WALL_SCALE],
          [0, 0, WALL_CENTRE_Z],
        ),
      });
    }
    for (let i = 0; i <= count; i += 4) {
      const k = i / count;
      column(x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, turn);
    }
    if (count % 4 !== 0) {
      column(x1, z1, turn);
    }
  };
  const outX = halfWidth + wall / 2;
  const northZ = -halfLength - wall / 2;
  const southZ = halfLength + wall / 2;
  const gateEdge = CONFIG.map.gateWidth / 2 + 0.5;
  line(-outX, northZ, outX, northZ);
  line(-outX, northZ, -outX, southZ);
  line(outX, northZ, outX, southZ);
  line(-outX, southZ, -gateEdge, southZ);
  line(gateEdge, southZ, outX, southZ);

  // The closed iron gate, two leaves of 3 m.
  for (const side of [-1, 1]) {
    list.push({
      model: "iron-fence-border-gate",
      matrix: placed(side * 1.5, 0, southZ, 0, GATE_SCALE, [
        0,
        0,
        GATE_CENTRE_Z,
      ]),
    });
  }

  // The chapel: crypt, roof and door, facing the gate.
  const scale = map.chapel.width / CHAPEL_MODEL_WIDTH;
  const doorZ = map.chapel.z + map.chapel.depth / 2;
  list.push({
    model: "crypt-large",
    matrix: placed(map.chapel.x, 0, map.chapel.z, 0, scale),
    shadow: true,
  });
  list.push({
    model: "crypt-large-roof",
    matrix: placed(
      map.chapel.x,
      CHAPEL_MODEL_HEIGHT * scale,
      map.chapel.z,
      0,
      scale,
    ),
    shadow: true,
  });
  list.push({
    model: "crypt-large-door",
    matrix: placed(map.chapel.x, 0, doorZ, 0, scale),
    shadow: true,
  });

  // Trees outside the walls, for the dark backdrop. The hearse cannot reach them.
  const random = createRandom(CONFIG.map.seed + 100);
  const perimeter = 2 * (map.bounds.maxX * 2 + halfLength * 2);
  for (let i = 0; i < 46; i += 1) {
    const t = ((i + random() * 0.8) / 46) * perimeter;
    const away = 3.5 + random() * 8;
    const spot = perimeterPoint(t, halfWidth, halfLength, away);
    if (spot.z > 0 && Math.abs(spot.x) < 12) {
      continue;
    }
    list.push({
      model: PINES[i % PINES.length] ?? "pine",
      matrix: placed(
        spot.x,
        0,
        spot.z,
        random() * Math.PI * 2,
        PINE_SCALE * (0.8 + random() * 0.5),
      ),
    });
  }
  return list;
}

/** A point on a rectangle around the walls, `away` metres outside. `t` goes around from 0. */
function perimeterPoint(
  t: number,
  halfWidth: number,
  halfLength: number,
  away: number,
): { x: number; z: number } {
  const w = 2 * halfWidth;
  const l = 2 * halfLength;
  if (t < w) {
    return { x: -halfWidth + t, z: -halfLength - away };
  }
  if (t < w + l) {
    return { x: halfWidth + away, z: -halfLength + (t - w) };
  }
  if (t < 2 * w + l) {
    return { x: halfWidth - (t - w - l), z: halfLength + away };
  }
  return { x: -halfWidth - away, z: halfLength - (t - 2 * w - l) };
}

export function buildMapScene(map: CemeteryMap, baseUrl: string): MapScene {
  const group = new Group();
  group.name = "map";
  group.add(roadsMesh(map));

  const loader = new GLTFLoader();
  const list = instances(map);
  const byModel = new Map<string, Instance[]>();
  for (const item of list) {
    const known = byModel.get(item.model);
    if (known === undefined) {
      byModel.set(item.model, [item]);
    } else {
      known.push(item);
    }
  }

  async function addModel(name: string, items: Instance[]): Promise<void> {
    const gltf = await loader.loadAsync(`${baseUrl}assets/models/${name}.glb`);
    gltf.scene.updateMatrixWorld(true);
    const parts: {
      geometry: BufferGeometry;
      material: Material | Material[];
      local: Matrix4;
    }[] = [];
    gltf.scene.traverse((object) => {
      if (object instanceof Mesh) {
        parts.push({
          geometry: object.geometry as BufferGeometry,
          material: object.material as Material | Material[],
          local: object.matrixWorld.clone(),
        });
      }
    });
    for (const part of parts) {
      const material = Array.isArray(part.material)
        ? part.material[0]
        : part.material;
      if (material === undefined) {
        continue;
      }
      const mesh = new InstancedMesh(
        part.geometry,
        styled(material, name),
        items.length,
      );
      items.forEach((item, index) => {
        mesh.setMatrixAt(index, item.matrix.clone().multiply(part.local));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = name;
      mesh.castShadow = items.some((item) => item.shadow === true);
      group.add(mesh);
    }
  }
  const loaded = Promise.all(
    [...byModel].map(([name, items]) => addModel(name, items)),
  ).then(() => undefined);

  // Candles by the graves and lamps on the posts: emissive only, no real lights.
  const glow = new MeshBasicMaterial({ color: PALETTE.candle });
  const candles = new InstancedMesh(
    new SphereGeometry(0.13, 8, 6),
    glow,
    map.graves.length,
  );
  const spot = new Matrix4();
  map.graves.forEach((grave, index) => {
    const side = grave.x < 0 ? 1 : -1;
    spot.setPosition(grave.x + side * 0.9, 0.3, grave.z + 0.7);
    candles.setMatrixAt(index, spot);
  });
  candles.name = "candles";
  group.add(candles);

  const lampSpots = map.lightposts.map((post) => {
    const offset = LAMP.clone()
      .multiplyScalar(LAMP_SCALE)
      .applyAxisAngle(UP, post.turn);
    return {
      lit: post.lit,
      position: new Vector3(post.x, 0, post.z).add(offset),
    };
  });
  const lamps = new InstancedMesh(
    new SphereGeometry(0.2, 8, 6),
    glow,
    lampSpots.length,
  );
  lampSpots.forEach((lamp, index) => {
    spot.setPosition(lamp.position);
    lamps.setMatrixAt(index, spot);
  });
  lamps.name = "lamps";
  group.add(lamps);

  const lights: PointLight[] = [];
  for (const lamp of lampSpots) {
    if (lamp.lit) {
      const light = new PointLight(
        PALETTE.candle,
        LAMP_LIGHT.intensity,
        LAMP_LIGHT.distance,
        LAMP_LIGHT.decay,
      );
      light.position.copy(lamp.position);
      light.position.y += 0.3;
      group.add(light);
      lights.push(light);
    }
  }
  return { group, loaded, lights };
}
