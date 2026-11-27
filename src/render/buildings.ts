import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Shape,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import { CONFIG } from "../config";
import type { Box } from "../logic/collision";
import type { CemeteryMap, LightpostPlacement } from "../logic/map";
import { createRandom } from "../logic/random";
import { GeometryBatch, mixColor } from "./geometry";
import { patches, type Spot } from "./glow";
import { PALETTE } from "./palette";

/**
 * The buildings of the game scene, built from simple shapes with vertex colours: the dark red
 * brick chapel with a steep roof and a bell tower, the red-brick wall with pillars and caps,
 * the wrought-iron gate with lamps, and the iron lamp posts with warm glass heads.
 */

const WALL_HEIGHT = 1.7;
const WALL_THICKNESS = 0.55;
const WALL_STEP = 4;
const PILLAR_SIZE = 0.8;
const PILLAR_HEIGHT = 2.2;

export interface Buildings {
  group: Group;
  /** Real warm lights: two at the chapel door and two at the gate lamps. */
  lights: PointLight[];
}

/** A tall arch shape that faces +z (front) or +x (side): a box with a half-round top. */
function archShape(
  batch: GeometryBatch,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  color: string,
  side: "front" | "side",
  depth = 0.12,
): void {
  const turn = side === "side" ? Math.PI / 2 : 0;
  const straight = height - width / 2;
  batch.add(new BoxGeometry(width, straight, depth), {
    x,
    y: y + straight / 2,
    z,
    turn,
    color,
  });
  const top = new CylinderGeometry(
    width / 2,
    width / 2,
    depth,
    10,
    1,
    false,
    0,
    Math.PI,
  );
  top.rotateX(Math.PI / 2);
  top.rotateZ(Math.PI / 2);
  batch.add(top, { x, y: y + straight, z, turn, color });
}

function gable(width: number, height: number, depth: number): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

