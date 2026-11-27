import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Material,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CONFIG } from "../config";
import type { Zombie } from "../logic/zombies";

/**
 * Draws the zombies (`src/logic/zombies.ts`). A fixed pool of `CONFIG.spawn.maxAlive` models is
 * made once when the model is loaded. During play nothing is created or destroyed: a zombie that
 * is not in use is only hidden.
 */

const MODEL = "character-zombie";
const WALK = "walk";
/** Cartoon green-grey. The texture keeps its pattern, with less colour (night mood). */
const SKIN_TINT = "#B4C29E";
const SKIN_SATURATION = 0.5;

export interface ZombieLayer {
  group: Group;
  /** Resolves when the pool is ready. */
  loaded: Promise<void>;
  /** Put the pool objects where the zombies are, and play the walk animation. */
  update: (zombies: readonly Zombie[], frameSeconds: number) => void;
}

interface Slot {
  object: Object3D;
  mixer: AnimationMixer;
}

/** A copy of the material in the cartoon green-grey of the night scene. */
function cartoon(source: Material): Material {
  if (!(source instanceof MeshStandardMaterial)) {
    return source;
  }
  const material = source.clone();
  material.roughness = 1;
  material.metalness = 0;
  material.color.set(SKIN_TINT);
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
        float grey = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(grey), diffuseColor.rgb, ${SKIN_SATURATION.toFixed(3)});`,
    );
  };
  material.customProgramCacheKey = () => "zombie-grade";
  return material;
}

export function createZombieLayer(baseUrl: string): ZombieLayer {
  const group = new Group();
  group.name = "zombies";
  const slots: Slot[] = [];

  const loaded = new GLTFLoader()
    .loadAsync(`${baseUrl}assets/models/${MODEL}.glb`)
    .then((gltf) => {
      // Cartoon colours on one shared set of materials.
      const materials = new Map<Material, Material>();
      gltf.scene.traverse((object) => {
        if (object instanceof Mesh) {
          const source = object.material as Material;
          let made = materials.get(source);
          if (made === undefined) {
            made = cartoon(source);
            materials.set(source, made);
          }
          object.material = made;
          object.frustumCulled = false;
        }
      });
      const size = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
      const scale = size.y > 0.01 ? CONFIG.zombie.height / size.y : 1;
      const clip = AnimationClip.findByName(gltf.animations, WALK);
      if (clip === null) {
        throw new Error("The zombie model has no walk animation.");
      }
      for (let i = 0; i < CONFIG.spawn.maxAlive; i += 1) {
        const object = clone(gltf.scene);
        object.scale.setScalar(scale);
        object.visible = false;
        const mixer = new AnimationMixer(object);
        const action = mixer.clipAction(clip);
        action.play();
        // Each zombie starts at another point of the walk cycle.
        mixer.setTime((i * clip.duration) / CONFIG.spawn.maxAlive);
        group.add(object);
        slots.push({ object, mixer });
      }
    });

  function update(zombies: readonly Zombie[], frameSeconds: number): void {
    const walking = zombies.filter((zombie) => zombie.state === "walking");
    slots.forEach((slot, index) => {
      const zombie = walking[index];
      if (zombie === undefined) {
        slot.object.visible = false;
        return;
      }
      slot.object.visible = true;
      slot.object.position.set(zombie.x, 0, zombie.z);
      slot.object.rotation.y = zombie.heading;
      slot.mixer.update(frameSeconds);
    });
  }

  return { group, loaded, update };
}
