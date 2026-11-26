/** Joystick vector: screen right is +x, screen up is +y, length 0..1. */
export interface Vec2 {
  x: number;
  y: number;
}

export interface JoystickConfig {
  readonly deadZone: number;
  readonly fullDeflection: number;
}

export interface InputState {
  pointerDown: (id: number, x: number, y: number) => void;
  pointerMove: (id: number, x: number, y: number) => void;
  pointerUp: (id: number) => void;
  keyDown: (key: string) => void;
  keyUp: (key: string) => void;
  /** Forget all keys and the pointer (for example when the window loses focus). */
  reset: () => void;
  /** The combined vector. The larger of the pointer and the key vector wins. */
  vector: () => Vec2;
  /** Touch origin in screen pixels, or null when there is no touch. */
  origin: () => Vec2 | null;
  /** Thumb position in screen pixels, or null when there is no touch. */
  thumb: () => Vec2 | null;
}

const ZERO: Vec2 = { x: 0, y: 0 };

const KEY_DIRECTIONS: Readonly<Record<string, Vec2>> = {
  arrowup: { x: 0, y: 1 },
  w: { x: 0, y: 1 },
  arrowdown: { x: 0, y: -1 },
  s: { x: 0, y: -1 },
  arrowleft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

/** Vector for a set of pressed keys. A diagonal has length 1. */
export function keyVector(keys: ReadonlySet<string>): Vec2 {
  let x = 0;
  let y = 0;
  for (const key of keys) {
    const direction = KEY_DIRECTIONS[key.toLowerCase()];
    if (direction) {
      x += direction.x;
      y += direction.y;
    }
  }
  const length = Math.hypot(x, y);
  return length === 0 ? ZERO : { x: x / length, y: y / length };
}

const length = (v: Vec2): number => Math.hypot(v.x, v.y);

export function createInput(config: JoystickConfig): InputState {
  let activeId: number | null = null;
  let origin: Vec2 | null = null;
  let thumb: Vec2 | null = null;
  const keys = new Set<string>();

  function pointerVector(): Vec2 {
    if (origin === null || thumb === null) {
      return ZERO;
    }
    // Screen y grows downward. The joystick y grows upward.
    const dx = thumb.x - origin.x;
    const dy = origin.y - thumb.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= config.deadZone) {
      return ZERO;
    }
    const strength = Math.min(
      1,
      (distance - config.deadZone) / (config.fullDeflection - config.deadZone),
    );
    return { x: (dx / distance) * strength, y: (dy / distance) * strength };
  }

  return {
    pointerDown(id, x, y) {
      if (activeId !== null) {
        return;
      }
      activeId = id;
      origin = { x, y };
      thumb = { x, y };
    },
    pointerMove(id, x, y) {
      if (id === activeId) {
        thumb = { x, y };
      }
    },
    pointerUp(id) {
      if (id === activeId) {
        activeId = null;
        origin = null;
        thumb = null;
      }
    },
    keyDown(key) {
      keys.add(key);
    },
    keyUp(key) {
      keys.delete(key);
    },
    reset() {
      keys.clear();
      activeId = null;
      origin = null;
      thumb = null;
    },
    vector() {
      const fromPointer = pointerVector();
      const fromKeys = keyVector(keys);
      return length(fromKeys) >= length(fromPointer) ? fromKeys : fromPointer;
    },
    origin: () => origin,
    thumb: () => thumb,
  };
}