function addChapel(
  map: CemeteryMap,
  scenery: GeometryBatch,
  glow: GeometryBatch,
): void {
  const { x: cx, z: cz, width: w, depth: d } = map.chapel;
  const front = cz + d / 2;
  const back = cz - d / 2;
  const wallHeight = 3.7;
  const rise = 3.4;
  const brick = PALETTE.chapelBrick;
  const brickDark = mixColor(brick, "#000000", 0.18);

  scenery.add(new BoxGeometry(w + 0.4, 0.45, d + 0.4), {
    x: cx,
    y: 0.225,
    z: cz,
    color: PALETTE.stoneBase,
  });
  scenery.add(new BoxGeometry(w, wallHeight - 0.45, d), {
    x: cx,
    y: 0.45 + (wallHeight - 0.45) / 2,
    z: cz,
    color: brick,
  });
  // Thin mortar lines: one every 0.3 m, a subtle brick pattern.
  const mortar = mixColor(brick, "#000000", 0.3);
  for (let y = 0.7; y < wallHeight - 0.4; y += 0.3) {
    scenery.add(new BoxGeometry(w + 0.03, 0.035, d + 0.03), {
      x: cx,
      y,
      z: cz,
      color: mortar,
    });
  }
  // Darker brick band under the eaves, and stone corner blocks.
  scenery.add(new BoxGeometry(w + 0.08, 0.25, d + 0.08), {
    x: cx,
    y: wallHeight - 0.2,
    z: cz,
    color: brickDark,
  });
  for (const sx of [-1, 1]) {
    for (const z of [front, back]) {
      scenery.add(new BoxGeometry(0.34, wallHeight - 0.4, 0.34), {
        x: cx + sx * (w / 2),
        y: 0.45 + (wallHeight - 0.4) / 2,
        z: z - Math.sign(z - cz) * 0.02,
        color: PALETTE.stoneBase,
      });
    }
  }

  // Steep dark roof: two slabs, brick gable ends, a ridge cap.
  const half = w / 2;
  const length = Math.hypot(half, rise);
  const slab = length + 0.6;
  const angle = Math.atan2(rise, half);
  const dirX = half / length;
  const dirY = -rise / length;
  const normalX = rise / length;
  const normalY = half / length;
  for (const side of [-1, 1]) {
    const reach = slab / 2 - 0.15;
    scenery.add(new BoxGeometry(slab, 0.2, d + 1.0), {
      x: cx + side * (dirX * reach + normalX * 0.1),
      y: wallHeight + rise + dirY * reach + normalY * 0.1,
      z: cz,
      lean: -side * angle,
      color: PALETTE.chapelRoofDark,
    });
  }
  scenery.add(new BoxGeometry(0.34, 0.18, d + 1.1), {
    x: cx,
    y: wallHeight + rise + 0.2,
    z: cz,
    color: "#1D191B",
  });
  scenery.add(gable(w, rise, 0.35), {
    x: cx,
    y: wallHeight,
    z: front - 0.35,
    color: brick,
  });
  scenery.add(gable(w, rise, 0.35), {
    x: cx,
    y: wallHeight,
    z: back,
    color: brick,
  });

  // Bell tower on the front of the ridge: brick, open arches, a spire and a cross.
  const towerZ = front - 1.5;
  const towerBase = wallHeight + rise - 0.5;
  const towerHeight = 2.3;
  scenery.add(new BoxGeometry(1.7, towerHeight, 1.7), {
    x: cx,
    y: towerBase + towerHeight / 2,
    z: towerZ,
    color: brick,
  });
  scenery.add(new BoxGeometry(1.95, 0.18, 1.95), {
    x: cx,
    y: towerBase + towerHeight + 0.09,
    z: towerZ,
    color: PALETTE.stoneBase,
  });
  scenery.add(new ConeGeometry(1.35, 2.7, 4), {
    x: cx,
    y: towerBase + towerHeight + 0.18 + 1.35,
    z: towerZ,
    turn: Math.PI / 4,
    color: PALETTE.chapelRoofDark,
  });
  const crossBase = towerBase + towerHeight + 0.18 + 2.7;
  scenery.add(new BoxGeometry(0.1, 1.0, 0.1), {
    x: cx,
    y: crossBase + 0.4,
    z: towerZ,
    color: PALETTE.iron,
  });
  scenery.add(new BoxGeometry(0.5, 0.1, 0.1), {
    x: cx,
    y: crossBase + 0.6,
    z: towerZ,
    color: PALETTE.iron,
  });
  archShape(
    glow,
    cx,
    towerBase + 0.55,
    towerZ + 0.86,
    0.7,
    1.2,
    PALETTE.candle,
    "front",
    0.06,
  );
  for (const side of [-1, 1]) {
    archShape(
      glow,
      cx + side * 0.86,
      towerBase + 0.55,
      towerZ,
      0.7,
      1.2,
      PALETTE.candle,
      "side",
      0.06,
    );
  }

  // Door with a stone arch around it, warm light inside, and two steps.
  archShape(
    scenery,
    cx,
    0.4,
    front + 0.01,
    2.0,
    3.0,
    PALETTE.stoneBase,
    "front",
    0.1,
  );
  archShape(
    glow,
    cx,
    0.45,
    front + 0.07,
    1.5,
    2.6,
    PALETTE.horizonGlowWarm,
    "front",
    0.06,
  );
  scenery.add(new BoxGeometry(0.1, 2.0, 0.08), {
    x: cx,
    y: 1.45,
    z: front + 0.12,
    color: PALETTE.iron,
  });
  scenery.add(new BoxGeometry(2.6, 0.18, 1.0), {
    x: cx,
    y: 0.09,
    z: front + 0.5,
    color: PALETTE.stoneBase,
  });
  scenery.add(new BoxGeometry(2.2, 0.18, 0.7), {
    x: cx,
    y: 0.27,
    z: front + 0.2,
    color: PALETTE.stoneBase,
  });

  // Tall arched windows with warm light, front and sides.
  for (const side of [-1, 1]) {
    archShape(
      scenery,
      cx + side * 2.15,
      1.5,
      front + 0.01,
      0.95,
      2.2,
      PALETTE.stoneBase,
      "front",
      0.1,
    );
    archShape(
      glow,
      cx + side * 2.15,
      1.58,
      front + 0.07,
      0.65,
      1.9,
      PALETTE.candle,
      "front",
      0.06,
    );
    for (const dz of [-2.6, 0, 2.6]) {
      archShape(
        scenery,
        cx + side * (w / 2 + 0.01),
        1.5,
        cz + dz,
        0.95,
        2.2,
        PALETTE.stoneBase,
        "side",
        0.1,
      );
      archShape(
        glow,
        cx + side * (w / 2 + 0.07),
        1.58,
        cz + dz,
        0.65,
        1.9,
        PALETTE.candle,
        "side",
        0.06,
      );
    }
  }
}

