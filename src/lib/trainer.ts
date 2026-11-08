import { Chess } from "chess.js";

export type Color = "white" | "black";

export interface LineMove {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  color: "w" | "b";
}

export interface ParsedLine {
  moves: LineMove[];
  /** fens[i] is the position after i plies; fens[0] is the start position. */
  fens: string[];
  headers: Record<string, string>;
}

export type ParseResult = { ok: true; line: ParsedLine } | { ok: false; error: string };

/**
 * Parse PGN text into its main line. Variations in parentheses, comments and
 * NAGs are discarded: the trainer strictly follows the main line.
 */
export function parsePgn(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Paste a PGN to get started." };

  const chess = new Chess();
  try {
    chess.loadPgn(trimmed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not read that PGN: ${detail}` };
  }

  const history = chess.history({ verbose: true });
  if (history.length === 0) {
    return { ok: false, error: "That PGN does not contain any moves." };
  }

  const fens = [history[0].before, ...history.map((m) => m.after)];
  const moves: LineMove[] = history.map((m) => ({
    san: m.san,
    from: m.from,
    to: m.to,
    promotion: m.promotion,
    color: m.color,
  }));

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(chess.getHeaders())) {
    if (typeof v === "string") headers[k] = v;
  }

  return { ok: true, line: { moves, fens, headers } };
}

/** Color to move at a given ply, accounting for PGNs that start from a FEN with Black to move. */
export function sideToMove(line: ParsedLine, ply: number): Color {
  const turn = line.fens[ply].split(" ")[1];
  return turn === "b" ? "black" : "white";
}

export type Feedback = "idle" | "correct" | "wrong" | "illegal" | "hint" | "complete";

export interface TrainerState {
  line: ParsedLine;
  userColor: Color;
  ply: number;
  /** Wrong attempts made at the current ply. */
  attempts: number;
  hint: { from: string; to: string } | null;
  feedback: Feedback;
  /** The last rejected drop, used to flash the target square. Incremented id lets the UI re-trigger the flash. */
  rejected: { square: string; id: number } | null;
}

export type TrainerAction =
  | { type: "userMove"; from: string; to: string }
  | { type: "botMove"; ply: number }
  | { type: "retract" }
  | { type: "restart" };

/** Number of wrong attempts after which the correct squares are revealed. */
export const HINT_AFTER_ATTEMPTS = 2;

export function initTrainer(line: ParsedLine, userColor: Color): TrainerState {
  return {
    line,
    userColor,
    ply: 0,
    attempts: 0,
    hint: null,
    feedback: "idle",
    rejected: null,
  };
}

export function isComplete(state: TrainerState): boolean {
  return state.ply >= state.line.moves.length;
}

export function isUserTurn(state: TrainerState): boolean {
  return !isComplete(state) && sideToMove(state.line, state.ply) === state.userColor;
}

export function isBotTurn(state: TrainerState): boolean {
  return !isComplete(state) && sideToMove(state.line, state.ply) !== state.userColor;
}

export function currentFen(state: TrainerState): string {
  return state.line.fens[state.ply];
}

function isLegal(fen: string, from: string, to: string): boolean {
  const chess = new Chess(fen);
  return chess.moves({ square: from as never, verbose: true }).some((m) => m.to === to);
}

function advance(state: TrainerState): TrainerState {
  const ply = state.ply + 1;
  const done = ply >= state.line.moves.length;
  return {
    ...state,
    ply,
    attempts: 0,
    hint: null,
    rejected: null,
    feedback: done ? "complete" : state.feedback,
  };
}

export function trainerReducer(state: TrainerState, action: TrainerAction): TrainerState {
  switch (action.type) {
    case "userMove": {
      if (!isUserTurn(state)) return state;
      const expected = state.line.moves[state.ply];
      if (action.from === expected.from && action.to === expected.to) {
        return advance({ ...state, feedback: "correct" });
      }
      const attempts = state.attempts + 1;
      const showHint = attempts >= HINT_AFTER_ATTEMPTS;
      const legal = isLegal(currentFen(state), action.from, action.to);
      return {
        ...state,
        attempts,
        hint: showHint ? { from: expected.from, to: expected.to } : null,
        feedback: showHint ? "hint" : legal ? "wrong" : "illegal",
        rejected: { square: action.to, id: (state.rejected?.id ?? 0) + 1 },
      };
    }
    case "botMove": {
      // Ignore stale timers: only play if the board is still at the ply the bot was scheduled for.
      if (action.ply !== state.ply || !isBotTurn(state)) return state;
      return advance(state);
    }
    case "retract": {
      const target = retractTarget(state);
      if (target === null) return state;
      return { ...state, ply: target, attempts: 0, hint: null, rejected: null, feedback: "idle" };
    }
    case "restart":
      return initTrainer(state.line, state.userColor);
  }
}

/** The most recent earlier ply at which it was the user's turn, or null if there is none. */
export function retractTarget(state: TrainerState): number | null {
  for (let p = state.ply - 1; p >= 0; p--) {
    if (sideToMove(state.line, p) === state.userColor) return p;
  }
  return null;
}
