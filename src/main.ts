import "./styles.css";
import { WebGLRenderer } from "three";
import { CONFIG } from "./config";
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
let introElapsed = 0;
let lastTime: number | null = null;
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

const query = new URLSearchParams(window.location.search);
if (query.get("test") === "1") {
  // `?test=1&hold=<0..1>` holds the intro at that progress from the first frame,
  // so a slow software-WebGL test run cannot miss the intro state. Players never send it.
  const hold = Number(query.get("hold"));
  if (query.has("hold") && hold >= 0 && hold <= 1) {
    frozenProgress = hold;
  }
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
      const step = lastTime === null ? 0 : (time - lastTime) / 1000;
      lastTime = time;
      introElapsed += Math.min(Math.max(step, 0), CONFIG.introMaxStepSeconds);
      progress = frozenProgress ?? introProgress(introElapsed);
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