function addWalls(map: CemeteryMap, scenery: GeometryBatch): void {
  const random = createRandom(CONFIG.map.seed + 7);
  const gateHalf = CONFIG.map.gateWidth / 2;
  const line = (box: Box): void => {
    const alongX = box.maxX - box.minX > box.maxZ - box.minZ;
    const length = alongX ? box.maxX - box.minX : box.maxZ - box.minZ;
    const cx = (box.minX + box.maxX) / 2;
    const cz = (box.minZ + box.maxZ) / 2;
    const count = Math.max(1, Math.round(length / 1.5));
    const piece = length / count;
    for (let i = 0; i < count; i += 1) {
      const along = -length / 2 + (i + 0.5) * piece;
      const x = alongX ? cx + along : cx;
      const z = alongX ? cz : cz + along;
      const sx = alongX ? piece : WALL_THICKNESS;
      const sz = alongX ? WALL_THICKNESS : piece;
      // Three brick courses with a little colour change, and a stone cap.
      const courses = [0.6, 0.55, 0.5];
      let y = 0;
      for (const height of courses) {
        scenery.add(new BoxGeometry(sx, height, sz), {
          x,
          y: y + height / 2,
          z,
          color: mixColor(
            PALETTE.brickDark,
            PALETTE.brick,
            random(),
          ).multiplyScalar(0.85 + random() * 0.2),
        });
        y += height;
      }
      scenery.add(
        new BoxGeometry(
          sx + (alongX ? 0 : 0.14),
          0.1,
          sz + (alongX ? 0.14 : 0),
        ),
        {
          x,
          y: WALL_HEIGHT - 0.05 + 0.1,
          z,
          color: PALETTE.stoneCap,
        },
      );
    }
    // Pillars at a regular step, with a stone cap.
    const pillars = Math.max(1, Math.round(length / WALL_STEP));
    for (let i = 0; i <= pillars; i += 1) {
      const along = -length / 2 + (i * length) / pillars;
      const x = alongX ? cx + along : cx;
      const z = alongX ? cz : cz + along;
      if (Math.abs(x) < gateHalf + 1 && z > 0) {
        continue;
      }
      pillar(scenery, x, z, PILLAR_SIZE, PILLAR_HEIGHT, random);
    }
  };
  for (const wall of map.walls) {
    line(wall);
  }
}

function pillar(
  scenery: GeometryBatch,
  x: number,
  z: number,
  size: number,
  height: number,
  random: () => number,
): void {
  scenery.add(new BoxGeometry(size + 0.12, 0.35, size + 0.12), {
    x,
    y: 0.175,
    z,
    color: PALETTE.stoneBase,
  });
  scenery.add(new BoxGeometry(size, height - 0.5, size), {
    x,
    y: 0.35 + (height - 0.5) / 2,
    z,
    color: mixColor(PALETTE.brickDark, PALETTE.brick, random()),
  });
  scenery.add(new BoxGeometry(size + 0.22, 0.14, size + 0.22), {
    x,
    y: height - 0.07,
    z,
    color: PALETTE.stoneCap,
  });
  scenery.add(new ConeGeometry(size * 0.55, 0.28, 4), {
    x,
    y: height + 0.14,
    z,
    turn: Math.PI / 4,
    color: PALETTE.stoneCap,
  });
}

/** The closed wrought-iron gate between two tall brick pillars with lamps. */
function addGate(
  map: CemeteryMap,
  scenery: GeometryBatch,
  glow: GeometryBatch,
): Spot[] {
  const gateHalf = CONFIG.map.gateWidth / 2;
  const z = (map.gate.minZ + map.gate.maxZ) / 2;
  const random = createRandom(CONFIG.map.seed + 9);
  const lamps: Spot[] = [];
  for (const side of [-1, 1]) {
    const x = side * (gateHalf + 0.3);
    pillar(scenery, x, z, 1.0, 3.0, random);
    // Lamp on the pillar: iron foot, warm glass, iron roof.
    const top = 3.0 + 0.28;
    scenery.add(new BoxGeometry(0.5, 0.08, 0.5), {
      x,
      y: top + 0.04,
      z,
      color: PALETTE.iron,
    });
    glow.add(new BoxGeometry(0.36, 0.5, 0.36), {
      x,
      y: top + 0.33,
      z,
      color: PALETTE.headlight,
    });
    scenery.add(new ConeGeometry(0.38, 0.3, 4), {
      x,
      y: top + 0.73,
      z,
      turn: Math.PI / 4,
      color: PALETTE.iron,
    });
    lamps.push({ x, y: top + 0.33, z, size: 0 });
  }
  // Two gate leaves of tall bars with spear tips, rails and a scroll ring.
  for (const side of [-1, 1]) {
    const leaf = gateHalf;
    const height = 2.3;
    const centre = side * (leaf / 2);
    for (const y of [0.25, 1.1, height - 0.1]) {
      scenery.add(new BoxGeometry(leaf, 0.07, 0.07), {
        x: centre,
        y,
        z,
        color: PALETTE.iron,
      });
    }
    const bars = 10;
    for (let i = 0; i <= bars; i += 1) {
      const x = side * ((i * leaf) / bars);
      scenery.add(new BoxGeometry(0.045, height, 0.045), {
        x,
        y: height / 2,
        z,
        color: PALETTE.iron,
      });
      scenery.add(new ConeGeometry(0.06, 0.2, 4), {
        x,
        y: height + 0.1,
        z,
        color: PALETTE.iron,
      });
    }
  }
  return lamps;
}

