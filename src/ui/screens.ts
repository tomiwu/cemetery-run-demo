import type { SessionEvent, SessionState } from "../logic/session";
import { STRINGS } from "../strings";

export interface Screens {
  /** Show the screen for a session state. Other screens go away. */
  show: (state: SessionState) => void;
  /** Show the score in the HUD. */
  setScore: (score: number) => void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

/** DOM overlay screens. A tap on a screen sends one session event to `send`. */
export function createScreens(
  root: HTMLElement,
  send: (event: SessionEvent) => void,
): Screens {
  function tapScreen(className: string, event: SessionEvent): HTMLElement {
    const screen = element("div", `screen ${className}`);
    screen.addEventListener("pointerdown", (pointer) => {
      pointer.preventDefault();
      send(event);
    });
    return screen;
  }

  function introScreen(): HTMLElement {
    const screen = tapScreen("screen-intro", "skip");
    screen.append(element("p", "skip-hint", STRINGS.tapToSkip));
    return screen;
  }

  function readyScreen(): HTMLElement {
    const screen = tapScreen("screen-ready", "tap");
    screen.append(
      element("h1", "title", STRINGS.title),
      element("p", "start", STRINGS.tapToStart),
      element("p", "hint", STRINGS.controlHint),
    );
    return screen;
  }

  const hud = element("div", "hud");
  const scoreText = element("p", "hud-score");
  hud.append(scoreText);
  let shownScore = -1;
  function setScore(score: number): void {
    if (score !== shownScore) {
      shownScore = score;
      scoreText.textContent = `${STRINGS.score} ${String(score)}`;
    }
  }
  setScore(0);

  return {
    setScore,
    show(state) {
      root.replaceChildren();
      if (state === "playing") {
        root.append(hud);
      }
      if (state === "intro") {
        root.append(introScreen());
      } else if (state === "ready") {
        root.append(readyScreen());
      }
    },
  };
}
