import "./styles.css";
import { WebGLRenderer, type Camera, type Scene } from "three";
import { CONFIG } from "./config";
import { blendHearse, type HearseState } from "./logic/hearse";
import { createInput } from "./logic/input";
import { introProgress } from "./logic/intro";
import { buildMap } from "./logic/map";
import { createRandom } from "./logic/random";
import { initialState, next, type SessionEvent } from "./logic/session";
import { createWorld, stepWorld, type World } from "./logic/world";
import { createGameScene } from "./render/game";
import { createIntroScene } from "./render/intro";
import { createJoystick } from "./ui/joystick";
import { createScreens } from "./ui/screens";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const ui = document.querySelector<HTMLElement>("#ui");
if (!canvas || !ui) {
  throw new Error("Page host elements are missing.");
}

const renderer = new WebGLRenderer({ canvas, antialias: true });
// `?test=1` draws at pixel ratio 1: software WebGL in CI is too slow at a higher ratio.
const testMode =
  new URLSearchParams(window.location.search).get("test") === "1";
renderer.setPixelRatio(testMode ? 1 : Math.min(window.devicePixelRatio, 2));

const intro = createIntroScene();
const map = buildMap(CONFIG.map);
const game = createGameScene(renderer, import.meta.env.BASE_URL, map);
let gameLoaded = false;
game.loaded
  .then(() => {
    gameLoaded = true;
  })
  .catch((error: unknown) => {
    console.error("Cannot load the cemetery.", error);
  });
const input = createInput(CONFIG.joystick);
createJoystick(canvas, input);

let world: World = createWorld(map);
let previousHearse: HearseState = world.hearse;
let accumulator = 0;
let rounds = 0;
let rng = createRandom(CONFIG.spawn.seed);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  intro.resize(width, height);
  game.resize(width, height);
}
window.addEventListener("resize", resize);
resize();

let state = initialState();
function send(event: SessionEvent): void {
  const target = next(state, event);
  if (target !== state) {
    state = target;
    if (state === "playing") {
      // A new seed for each round, and the same seeds in each test run.
      rounds += 1;
      rng = createRandom(CONFIG.spawn.seed + rounds);
      world = createWorld(map);
      previousHearse = world.hearse;
      accumulator = 0;
      input.reset();
      game.snap(world.hearse);
    }
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
const debug = query.get("debug") === "1";
/** Draw calls of the last frame (shadow passes included). */
let lastDrawCalls = 0;
let debugFrames = 0;

function draw(target: Scene, camera: Camera): void {
  renderer.render(target, camera);
  lastDrawCalls = renderer.info.render.calls;
  debugFrames += 1;
  if (debug && debugFrames % 120 === 0) {
    console.info(`draw calls: ${String(lastDrawCalls)}`);
  }
}

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
      if (value === null && frozenProgress !== null) {
        // Continue from the held point, not from the start.
        introElapsed = frozenProgress * CONFIG.introSeconds;
      }
      frozenProgress = value;
    },
    hearse: () => ({ ...world.hearse }),
    zombies: () => world.zombies.map((zombie) => ({ ...zombie })),
    gameLoaded: () => gameLoaded,
    drawCalls: () => lastDrawCalls,
  };
}

let lastFrame: number | null = null;

/** Run the logic in fixed steps and return the share of the next step that is left. */
function stepLogic(frameSeconds: number): number {
  const step = CONFIG.logicStepSeconds;
  accumulator += frameSeconds;
  // A very slow frame drops the extra time, so the loop cannot run away.
  accumulator = Math.min(accumulator, step * CONFIG.maxStepsPerFrame);
  while (accumulator >= step) {
    previousHearse = world.hearse;
    world = stepWorld(world, input.vector(), step, rng);
    accumulator -= step;
  }
  return accumulator / step;
}

renderer.setAnimationLoop((time: number) => {
  const frameSeconds =
    lastFrame === null ? 0 : Math.max(0, (time - lastFrame) / 1000);
  lastFrame = time;
  if (state === "playing") {
    const alpha = stepLogic(frameSeconds);
    game.update(
      blendHearse(previousHearse, world.hearse, alpha),
      world.zombies,
      frameSeconds,
    );
    draw(game.scene, game.camera);
    return;
  }
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
  draw(intro.scene, intro.camera);
});
