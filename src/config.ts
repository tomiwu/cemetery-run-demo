/** All tunable gameplay numbers live here. */
export const CONFIG = {
  roundSeconds: 60,
  candles: 5,
  /** Length of the intro in seconds. */
  introSeconds: 6,
  /** Longest frame step in seconds that the intro clock counts. A slow frame cannot skip the intro. */
  introMaxStepSeconds: 0.1,
} as const;
