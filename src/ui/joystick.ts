import type { InputState } from "../logic/input";

/**
 * Pointer events on the game surface feed the input. A faint ring shows at the touch
 * origin and a dot at the thumb. Both are hidden when there is no touch.
 */
export function createJoystick(
  surface: HTMLElement,
  input: InputState,
): { destroy: () => void } {
  surface.style.touchAction = "none";

  const overlay = document.createElement("div");
  overlay.className = "joystick";
  document.body.append(overlay);
  const ring = document.createElement("div");
  ring.className = "joystick-ring";
  const dot = document.createElement("div");
  dot.className = "joystick-dot";
  ring.hidden = true;
  dot.hidden = true;
  overlay.append(ring, dot);

  function draw(): void {
    const origin = input.origin();
    const thumb = input.thumb();
    ring.hidden = origin === null;
    dot.hidden = thumb === null;
    if (origin !== null) {
      ring.style.transform = `translate(${String(origin.x)}px, ${String(origin.y)}px) translate(-50%, -50%)`;
    }
    if (thumb !== null) {
      dot.style.transform = `translate(${String(thumb.x)}px, ${String(thumb.y)}px) translate(-50%, -50%)`;
    }
  }

  const onDown = (event: PointerEvent): void => {
    event.preventDefault();
    input.pointerDown(event.pointerId, event.clientX, event.clientY);
    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      // The pointer may be gone already. The window handlers below still work.
    }
    draw();
  };
  const onMove = (event: PointerEvent): void => {
    input.pointerMove(event.pointerId, event.clientX, event.clientY);
    draw();
  };
  const onUp = (event: PointerEvent): void => {
    input.pointerUp(event.pointerId);
    draw();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    input.keyDown(event.key);
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    input.keyUp(event.key);
  };
  const onBlur = (): void => {
    input.reset();
    draw();
  };
  const noZoom = (event: Event): void => {
    event.preventDefault();
  };

  surface.addEventListener("pointerdown", onDown);
  surface.addEventListener("pointermove", onMove);
  surface.addEventListener("pointerup", onUp);
  surface.addEventListener("pointercancel", onUp);
  surface.addEventListener("dblclick", noZoom);
  surface.addEventListener("contextmenu", noZoom);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    destroy() {
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("pointercancel", onUp);
      surface.removeEventListener("dblclick", noZoom);
      surface.removeEventListener("contextmenu", noZoom);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      overlay.remove();
    },
  };
}
