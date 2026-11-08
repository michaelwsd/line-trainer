import type { Color, OpponentMode } from "./trainer";

/**
 * Switching language loads a different route, which remounts the app.
 * Before navigating we stash what the user was doing in sessionStorage,
 * and the new page picks it up once (then clears it).
 */
export interface Handoff {
  pgn: string;
  color: Color;
  opponent: OpponentMode;
  /** Moves played as child indices into the game tree; present when a drill was in progress. */
  path: number[] | null;
}

const KEY = "line-trainer:handoff";

export function saveHandoff(handoff: Handoff): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(handoff));
  } catch {
    // Storage unavailable (private mode, quota): the switch still works, state just resets.
  }
}

export function takeHandoff(): Handoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const data = JSON.parse(raw) as Partial<Handoff>;
    if (typeof data.pgn !== "string" || (data.color !== "white" && data.color !== "black")) return null;
    const opponent = data.opponent === "random" ? "random" : "main";
    const path = Array.isArray(data.path) && data.path.every((i) => Number.isInteger(i) && i >= 0) ? data.path : null;
    return { pgn: data.pgn, color: data.color, opponent, path };
  } catch {
    return null;
  }
}
