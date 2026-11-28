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
    slowTurnShare: 0.6,
    /** Longest logic step in seconds. */
    maxStepSeconds: 0.05,
  },
  /**
   * Collision feel (PRD D22, docs/playtest/README.md). The hearse is two circles on the heading
   * axis. A first contact keeps the part of the speed along the obstacle and reverses the rest.
   */
  collision: {
    /** The two hearse circles: this far in front of and behind the middle, and their radius (m). */
    colliderOffset: 1.3,
    colliderRadius: 1.0,
    /** Share of the speed along the obstacle that a first contact keeps. */
    tangentKeep: 0.92,
    /** Restitution: the share of the speed into the obstacle that comes back. */
    restitution: { wall: 0.3, tree: 0.35, soft: 0 },
    /** Least rebound speed in m/s of a hard hit (an impact of `bumpMinImpact` or more). */
    minRebound: 1.5,
    /** The hearse leaves an obstacle by the overlap plus this distance in metres. */
    pushOutExtra: 0.02,
    /** The rebound (knock-back) loses this much speed in m/s^2. */
    knockDecay: 12,
    /** A gap in the contact that is shorter than this (s) does not end the contact. */
    contactGraceSeconds: 0.1,
    /** Speed loss per second of a scrape that points into the wall (see `scrapeLoss`). */
    scrapeDrag: 16,
    /** Contact longer than `seconds` under `speed` m/s: an extra push out of `push` metres. */
    unstick: { seconds: 0.25, speed: 1, push: 0.3 },
    /** An impact (speed into the obstacle, m/s) of at least this gives a bump event. */
    bumpMinImpact: 2,
    /** Camera shake of a wall or tree hit: metres for 10 m/s of impact, most metres, seconds. */
    shake: { amplitude: 0.04, maxAmplitude: 0.25, seconds: 0.15 },
    /** Dust puff of a bump: number of pieces. */
    puffPieces: 9,
  },
  /** Graves break under the hearse (PRD D19). */
  graveHit: {
    /** Least hearse speed in m/s that breaks a grave. Slower, the grave is a soft obstacle. */
    breakSpeed: 3,
    /** The hearse keeps this share of its speed for each grave that it breaks. */
    speedFactor: 0.75,
    /** Camera shake of a grave break: metres and seconds. */
    shake: { amplitude: 0.08, seconds: 0.1 },
    /** Stone pieces of one break: least and most. */
    stonePieces: { min: 6, max: 10 },
    /** Dust pieces of one break. */
    dustPieces: 8,
    /** Flight time of the pieces in seconds. */
    flightSeconds: 0.6,
    /** Breaks (and puffs) that can fly at the same time. */
    maxBursts: 6,
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
      /** Between the graves of a row. With the jitter, the centres stay 5.0 m or more apart. */
      columnSpacing: 5.1,
      /** Centre of the first column from the main road centre line. */
      firstColumn: 3.4,
      rows: 9,
      /** Between two rows. With the jitter, the centres stay 5.5 m or more apart. */
      rowSpacing: 5.6,
      firstRow: -22.4,
      /** Largest random shift of a gravestone in metres. */
      jitter: 0.05,
      /** Share of the graves that have no stone. */
      gap: 0.08,
      /** Number of different gravestone models. */
      variants: 7,
      /** Radius of the grave circle in metres (a collision circle until it breaks). */
      radius: 0.6,
    },
    trees: { count: 13, radius: 1, variants: 3 },
    pumpkins: { count: 5 },
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
  /** The hearse hits zombies (PRD section 3). */
  hit: {
    /** Least hearse speed in m/s for a hit. Slower, and a zombie is pushed aside. */
    minSpeed: 3,
    /** Radius in metres of the zombie circle for the hit test. */
    zombieRadius: 0.5,
    /** The hearse keeps this share of its speed for each zombie that it hits. */
    speedFactor: 0.95,
    /** Points for each zombie that pops. */
    score: 1,
    /** Camera shake on a hit: height in metres and time in seconds. */
    shake: { amplitude: 0.04, seconds: 0.08 },
  },
  /** The pop effect (src/render/pop.ts). */
  pop: {
    /** The zombie squashes for this time in seconds, then it disappears. */
    squashSeconds: 0.1,
    /** Flight time of the leaves and dust pieces in seconds. */
    burstSeconds: 0.7,
    /** Number of pieces in one burst: least and most. */
    pieces: { min: 14, max: 20 },
    /** Bursts that can fly at the same time. The pool has this many times the most pieces. */
    maxBursts: 8,
  },
  /** Fixed logic step in seconds (60 steps per second). */
  logicStepSeconds: 1 / 60,
  /** Most logic steps in one frame. A very slow frame drops the rest of the time. */
  maxStepsPerFrame: 5,
  /** Chase camera. */
  camera: {
    /** Offset from the hearse in metres (about 40 degrees down). The world direction is fixed. */
    offset: { x: 4.5, y: 8.5, z: 8.5 },
    /** The camera looks at a point this far in front of the hearse (north), so the sky shows. */
    lookAhead: 6,
    /** Follow speed. A higher value follows closer (1/s). */
    follow: 5,
    /** Smallest vertical view angle in degrees, and the narrowest side view angle. */
    fov: 50,
    wideFov: 62,
    maxFov: 85,
    /** Trees and lamp posts between the camera and the hearse fade to this opacity. */
    /** The camera stays this far outside the inner face of the walls (metres). */
    wallMargin: 1,
    occlusionOpacity: 0.3,
    /** Fade speed in opacity per second. */
    occlusionFadePerSecond: 6,
    /** Extra distance in metres around a prop that counts as in the way. */
    occlusionMargin: 0.6,
  },
} as const;
