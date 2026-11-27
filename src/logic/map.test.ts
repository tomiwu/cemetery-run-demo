import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { circleVsBox, resolveHearse, type Shape } from "./collision";
import { stepHearse } from "./hearse";
import { buildMap, type Rect } from "./map";

const map = buildMap(CONFIG.map);
const M = CONFIG.map;

function distanceToShape(x: number, z: number, shape: Shape): number {
  if (shape.kind === "circle") {
    return Math.hypot(x - shape.x, z - shape.z) - shape.r;
  }
  const dx = Math.max(shape.minX - x, 0, x - shape.maxX);
  const dz = Math.max(shape.minZ - z, 0, z - shape.maxZ);
  return Math.hypot(dx, dz);
}

function distanceToRect(x: number, z: number, rect: Rect): number {
  const dx = Math.max(rect.minX - x, 0, x - rect.maxX);
  const dz = Math.max(rect.minZ - z, 0, z - rect.maxZ);
  return Math.hypot(dx, dz);
}

const onRoad = (x: number, z: number, margin: number): boolean =>
  map.roads.some((road) => distanceToRect(x, z, road) < margin);

describe("buildMap", () => {
  it("is deterministic", () => {
    expect(buildMap(CONFIG.map)).toEqual(buildMap(CONFIG.map));
  });

  it("changes with the seed", () => {
    const other = buildMap({ ...CONFIG.map, seed: CONFIG.map.seed + 1 });
    expect(other.graves).not.toEqual(map.graves);
  });

  it("has walls about 60 m wide and 90 m long", () => {
    expect(map.bounds.maxX - map.bounds.minX).toBe(60);
    expect(map.bounds.maxZ - map.bounds.minZ).toBe(90);
    expect(map.walls).toHaveLength(5);
  });

  it("has the gate in the south wall and the main road from the gate to the chapel", () => {
    const main = map.roads.find(
      (road) => road.minX === -M.roadWidth / 2 && road.maxX === M.roadWidth / 2,
    );
    expect(main?.maxZ).toBe(map.bounds.maxZ);
    expect(main?.minZ).toBeCloseTo(map.chapel.z + map.chapel.depth / 2);
    // The wall pieces leave an opening that the road passes through.
    const south = map.walls.filter((wall) => wall.minZ >= map.bounds.maxZ);
    expect(south.length).toBeGreaterThan(0);
    for (const wall of south) {
      expect(
        wall.minX >= M.gateWidth / 2 || wall.maxX <= -M.gateWidth / 2,
      ).toBe(true);
    }
    expect(map.gate.minZ).toBe(map.bounds.maxZ);
  });

  it("has a loop road around two grave fields", () => {
    const loopRoads = map.roads.filter(
      (road) => road.maxX - road.minX < 60 && road !== map.roads[0],
    );
    expect(loopRoads.length).toBeGreaterThanOrEqual(4);
    // A point on each side of the ring is on a road.
    for (const [x, z] of [
      [-M.loopHalfWidth, 0],
      [M.loopHalfWidth, 0],
      [0, -M.loopHalfLength],
      [0, M.loopHalfLength],
      [-M.loopHalfWidth, -M.loopHalfLength],
      [M.loopHalfWidth, M.loopHalfLength],
    ] as const) {
      expect(onRoad(x, z, 0.001)).toBe(true);
    }
    // The middle of each field is not.
    expect(onRoad(-12, 0, 0.001)).toBe(false);
    expect(onRoad(12, 0, 0.001)).toBe(false);
  });

  it("has a chapel at the north end of the main road", () => {
    const chapel = map.chapel;
    expect(chapel.x).toBe(0);
    expect(chapel.z).toBeLessThan(-M.length / 2 + chapel.depth);
    expect(chapel.z - chapel.depth / 2).toBeGreaterThanOrEqual(-M.length / 2);
    const boxes = map.obstacles.filter(
      (shape) =>
        shape.kind === "box" &&
        shape.minX === chapel.x - chapel.width / 2 &&
        shape.maxX === chapel.x + chapel.width / 2,
    );
    expect(boxes).toHaveLength(1);
  });

  it("has 5 candle slots in front of the chapel door", () => {
    expect(map.candleSlots).toHaveLength(CONFIG.candles);
    const doorZ = map.chapel.z + map.chapel.depth / 2;
    for (const slot of map.candleSlots) {
      expect(slot.z).toBeGreaterThan(doorZ);
      expect(slot.z - doorZ).toBeLessThan(3);
      expect(Math.abs(slot.x - map.chapel.x)).toBeLessThanOrEqual(
        map.chapel.width / 2,
      );
      for (const shape of map.obstacles) {
        expect(distanceToShape(slot.x, slot.z, shape)).toBeGreaterThan(0);
      }
    }
    expect(new Set(map.candleSlots.map((slot) => slot.x)).size).toBe(5);
  });

  it("puts the hearse on the main road near the gate, heading north", () => {
    const start = map.hearseStart;
    expect(Math.abs(start.x)).toBeLessThan(M.roadWidth / 2);
    expect(start.z).toBeGreaterThan(0);
    expect(map.bounds.maxZ - start.z).toBeLessThanOrEqual(10);
    // Heading PI drives toward -z.
    expect(start.heading).toBe(Math.PI);
    expect(onRoad(start.x, start.z, 0.001)).toBe(true);
    for (const shape of map.obstacles) {
      expect(distanceToShape(start.x, start.z, shape)).toBeGreaterThan(
        CONFIG.hearse.radius,
      );
    }
  });

  it("has 10 to 16 trees", () => {
    const trees = map.trees.length;
    expect(trees).toBeGreaterThanOrEqual(10);
    expect(trees).toBeLessThanOrEqual(16);
  });

  it("has grave rows on the grass, not on a road", () => {
    expect(map.graves.length).toBeGreaterThan(50);
    for (const item of [
      ...map.graves,
      ...map.trees,
      ...map.pumpkins,
      ...map.lightposts,
    ]) {
      expect(onRoad(item.x, item.z, 0.5)).toBe(false);
    }
    for (const grave of map.graves) {
      expect(grave.variant).toBeGreaterThanOrEqual(0);
      expect(grave.variant).toBeLessThan(M.graves.variants);
    }
    // The stones use many models.
    expect(new Set(map.graves.map((grave) => grave.variant)).size).toBe(
      M.graves.variants,
    );
  });

  it("keeps every obstacle inside the walls (walls aside)", () => {
    for (const shape of map.obstacles) {
      if (map.walls.includes(shape as never) || shape === map.gate) {
        continue;
      }
      if (shape.kind === "circle") {
        expect(Math.abs(shape.x) + shape.r).toBeLessThanOrEqual(M.width / 2);
        expect(Math.abs(shape.z) + shape.r).toBeLessThanOrEqual(M.length / 2);
      } else {
        expect(shape.minX).toBeGreaterThanOrEqual(-M.width / 2);
        expect(shape.maxX).toBeLessThanOrEqual(M.width / 2);
        expect(shape.minZ).toBeGreaterThanOrEqual(-M.length / 2);
      }
    }
  });

  it("has 12 to 20 spawn points between the graves", () => {
    expect(map.spawnPoints.length).toBeGreaterThanOrEqual(12);
    expect(map.spawnPoints.length).toBeLessThanOrEqual(20);
    expect(map.spawnPoints).toHaveLength(M.spawns.count);
  });

  it("keeps spawn points off the roads, inside the walls and 1.5 m from every obstacle", () => {
    expect(M.spawns.clearance).toBeGreaterThanOrEqual(1.5);
    for (const point of map.spawnPoints) {
      expect(onRoad(point.x, point.z, M.spawns.roadMargin)).toBe(false);
      expect(Math.abs(point.x)).toBeLessThan(M.width / 2);
      expect(Math.abs(point.z)).toBeLessThan(M.length / 2);
      for (const shape of map.obstacles) {
        expect(distanceToShape(point.x, point.z, shape)).toBeGreaterThanOrEqual(
          1.5,
        );
      }
    }
    expect(
      new Set(map.spawnPoints.map((p) => `${String(p.x)}:${String(p.z)}`)).size,
    ).toBe(map.spawnPoints.length);
  });

  it("has spawn points in both fields", () => {
    expect(map.spawnPoints.some((point) => point.x < 0)).toBe(true);
    expect(map.spawnPoints.some((point) => point.x > 0)).toBe(true);
  });
});

