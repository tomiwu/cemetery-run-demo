interface Window {
  /** Test hook. Exists only when the URL has `?test=1`. */
  __game?: {
    state: () => string;
    /** Progress of the intro, 0..1. It stays 0 until the scene is loaded. */
    introProgress: () => number;
    /** Hold the intro at a progress value (0..1), or release it with null. */
    freezeIntro: (progress: number | null) => void;
  };
}
