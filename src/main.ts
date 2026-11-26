import {
  AmbientLight,
  Color,
  DirectionalLight,
  DodecahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { STRINGS } from "./strings";
import { initialState } from "./logic/session";

const BACKGROUND = "#161513";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const ui = document.querySelector<HTMLElement>("#ui");
if (!canvas || !ui) {
  throw new Error("Page host elements are missing.");
}

const title = document.createElement("h1");
title.textContent = STRINGS.title;
ui.append(title);

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new Scene();
scene.background = new Color(BACKGROUND);

const camera = new PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 1.5, 5);

scene.add(new AmbientLight(0xffffff, 0.6));
const light = new DirectionalLight(0xffe2b0, 2);
light.position.set(3, 5, 4);
scene.add(light);

const placeholder = new Mesh(
  new DodecahedronGeometry(1.2),
  new MeshStandardMaterial({ color: 0xc9b99a, flatShading: true }),
);
scene.add(placeholder);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const state = initialState();
if (new URLSearchParams(window.location.search).get("test") === "1") {
  window.__game = { state: () => state };
}

renderer.setAnimationLoop((time: number) => {
  placeholder.rotation.y = time / 1000;
  placeholder.rotation.x = time / 2300;
  renderer.render(scene, camera);
});
