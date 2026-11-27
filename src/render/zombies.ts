import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { CONFIG } from "../config";
import type { Zombie } from "../logic/zombies";
import { GeometryBatch } from "./geometry";
import { patches } from "./glow";
import { PALETTE } from "./palette";
import { zombiePose } from "./zombieLook";

/**
 * Draws the zombies (`src/logic/zombies.ts`): cartoon low-poly figures, green-grey skin, torn grey
 * and brown clothes, arms forward, a slow shambling walk. Each body part is one InstancedMesh with
 * `CONFIG.spawn.maxAlive` instances, so the whole crowd is a few draw calls. During play nothing is
 * created or destroyed: an instance that is not in use is scaled to zero.
 */

/** Height of the model as built, in metres. The drawn height is `CONFIG.zombie.height`. */
const MODEL_HEIGHT = 1.6;
const HIP_Y = 0.72;
const SHOULDER_Y = 1.2;
/** Walk cycles per second of walking. */
const STEP_RATE = 0.7;

export interface ZombieLayer {
  group: Group;
  /** Resolves when the pool is ready. The figures are built in code, so this is at once. */
  loaded: Promise<void>;
  /** Put the pool instances where the zombies are, and play the walk. */
  update: (zombies: readonly Zombie[], frameSeconds: number) => void;
}

interface Part {
  mesh: InstancedMesh;
  /** Pivot of the part on the body (hip or shoulder), or null for the body itself. */
  pivot: Vector3;
  /** What the pose does to this part. */
  move: "leg-left" | "leg-right" | "arm-left" | "arm-right" | "body";
}

function material(vertexColors = true): MeshStandardMaterial {
  return new MeshStandardMaterial({
    vertexColors,
    roughness: 0.95,
    flatShading: true,
    // A little skin-coloured self light: the figures stay readable against the dark ground.
    emissive: new Color(PALETTE.zombieSkin),
    emissiveIntensity: 0.15,
  });
}

/** Leg: trousers and a shoe. The origin is the hip. */
function legGeometry(): BufferGeometry {
  const batch = new GeometryBatch();
  batch.add(new BoxGeometry(0.2, 0.58, 0.22), {
    y: -0.29,
    color: PALETTE.zombiePants,
  });
  // A torn trouser end shows the green skin.
  batch.add(new BoxGeometry(0.16, 0.14, 0.18), {
    y: -0.62,
    color: PALETTE.zombieSkin,
  });
  batch.add(new BoxGeometry(0.22, 0.1, 0.34), {
    y: -0.67,
    z: 0.06,
    color: "#2E2A26",
  });
  return batch.build();
}

/** Arm: sleeve and a skin forearm. The origin is the shoulder. The arm points down (-y). */
function armGeometry(): BufferGeometry {
  const batch = new GeometryBatch();
  batch.add(new BoxGeometry(0.17, 0.28, 0.17), {
    y: -0.14,
    color: PALETTE.zombieShirtGrey,
  });
  batch.add(new BoxGeometry(0.14, 0.26, 0.14), {
    y: -0.41,
    color: PALETTE.zombieSkin,
  });
  batch.add(new BoxGeometry(0.17, 0.12, 0.17), { y: -0.6, color: "#7E9169" });
  return batch.build();
}

/** Torso: a shirt (white, tinted per zombie), a belt and torn hem pieces. The origin is the hip. */
function torsoGeometry(): BufferGeometry {
  const batch = new GeometryBatch();
  batch.add(new BoxGeometry(0.46, 0.5, 0.28), { y: 0.3, color: "#ffffff" });
  batch.add(new BoxGeometry(0.5, 0.1, 0.32), { y: 0.02, color: "#ffffff" });
  // Torn hem: three uneven strips.
  batch.add(new BoxGeometry(0.1, 0.18, 0.3), {
    x: -0.16,
    y: -0.08,
    color: "#e0e0e0",
  });
  batch.add(new BoxGeometry(0.12, 0.1, 0.3), {
    x: 0,
    y: -0.04,
    color: "#e0e0e0",
  });
  batch.add(new BoxGeometry(0.09, 0.22, 0.3), {
    x: 0.17,
    y: -0.1,
    color: "#e0e0e0",
  });
  // A dark patch on the chest and a torn shoulder.
  batch.add(new BoxGeometry(0.2, 0.18, 0.02), {
    x: 0.07,
    y: 0.32,
    z: 0.15,
    color: "#8a8a8a",
  });
  batch.add(new BoxGeometry(0.14, 0.12, 0.3), {
    x: -0.17,
    y: 0.5,
    color: "#9a9a9a",
  });
  return batch.build();
}

/** Head: skin, big white eyes with dark dots, a dark mouth and a few hair tufts. */
function headGeometry(): BufferGeometry {
  const batch = new GeometryBatch();
  const centre = 0.17;
  batch.add(new BoxGeometry(0.34, 0.34, 0.32), {
    y: centre,
    color: PALETTE.zombieSkin,
  });
  batch.add(new BoxGeometry(0.12, 0.05, 0.12), {
    y: 0.0,
    color: PALETTE.zombieSkin,
  });
  for (const side of [-1, 1]) {
    batch.add(new SphereGeometry(0.06, 6, 4), {
      x: side * 0.085,
      y: centre + 0.04,
      z: 0.15,
      color: "#F2EEDC",
    });
    batch.add(new SphereGeometry(0.025, 5, 4), {
      x: side * 0.085,
      y: centre + 0.04,
      z: 0.205,
      color: "#1A1A18",
    });
  }
  batch.add(new BoxGeometry(0.16, 0.04, 0.02), {
    y: centre - 0.1,
    z: 0.165,
    color: "#2A2A26",
  });
  batch.add(new BoxGeometry(0.05, 0.06, 0.04), {
    y: centre - 0.02,
    z: 0.17,
    color: "#7E9169",
  });
  batch.add(new BoxGeometry(0.2, 0.06, 0.16), {
    x: -0.05,
    y: centre + 0.2,
    z: -0.03,
    color: "#3A352F",
  });
  batch.add(new BoxGeometry(0.08, 0.1, 0.08), {
    x: 0.07,
    y: centre + 0.2,
    z: 0.02,
    color: "#3A352F",
  });
  return batch.build();
}

