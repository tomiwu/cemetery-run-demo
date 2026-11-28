interface Window {
  /** Test hook. Exists only when the URL has `?test=1`. */
  __game?: {
    state: () => string;
    /** Progress of the intro, 0..1. It stays 0 until the scene is loaded. */
    introProgress: () => number;
    /** Hold the intro at a progress value (0..1), or release it with null. */
    freezeIntro: (progress: number | null) => void;
    /** Hearse state: position in metres, heading in radians, speed in m/s. */
    hearse: () => { x: number; z: number; heading: number; speed: number };
    /** The zombie list: position, heading, speed and state of each zombie. */
    zombies: () => {
      id: number;
      x: number;
      z: number;
      heading: number;
      speed: number;
      state: "walking" | "popped" | "arrived";
    }[];
    /** Zombies popped so far (the score). */
    score: () => number;
    /** Put a walking zombie 4 m in front of the hearse. */
    placeZombieAhead: () => void;
    /** True when the cemetery models are in the game scene. */
    gameLoaded: () => boolean;
    /** Draw calls of the last frame, shadow passes included. */
    drawCalls: () => number;
    /** Number of zombies inside the camera frame. */
    zombiesInView: () => number;
  };
}