describe("driving on the map", () => {
  const dt = CONFIG.logicStepSeconds;
  const radius = CONFIG.hearse.radius;

  function run(
    heading: number,
    input: { x: number; y: number },
    steps: number,
    from = map.hearseStart,
  ): { x: number; z: number; speed: number; heading: number }[] {
    let state = { x: from.x, z: from.z, heading, speed: 0 };
    const track: (typeof state)[] = [];
    for (let i = 0; i < steps; i += 1) {
      state = resolveHearse(
        stepHearse(state, input, dt, CONFIG.hearse),
        radius,
        map.obstacles,
        map.bounds,
      );
      track.push(state);
    }
    return track;
  }

  it("drives up the main road to the chapel and stops there", () => {
    const track = run(Math.PI, { x: 0, y: 1 }, 1200);
    const end = track[track.length - 1];
    expect(end?.speed).toBe(0);
    expect(end?.z).toBeCloseTo(map.chapel.z + map.chapel.depth / 2 + radius, 1);
  });

  it("drives the loop: the hearse can go around a field on the roads", () => {
    const corners = [
      [0, M.loopHalfLength],
      [-M.loopHalfWidth, M.loopHalfLength],
      [-M.loopHalfWidth, -M.loopHalfLength],
      [0, -M.loopHalfLength],
    ] as const;
    // A hearse circle on the centre line of each leg touches no obstacle.
    const free = (x: number, z: number): boolean =>
      map.obstacles.every((shape) => distanceToShape(x, z, shape) >= radius);
    for (let i = 0; i < corners.length; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      if (a === undefined || b === undefined) {
        throw new Error("Missing corner.");
      }
      for (let k = 0; k <= 20; k += 1) {
        const x = a[0] + ((b[0] - a[0]) * k) / 20;
        const z = a[1] + ((b[1] - a[1]) * k) / 20;
        expect(free(x, z)).toBe(true);
      }
    }
  });

  it("stops at a gravestone", () => {
    const grave = map.obstacles.find(
      (shape) =>
        shape.kind === "circle" &&
        shape.r === M.graves.radius &&
        shape.x < -M.graves.firstColumn,
    );
    if (grave?.kind !== "circle") {
      throw new Error("No gravestone.");
    }
    // Drive east along the row line toward the stone from the main road side.
    const from = { x: -3, z: grave.z, heading: 0 };
    const track = run(-Math.PI / 2, { x: -1, y: 0 }, 400, from);
    const end = track[track.length - 1];
    expect(end?.speed).toBe(0);
    expect(end?.x).toBeGreaterThan(grave.x);
  });

  it("stops at the side wall and at the north wall", () => {
    const side = run(Math.PI / 2, { x: 1, y: 0 }, 900);
    const sideEnd = side[side.length - 1];
    expect(sideEnd?.x).toBeLessThanOrEqual(M.width / 2 - radius + 1e-6);
    expect(sideEnd?.speed).toBe(0);
    for (const heading of [Math.PI / 2, -Math.PI / 2, 0, Math.PI]) {
      const input = { x: Math.sin(heading), y: -Math.cos(heading) };
      for (const point of run(heading, input, 1500)) {
        expect(Math.abs(point.x)).toBeLessThanOrEqual(
          M.width / 2 - radius + 1e-6,
        );
        expect(point.z).toBeLessThanOrEqual(M.length / 2 - radius + 1e-6);
        expect(point.z).toBeGreaterThanOrEqual(-M.length / 2 + radius - 1e-6);
      }
    }
  });

  it("does not get stuck at the start", () => {
    expect(
      map.obstacles.some(
        (shape) =>
          shape.kind === "box" &&
          circleVsBox(
            { x: map.hearseStart.x, z: map.hearseStart.z, r: radius },
            shape,
          ) !== null,
      ),
    ).toBe(false);
  });
});
