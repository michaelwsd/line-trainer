import { Chess, DEFAULT_POSITION } from "chess.js";

/** A position in the game tree. `children[0]` is the main continuation; the rest are variations. */
export interface PositionNode {
  fen: string;
  children: MoveNode[];
}

/** A move, plus the position it leads to. */
export interface MoveNode extends PositionNode {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  color: "w" | "b";
  /** Full-move number of this move (both 1. e4 and 1... e5 are move 1). */
  moveNumber: number;
}

export interface GameTree {
  root: PositionNode;
  headers: Record<string, string>;
}

export type PgnError =
  | { code: "empty" }
  | { code: "noMoves" }
  | { code: "syntax" }
  | { code: "illegalMove"; san: string; moveNumber: number };

export type PgnResult = { ok: true; tree: GameTree } | ({ ok: false } & PgnError);

const TOKEN =
  /\{[^}]*\}|;[^\n]*|\[\s*\w+\s+"(?:[^"\\]|\\.)*"\s*\]|\(|\)|\$\d+|1-0|0-1|1\/2-1\/2|\*|\d+\.+|[^\s(){};[\]]+/g;
const HEADER = /^\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]$/;

/** SAN as written in the wild -> SAN chess.js accepts: drop annotations (!?, e.p.) and accept 0-0 castling. */
function cleanSan(token: string): string {
  return token
    .replace(/e\.p\.$/, "")
    .replace(/[!?]+$/, "")
    .replace(/^0-0-0/, "O-O-O")
    .replace(/^0-0/, "O-O");
}

/**
 * Parse PGN into a tree containing the main line and every (nested) variation.
 * Comments, NAGs, move numbers and results are ignored. Repeated moves at the
 * same position are merged, so overlapping lines share nodes.
 */
export function parsePgnTree(text: string): PgnResult {
  if (!text.trim()) return { ok: false, code: "empty" };

  const headers: Record<string, string> = {};
  const tokens = text.match(TOKEN) ?? [];
  for (const token of tokens) {
    const m = HEADER.exec(token);
    if (m) headers[m[1]] = m[2].replace(/\\(.)/g, "$1");
  }

  let startFen = DEFAULT_POSITION;
  if (headers.FEN) {
    try {
      startFen = new Chess(headers.FEN).fen();
    } catch {
      return { ok: false, code: "syntax" };
    }
  }

  const root: PositionNode = { fen: startFen, children: [] };
  // `current` is where the next move is played; `previous` is the position before the last move,
  // which is where a variation "(" branches from.
  let current: PositionNode = root;
  let previous: PositionNode | null = null;
  const stack: { current: PositionNode; previous: PositionNode | null }[] = [];
  // Parent links let a nested variation find the position before its own first move.
  const parents = new Map<PositionNode, PositionNode>();
  // Shallowest variation depth each move appears at. A variation may repeat a main-line move before the
  // main line itself continues, so children are ordered by this afterwards: the outer line stays main.
  const depth = new Map<MoveNode, number>();

  for (const token of tokens) {
    if (token.startsWith("{") || token.startsWith(";") || token.startsWith("[") || token.startsWith("$")) continue;
    if (/^\d+\.+$/.test(token) || /^\.+$/.test(token) || /^\d+$/.test(token)) continue;
    if (token === "1-0" || token === "0-1" || token === "1/2-1/2" || token === "*") continue;

    if (token === "(") {
      if (!previous) return { ok: false, code: "syntax" };
      stack.push({ current, previous });
      current = previous;
      previous = parents.get(previous) ?? null;
      continue;
    }
    if (token === ")") {
      const frame = stack.pop();
      if (!frame) return { ok: false, code: "syntax" };
      ({ current, previous } = frame);
      continue;
    }

    const chess = new Chess(current.fen);
    const moveNumber = Number(current.fen.split(" ")[5]);
    let move;
    try {
      move = chess.move(cleanSan(token));
    } catch {
      return { ok: false, code: "illegalMove", san: token, moveNumber };
    }
    let node = current.children.find((c) => c.san === move.san);
    if (!node) {
      node = {
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        color: move.color,
        moveNumber,
        fen: move.after,
        children: [],
      };
      current.children.push(node);
      parents.set(node, current);
    }
    depth.set(node, Math.min(depth.get(node) ?? Infinity, stack.length));
    previous = current;
    current = node;
  }

  if (stack.length > 0) return { ok: false, code: "syntax" };
  if (root.children.length === 0) return { ok: false, code: "noMoves" };

  const order = (node: PositionNode) => {
    node.children.sort((a, b) => depth.get(a)! - depth.get(b)!); // stable: equal depths keep PGN order
    node.children.forEach(order);
  };
  order(root);
  return { ok: true, tree: { root, headers } };
}

/** The main line from a node: follow `children[0]` until the end. */
export function mainLineFrom(node: PositionNode): MoveNode[] {
  const line: MoveNode[] = [];
  for (let n = node.children[0]; n; n = n.children[0]) line.push(n);
  return line;
}
