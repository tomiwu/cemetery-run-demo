export type SessionState = "intro" | "ready" | "playing" | "ended";

export type SessionEvent =
  "introDone" | "tap" | "timeUp" | "candlesOut" | "restart";

export function initialState(): SessionState {
  return "intro";
}

/** Pure transition: an event that does not apply keeps the state. */
export function next(state: SessionState, event: SessionEvent): SessionState {
  switch (state) {
    case "intro":
      return event === "introDone" || event === "tap" ? "ready" : state;
    case "ready":
      return event === "tap" ? "playing" : state;
    case "playing":
      return event === "timeUp" || event === "candlesOut" ? "ended" : state;
    case "ended":
      return event === "restart" ? "playing" : state;
  }
}
