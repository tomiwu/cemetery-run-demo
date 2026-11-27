/**
 * Colours of the look (docs/VISUAL_REFERENCE.md, "Palette"). All render files read their colours here.
 * Values that the reference does not list are marked "derived".
 */
export const PALETTE = {
  skyTop: "#3C3F4E",
  skyMiddle: "#726366",
  water: "#726366",
  horizonGlow: "#D28F54",
  horizonGlowWarm: "#E0A24A",
  horizonGlowLight: "#EBAA57",
  /** Derived: haze at the horizon, a mix of the glow and the middle sky. */
  haze: "#B8845A",
  grassDark: "#2D2A23",
  /** Derived: tones for fields and leaves, between the olive values of the reference. */
  foliageLight: "#3F4A2A",
  foliageDark: "#2B3020",
  fieldWarm: "#4A4630",
  trunk: "#3A2E26",
  pathShadow: "#302C23",
  pathLit: "#6B5A45",
  brickDark: "#7A4A35",
  brick: "#8A4B36",
  chapelRoof: "#5E3427",
  headstone: "#6C6263",
  candle: "#F2B45A",
  candleGlow: "#AC7D4F",
  hearseBody: "#0E0E0F",
  hearseHighlight: "#5A5354",
  curtain: "#E8E0CF",
  glass: "#1C1E22",
  headlight: "#FFD58A",
  taillight: "#7A1D1A",
  wheel: "#8C8A86",
  /** Derived: chrome, black iron, rubber and the blank plate. */
  chrome: "#C9C7C2",
  iron: "#141415",
  tire: "#0C0C0D",
  plate: "#D8D2C4",
  /** UI palette (Candle Graphite). */
  uiBackground: "#161513",
} as const;