/** Iron lamp posts with a warm glass head. Slim, so they do not hide the near view. */
function addLampPosts(
  posts: readonly LightpostPlacement[],
  scenery: GeometryBatch,
  glow: GeometryBatch,
): Spot[] {
  const pools: Spot[] = [];
  for (const post of posts) {
    // The lamps near the gate are low: they are close to the camera and must not hide the view.
    const height = post.lit ? 2.5 : 1.0;
    scenery.add(new CylinderGeometry(0.17, 0.22, 0.3, 6), {
      x: post.x,
      y: 0.15,
      z: post.z,
      color: PALETTE.iron,
    });
    scenery.add(new CylinderGeometry(0.06, 0.09, height, 6), {
      x: post.x,
      y: height / 2,
      z: post.z,
      color: PALETTE.iron,
    });
    scenery.add(new BoxGeometry(0.44, 0.07, 0.44), {
      x: post.x,
      y: height,
      z: post.z,
      color: PALETTE.iron,
    });
    glow.add(new BoxGeometry(0.35, 0.45, 0.35), {
      x: post.x,
      y: height + 0.28,
      z: post.z,
      color: PALETTE.headlight,
    });
    scenery.add(new ConeGeometry(0.34, 0.24, 4), {
      x: post.x,
      y: height + 0.62,
      z: post.z,
      turn: Math.PI / 4,
      color: PALETTE.iron,
    });
    scenery.add(new SphereGeometry(0.04, 5, 4), {
      x: post.x,
      y: height + 0.78,
      z: post.z,
      color: PALETTE.iron,
    });
    pools.push({ x: post.x, y: 0.045, z: post.z, size: post.lit ? 7 : 4.5 });
  }
  return pools;
}

export function buildBuildings(map: CemeteryMap): Buildings {
  const group = new Group();
  group.name = "buildings";
  const scenery = new GeometryBatch();
  const glow = new GeometryBatch();
  addWalls(map, scenery);
  const gateLamps = addGate(map, scenery, glow);
  const lampPools = addLampPosts(map.lightposts, scenery, glow);

  // The chapel is its own mesh: it casts a shadow.
  const chapelScenery = new GeometryBatch();
  addChapel(map, chapelScenery, glow);
  const chapel = new Mesh(
    chapelScenery.build(),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
    }),
  );
  chapel.name = "chapel";
  chapel.castShadow = true;
  chapel.receiveShadow = true;

  const buildings = new Mesh(
    scenery.build(),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      flatShading: true,
    }),
  );
  buildings.name = "walls";
  const lit = new Mesh(
    glow.build(),
    new MeshBasicMaterial({ vertexColors: true }),
  );
  lit.name = "lit";
  group.add(chapel, buildings, lit);

  const doorZ = map.chapel.z + map.chapel.depth / 2;
  const pools: Spot[] = [
    ...lampPools,
    // Light spilled by the door and windows on the plaza.
    { x: map.chapel.x, y: 0.045, z: doorZ + 2.5, size: 8 },
    ...gateLamps.map((lamp) => ({
      x: lamp.x,
      y: 0.045,
      z: lamp.z - 2,
      size: 6,
    })),
  ];
  const glowPools = patches(pools, {
    color: PALETTE.candleGlow,
    opacity: 0.5,
    additive: true,
    power: 1.8,
  });
  glowPools.name = "light-pools";
  group.add(glowPools);

  const lights: PointLight[] = [];
  for (const side of [-1, 1]) {
    const light = new PointLight(PALETTE.candle, 7, 12, 2);
    light.position.set(map.chapel.x + side * 2.4, 1.8, doorZ + 1.6);
    lights.push(light);
  }
  for (const lamp of gateLamps) {
    const light = new PointLight(PALETTE.candle, 10, 12, 2);
    light.position.set(lamp.x, 3.2, lamp.z - 1.2);
    lights.push(light);
  }
  group.add(...lights);
  return { group, lights };
}
