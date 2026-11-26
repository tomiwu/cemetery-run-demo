import { describe, expect, it } from "vitest";
import {
  initialState,
  next,
  type SessionEvent,
  type SessionState,
} from "./session";

const ALL_STATES: SessionState[] = ["intro", "ready", "playing", "ended"];
const ALL_EVENTS: SessionEvent[] = [
  "introDone",
  "skip",
  "tap",
  "timeUp",
  "candlesOut",
  "restart",
];

describe("session state machine", () => {
  it("starts in intro", () => {
    expect(initialState()).toBe("intro");
  });

  it("goes intro -> ready when the intro is done", () => {
    expect(next("intro", "introDone")).toBe("ready");
  });

  it("skips the intro with a tap", () => {
    expect(next("intro", "skip")).toBe("ready");
  });

  it("ignores a tap during the intro", () => {
    expect(next("intro", "tap")).toBe("intro");
  });

  it("goes ready -> playing with a tap", () => {
    expect(next("ready", "tap")).toBe("playing");
  });

  it("ends the round when time is up", () => {
    expect(next("playing", "timeUp")).toBe("ended");
  });

  it("ends the round when all candles are out", () => {
    expect(next("playing", "candlesOut")).toBe("ended");
  });

  it("restarts from the end screen to playing", () => {
    expect(next("ended", "restart")).toBe("playing");
  });

  it("ignores events that do not apply", () => {
    const valid = new Set([
      "intro:introDone",
      "intro:skip",
      "ready:tap",
      "playing:timeUp",
      "playing:candlesOut",
      "ended:restart",
    ]);
    for (const state of ALL_STATES) {
      for (const event of ALL_EVENTS) {
        if (!valid.has(`${state}:${event}`)) {
          expect(next(state, event)).toBe(state);
        }
      }
    }
  });
});
