import "./styles.css";
import { WebGLRenderer } from "three";
import { introProgress } from "./logic/intro";
import { initialState, next, type SessionEvent } from "./logic/session";
import { createIntroScene } from "./render/intro";
import { createScreens } from "./ui/screens";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const ui = document.querySelector<HTMLElement>("#ui");
if (!canvas || !ui) {
  throw new Error("Page host elements are missing.");
}

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const intro = createIntroScene(import.meta.env.BASE_URL);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  intro.resize(width, height);
}
window.addEventListener("resize", resize);
resize();

let state = initialState();
function send(event: SessionEvent): void {
  const target = next(state, event);
  if (target !== state) {
    state = target;
    screens.show(state);
  }
}
const screens = createScreens(ui, send);
screens.show(state);

// The intro clock starts when the models are in the scene.
let introStart: number | null = null;
let progress = 0;
let sceneLoaded = false;
let frozenProgress: number | null = null;
intro.loaded
  .then(() => {
    sceneLoaded = true;
  })
  .catch((error: unknown) => {
    console.error("Cannot load the scene.", error);
    sceneLoaded = true;
  });

if (new URLSearchParams(window.location.search).get("test") === "1") {
  window.__game = {
    state: () => state,
    introProgress: () => progress,
    freezeIntro: (value) => {
      frozenProgress = value;
    },
  };
}

renderer.setAnimationLoop((time: number) => {
  if (state === "intro") {
    if (sceneLoaded) {
      introStart ??= time;
      progress = frozenProgress ?? introProgress((time - introStart) / 1000);
      if (progress >= 1) {
        send("introDone");
      }
    }
  } else {
    progress = 1;
  }
  intro.update(progress);
  renderer.render(intro.scene, intro.camera);
});
