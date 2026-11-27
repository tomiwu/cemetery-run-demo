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
    /** Collision circle radius in metres. */
    radius: 1.4,
  },
  /**
   * The cemetery map. x goes right, z goes toward the camera (south). The gate is in the
   * south wall (z = length / 2), the chapel is at the north end (z = -length / 2).
   */
  map: {
    /** Seed of the random function that places graves, trees and stones. */
    seed: 5,
    /** Inside size of the walls in metres. */
    width: 60,
    length: 90,
    wallThickness: 0.4,
    /** Width of the gate opening in the south wall. */
    gateWidth: 6,
    roadWidth: 5,
    /** The loop road is a rectangle. These are the distances of its centre line from the middle. */
    loopHalfWidth: 22,
    loopHalfLength: 28,
    /** Distance from the gate to the hearse start, on the main road. */
    startFromGate: 8,
    /** The chapel. The door is on the south side. */
    chapel: { width: 6.6, depth: 8.5, plazaWidth: 16, plazaDepth: 6.5 },
    /** Number of candle slots, their distance from each other, and from the door. */
    candleSlots: { count: 5, spacing: 1.4, fromDoor: 1.4 },
    /** Grave rows in each of the two fields. */
    graves: {
      columns: 4,
      columnSpacing: 4,
      /** Centre of the first column from the main road centre line. */
      firstColumn: 4.5,
      rows: 10,
      rowSpacing: 4.8,
      firstRow: -22.5,
      /** Largest random shift of a gravestone in metres. */
      jitter: 0.25,
      /** Share of the graves that have no stone. */
      gap: 0.08,
      /** Number of different gravestone models. */
      variants: 7,
      radius: 0.6,
    },
    trees: { count: 13, radius: 1, variants: 3 },
    pumpkins: { count: 5, radius: 0.3 },
    lightposts: { radius: 0.25 },
    /** Zombie spawn points. `clearance` is the least distance to any obstacle. */
    spawns: { count: 16, clearance: 1.5, roadMargin: 1 },
  },
  /** No zombie spawns closer than this to the hearse, in metres. */
  spawnMinDistance: 6,
  /** Zombies. Waves change the spawn numbers later. */
  spawn: {
    /** Seconds between two spawns. */
    baseInterval: 2.5,
    /** Walk speed in m/s. */
    baseSpeed: 0.9,
    /** Most zombies that walk at the same time. */
    maxAlive: 24,
    /** Seed of the random function for the spawn points. */
    seed: 11,
  },
  zombie: {
    /** Collision circle radius in metres. */
    radius: 0.35,
    /** A zombie that is this close to the chapel door has arrived. */
    arriveDistance: 1.5,
    /** Longest logic step in seconds. */
    maxStepSeconds: 0.1,
    /** Height of the drawn zombie in metres. */
    height: 1.6,
  },
  /** Fixed logic step in seconds (60 steps per second). */
  logicStepSeconds: 1 / 60,
  /** Most logic steps in one frame. A very slow frame drops the rest of the time. */
  maxStepsPerFrame: 5,
  /** Chase camera. */
  camera: {
    /** Offset from the hearse in metres (about 40 degrees down). The world direction is fixed. */
    offset: { x: 3, y: 7.5, z: 9.5 },
    /** The camera looks at a point this far in front of the hearse (north), so the sky shows. */
    lookAhead: 5,
    /** Follow speed. A higher value follows closer (1/s). */
    follow: 5,
    /** Smallest vertical view angle in degrees, and the narrowest side view angle. */
    fov: 50,
    wideFov: 62,
    maxFov: 85,
  },
} as const;
