/** All tunable gameplay numbers live here. */
export const CONFIG = {
  roundSeconds: 60,
  candles: 5,
  /** Length of the intro in seconds. */
  introSeconds: 6,
  /** Longest frame step in seconds that the intro clock counts. A slow frame cannot skip the intro. */
  introMaxStepSeconds: 0.1,
  /** Drag joystick. Values are in screen pixels. */
  joystick: {
    /** Drags shorter than this give no input. */
    deadZone: 10,
    /** A drag of this length or more gives full deflection. */
    fullDeflection: 70,
  },
  /** Hearse motion. */
  hearse: {
    /** Top speed in m/s. */
    maxSpeed: 10,
    /** Speed gain in m/s^2. */
    acceleration: 8,
    /** Speed loss in m/s^2 without input. */
    deceleration: 10,
    /** Greatest turn rate in rad/s. */
    turnRate: 3.5,
    /** Speed in m/s below which the turn rate is lower. */
    slowSpeed: 2,
    /** Share of the turn rate at speed 0 (0..1). */
    slowTurnShare: 0.35,
    /** Longest logic step in seconds. */
    maxStepSeconds: 0.05,
  },
  /** Fixed logic step in seconds (60 steps per second). */
  logicStepSeconds: 1 / 60,
  /** Most logic steps in one frame. A very slow frame drops the rest of the time. */
  maxStepsPerFrame: 5,
  /** Chase camera. */
  camera: {
    /** Offset from the hearse in metres. The world direction is fixed. */
    offset: { x: 0, y: 9, z: 11 },
    /** Follow speed. A higher value follows closer (1/s). */
    follow: 5,
    /** Smallest vertical view angle in degrees, and the narrowest side view angle. */
    fov: 50,
    wideFov: 62,
    maxFov: 85,
  },
} as const;