export function createZombieLayer(): ZombieLayer {
  const group = new Group();
  group.name = "zombies";
  const count = CONFIG.spawn.maxAlive;
  const scale = CONFIG.zombie.height / MODEL_HEIGHT;

  const make = (geometry: BufferGeometry, name: string): InstancedMesh => {
    const mesh = new InstancedMesh(geometry, material(), count);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.count = 0;
    group.add(mesh);
    return mesh;
  };
  const leg = legGeometry();
  const arm = armGeometry();
  const torso = make(torsoGeometry(), "zombie-torso");
  const head = make(headGeometry(), "zombie-head");
  const parts: Part[] = [
    { mesh: torso, pivot: new Vector3(0, HIP_Y, 0), move: "body" },
    {
      mesh: head,
      pivot: new Vector3(0, SHOULDER_Y + 0.12, 0.02),
      move: "body",
    },
    {
      mesh: make(leg, "zombie-leg-left"),
      pivot: new Vector3(0.12, HIP_Y, 0),
      move: "leg-left",
    },
    {
      mesh: make(leg, "zombie-leg-right"),
      pivot: new Vector3(-0.12, HIP_Y, 0),
      move: "leg-right",
    },
    {
      mesh: make(arm, "zombie-arm-left"),
      pivot: new Vector3(0.3, SHOULDER_Y, 0.02),
      move: "arm-left",
    },
    {
      mesh: make(arm, "zombie-arm-right"),
      pivot: new Vector3(-0.3, SHOULDER_Y, 0.02),
      move: "arm-right",
    },
  ];

  // Shirt colours: grey and brown, a little different for each zombie.
  const grey = new Color(PALETTE.zombieShirtGrey);
  const brown = new Color(PALETTE.zombieShirtBrown);
  const tint = new Color();
  for (let i = 0; i < count; i += 1) {
    tint
      .copy(i % 3 === 0 ? brown : grey)
      .multiplyScalar(0.85 + ((i * 37) % 10) / 33);
    torso.setColorAt(i, tint);
  }
  // Soft dark patches on the ground under the feet.
  const shadow = patches(
    Array.from({ length: count }, () => ({ x: 0, y: 0.05, z: 0, size: 0 })),
    { color: "#000000", opacity: 0.55, additive: false, power: 1.4 },
  );
  shadow.name = "zombie-shadows";
  group.add(shadow);
  shadow.count = 0;

  let clock = 0;
  const root = new Matrix4();
  const local = new Matrix4();
  const spin = new Quaternion();
  const axisX = new Vector3(1, 0, 0);
  const axisY = new Vector3(0, 1, 0);
  const swing = new Quaternion();
  const axisZ = new Vector3(0, 0, 1);
  const place = new Vector3();
  const unit = new Vector3(1, 1, 1);
  const flat = new Matrix4();

  function update(zombies: readonly Zombie[], frameSeconds: number): void {
    clock += Math.max(0, frameSeconds);
    const walking = zombies.filter((zombie) => zombie.state === "walking");
    const used = Math.min(walking.length, count);
    for (const part of parts) {
      part.mesh.count = used;
    }
    shadow.count = used;
    for (let i = 0; i < used; i += 1) {
      const zombie = walking[i];
      if (zombie === undefined) {
        continue;
      }
      // Each zombie has its own place in the walk cycle.
      const pose = zombiePose(clock * STEP_RATE + zombie.id * 0.37);
      spin.setFromAxisAngle(axisY, zombie.heading + pose.sway);
      root.compose(
        place.set(zombie.x, pose.bob, zombie.z),
        spin,
        unit.set(scale, scale, scale),
      );
      for (const part of parts) {
        let angle: number;
        let lean = 0;
        if (part.move === "leg-left") {
          angle = pose.legSwing;
        } else if (part.move === "leg-right") {
          angle = -pose.legSwing;
        } else if (part.move === "arm-left") {
          // Arms stretched forward, a little low, with a small swing.
          angle = -1.38 + pose.armSwing;
          lean = -0.1;
        } else if (part.move === "arm-right") {
          angle = -1.38 - pose.armSwing;
          lean = 0.1;
        } else {
          // The body leans forward a little.
          angle = 0.12;
        }
        local.compose(
          part.pivot,
          spin
            .setFromAxisAngle(axisX, angle)
            .multiply(swing.setFromAxisAngle(axisZ, lean)),
          unit.set(1, 1, 1),
        );
        part.mesh.setMatrixAt(i, local.premultiply(root));
      }
      flat.makeScale(1.1, 1, 1.1);
      flat.setPosition(zombie.x, 0.05, zombie.z);
      shadow.setMatrixAt(i, flat);
    }
    for (const part of parts) {
      part.mesh.instanceMatrix.needsUpdate = true;
    }
    shadow.instanceMatrix.needsUpdate = true;
  }

  return { group, loaded: Promise.resolve(), update };
}
