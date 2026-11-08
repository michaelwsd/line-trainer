import { Chess } from "chess.js";
import { mainLineFrom, type GameTree, type MoveNode, type PositionNode } from "./pgn";

export type Color = "white" | "black";

/** How the bot picks its reply when the PGN offers several moves for it. */
export type OpponentMode = "main" | "random";

export type Feedback = "idle" | "correct" | "variation" | "wrong" | "illegal" | "hint" | "complete";

export interface TrainerState {
  tree: GameTree;
  userColor: Color;
  /** Moves played so far, from the start position. */
  path: MoveNode[];
  /** Wrong attempts made at the current position. */
  attempts: number;
  hint: { from: string; to: string } | null;
  feedback: Feedback;
  /** The last rejected drop, used to flash the target square. Incremented id lets the UI re-trigger the flash. */
  rejected: { square: string; id: number } | null;
  /**
   * Ply of the position where the user's latest move had sibling moves in the PGN,
   * so the UI can offer to play one of those instead. Null when there were none.
   */
  alternativesAt: number | null;
}

export type TrainerAction =
  | { type: "userMove"; from: string; to: string }
  /** `ply` guards against stale timers; `choice` is the index of the PGN move to play. */
  | { type: "botMove"; ply: number; choice: number }
  /** Rewind to the position at ply `at` (a user turn) and play its `choice`-th PGN move instead. */
  | { type: "playAlternative"; at: number; choice: number }
  | { type: "retract" }
  | { type: "restart" };

/** Number of wrong attempts after which the correct squares are revealed. */
export const HINT_AFTER_ATTEMPTS = 2;

export function initTrainer(tree: GameTree, userColor: Color, path: MoveNode[] = []): TrainerState {
  const done = (path.at(-1) ?? tree.root).children.length === 0;
  return {
    tree,
    userColor,
    path,
    attempts: 0,
    hint: null,
    feedback: done ? "complete" : "idle",
    rejected: null,
    alternativesAt: null,
  };
}

export function currentNode(state: TrainerState): PositionNode {
  return state.path.at(-1) ?? state.tree.root;
}

export function currentFen(state: TrainerState): string {
  return currentNode(state).fen;
}

export function sideToMove(node: PositionNode): Color {
  return node.fen.split(" ")[1] === "b" ? "black" : "white";
}

export function isComplete(state: TrainerState): boolean {
  return currentNode(state).children.length === 0;
}

export function isUserTurn(state: TrainerState): boolean {
  return !isComplete(state) && sideToMove(currentNode(state)) === state.userColor;
}

export function isBotTurn(state: TrainerState): boolean {
  return !isComplete(state) && sideToMove(currentNode(state)) !== state.userColor;
}

/** Plies left if play continues along the main line of the current branch. */
export function remainingPlies(state: TrainerState): number {
  return mainLineFrom(currentNode(state)).length;
}

/** Whether the move at `index` in the path was a side line rather than the main continuation. */
export function isVariationMove(state: TrainerState, index: number): boolean {
  const parent = index === 0 ? state.tree.root : state.path[index - 1];
  return parent.children[0] !== state.path[index];
}

/** Pick the bot's reply: always the main move, or any PGN move at this position at random. */
export function chooseBotMove(state: TrainerState, mode: OpponentMode, random: () => number = Math.random): number {
  const count = currentNode(state).children.length;
  return mode === "random" ? Math.min(count - 1, Math.floor(random() * count)) : 0;
}

function isLegal(fen: string, from: string, to: string): boolean {
  const chess = new Chess(fen);
  return chess.moves({ square: from as never, verbose: true }).some((m) => m.to === to);
}

function play(
  state: TrainerState,
  node: MoveNode,
  feedback: Feedback,
  alternativesAt = state.alternativesAt,
): TrainerState {
  return {
    ...state,
    path: [...state.path, node],
    alternativesAt,
    attempts: 0,
    hint: null,
    rejected: null,
    feedback: node.children.length === 0 ? "complete" : feedback,
  };
}

export function trainerReducer(state: TrainerState, action: TrainerAction): TrainerState {
  switch (action.type) {
    case "userMove": {
      if (!isUserTurn(state)) return state;
      const node = currentNode(state);
      // Any move from the PGN at this position counts: the main line or one of its variations.
      const match = node.children.find((c) => c.from === action.from && c.to === action.to);
      if (match) {
        const feedback = match === node.children[0] ? "correct" : "variation";
        return play(state, match, feedback, node.children.length > 1 ? state.path.length : null);
      }

      const attempts = state.attempts + 1;
      const showHint = attempts >= HINT_AFTER_ATTEMPTS;
      const main = node.children[0];
      return {
        ...state,
        attempts,
        hint: showHint ? { from: main.from, to: main.to } : null,
        feedback: showHint ? "hint" : isLegal(node.fen, action.from, action.to) ? "wrong" : "illegal",
        rejected: { square: action.to, id: (state.rejected?.id ?? 0) + 1 },
      };
    }
    case "botMove": {
      if (action.ply !== state.path.length || !isBotTurn(state)) return state;
      const child = currentNode(state).children[action.choice];
      if (!child) return state;
      return play(state, child, state.feedback);
    }
    case "playAlternative": {
      const { at, choice } = action;
      if (at > state.path.length) return state;
      const node = nodeAt(state, at);
      const child = node.children[choice];
      if (!child || sideToMove(node) !== state.userColor) return state;
      const rewound = { ...state, path: state.path.slice(0, at) };
      return play(rewound, child, child === node.children[0] ? "correct" : "variation", at);
    }
    case "retract": {
      const target = retractTarget(state);
      if (target === null) return state;
      return {
        ...state,
        path: state.path.slice(0, target),
        attempts: 0,
        hint: null,
        rejected: null,
        feedback: "idle",
        alternativesAt: null,
      };
    }
    case "restart":
      return initTrainer(state.tree, state.userColor);
  }
}

function nodeAt(state: TrainerState, ply: number): PositionNode {
  return ply === 0 ? state.tree.root : state.path[ply - 1];
}

/** The most recent earlier ply at which it was the user's turn, or null if there is none. */
export function retractTarget(state: TrainerState): number | null {
  for (let p = state.path.length - 1; p >= 0; p--) {
    if (sideToMove(nodeAt(state, p)) === state.userColor) return p;
  }
  return null;
}

/** The other PGN moves the user could have played instead of their latest move, if any. */
export function alternatives(state: TrainerState): { at: number; moves: { move: MoveNode; choice: number }[] } | null {
  const at = state.alternativesAt;
  if (at === null || at >= state.path.length) return null;
  const played = state.path[at];
  const moves = nodeAt(state, at)
    .children.map((move, choice) => ({ move, choice }))
    .filter(({ move }) => move !== played);
  return moves.length ? { at, moves } : null;
}

/** Encode a path as child indices (serializable, e.g. for sessionStorage), and back. */
export function pathToIndices(tree: GameTree, path: MoveNode[]): number[] {
  const out: number[] = [];
  let node: PositionNode = tree.root;
  for (const move of path) {
    out.push(node.children.indexOf(move));
    node = move;
  }
  return out;
}

export function indicesToPath(tree: GameTree, indices: number[]): MoveNode[] | null {
  const path: MoveNode[] = [];
  let node: PositionNode = tree.root;
  for (const i of indices) {
    const next = node.children[i];
    if (!next) return null;
    path.push(next);
    node = next;
  }
  return path;
}
