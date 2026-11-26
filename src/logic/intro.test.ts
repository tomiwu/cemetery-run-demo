import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import {
  INTRO_KEYFRAMES,
  introProgress,
  sampleIntro,
  type IntroKeyframe,
} from "./intro";
import { initialState, next } from "./session";

describe("introProgress", () => {
  it("is 0 at the start", () => {
    expect(introProgress(0)).toBe(0);
  });

  it("is 0.5 at half of the intro time", () => {
    expect(introProgress(CONFIG.introSeconds / 2)).toBeCloseTo(0.5);
  });

  it("is 1 at the end", () => {
    expect(introProgress(CONFIG.introSeconds)).toBe(1);
  });

  it("stays in 0..1 for times outside the intro", () => {
    expect(introProgress(-3)).toBe(0);
    expect(introProgress(CONFIG.introSeconds * 10)).toBe(1);
  });
});

describe("intro keyframes", () => {
  it("start at 0, end at 1 and go in time order", () => {
    expect(INTRO_KEYFRAMES[0]?.t).toBe(0);
    expect(INTRO_KEYFRAMES[INTRO_KEYFRAMES.length - 1]?.t).toBe(1);
    for (let i = 1; i < INTRO_KEYFRAMES.length; i += 1) {
      expect(INTRO_KEYFRAMES[i]?.t).toBeGreaterThan(
        INTRO_KEYFRAMES[i - 1]?.t ?? 0,
      );
    }
  });

  it("drive the hearse forward along the road through the gate", () => {
    const first = INTRO_KEYFRAMES[0] as IntroKeyframe;
    const last = INTRO_KEYFRAMES[INTRO_KEYFRAMES.length - 1] as IntroKeyframe;
    expect(first.hearse.z).toBeLessThan(0);
    expect(last.hearse.z).toBeGreaterThan(0);
  });
});

describe("sampleIntro", () => {
  const first = INTRO_KEYFRAMES[0] as IntroKeyframe;
  const last = INTRO_KEYFRAMES[INTRO_KEYFRAMES.length - 1] as IntroKeyframe;

  it("returns the first keyframe at 0", () => {
    const sample = sampleIntro(0);
    expect(sample.hearse).toEqual(first.hearse);
    expect(sample.camera).toEqual(first.camera);
  });

  it("returns the last keyframe at 1", () => {
    const sample = sampleIntro(1);
    expect(sample.hearse).toEqual(last.hearse);
    expect(sample.camera).toEqual(last.camera);
  });

  it("interpolates linearly between two keyframes at 0.5", () => {
    const keyframes: IntroKeyframe[] = [
      {
        t: 0,
        hearse: { x: 0, z: 0, heading: 0 },
        camera: { x: 0, y: 2, z: 0 },
      },
      {
        t: 1,
        hearse: { x: 10, z: 20, heading: 1 },
        camera: { x: 4, y: 6, z: -8 },
      },
    ];
    const sample = sampleIntro(0.5, keyframes);
    expect(sample.hearse).toEqual({ x: 5, z: 10, heading: 0.5 });
    expect(sample.camera).toEqual({ x: 2, y: 4, z: -4 });
  });

  it("is between the first and the last keyframe at 0.5", () => {
    const sample = sampleIntro(0.5);
    expect(sample.hearse.z).toBeGreaterThan(first.hearse.z);
    expect(sample.hearse.z).toBeLessThan(last.hearse.z);
  });

  it("clamps t outside 0..1", () => {
    expect(sampleIntro(-1)).toEqual(sampleIntro(0));
    expect(sampleIntro(2)).toEqual(sampleIntro(1));
  });

  it("uses the right segment when there are more than two keyframes", () => {
    const keyframes: IntroKeyframe[] = [
      {
        t: 0,
        hearse: { x: 0, z: 0, heading: 0 },
        camera: { x: 0, y: 0, z: 0 },
      },
      {
        t: 0.5,
        hearse: { x: 10, z: 0, heading: 0 },
        camera: { x: 0, y: 0, z: 0 },
      },
      {
        t: 1,
        hearse: { x: 30, z: 0, heading: 0 },
        camera: { x: 0, y: 0, z: 0 },
      },
    ];
    expect(sampleIntro(0.25, keyframes).hearse.x).toBe(5);
    expect(sampleIntro(0.75, keyframes).hearse.x).toBe(20);
  });

  it("returns a copy, so a caller cannot change the keyframes", () => {
    const sample = sampleIntro(0);
    sample.hearse.x = 12345;
    expect(sampleIntro(0).hearse.x).toBe(first.hearse.x);
  });

  it("throws when the keyframe list is empty", () => {
    expect(() => sampleIntro(0.5, [])).toThrow();
  });
});

describe("intro and session state", () => {
  it("a skip during the intro gives the state ready", () => {
    expect(next(initialState(), "skip")).toBe("ready");
  });

  it("progress 1 gives the state ready", () => {
    const event = introProgress(CONFIG.introSeconds) >= 1 ? "introDone" : "tap";
    expect(next("intro", event)).toBe("ready");
  });
});
