import { describe, expect, it } from "vitest";
import { mainLineFrom, parsePgnTree, type GameTree } from "./pgn";
import { SAMPLE_PGN } from "./sample";
import {
  alternatives,
  chooseBotMove,
  currentFen,
  indicesToPath,
  initTrainer,
  isBotTurn,
  isComplete,
  isUserTurn,
  isVariationMove,
  pathToIndices,
  remainingPlies,
  retractTarget,
  trainerReducer,
  type TrainerState,
} from "./trainer";

function tree(pgn = SAMPLE_PGN): GameTree {
  const r = parsePgnTree(pgn);
  if (!r.ok) throw new Error(r.code);
  return r.tree;
}

const user = (s: TrainerState, from: string, to: string) => trainerReducer(s, { type: "userMove", from, to });
const bot = (s: TrainerState, choice = 0) => trainerReducer(s, { type: "botMove", ply: s.path.length, choice });
const sans = (s: TrainerState) => s.path.map((m) => m.san).join(" ");

/** Play the main line until the position after `plies` plies. */
function advanceMain(s: TrainerState, plies: number): TrainerState {
  for (const m of mainLineFrom(s.tree.root).slice(s.path.length, plies)) {
    s = isUserTurn(s) ? user(s, m.from, m.to) : bot(s);
  }
  return s;
}

describe("as White", () => {
  it("accepts the main move and lets the bot reply", () => {
    let s = initTrainer(tree(), "white");
    s = user(s, "e2", "e4");
    expect(s.feedback).toBe("correct");
    expect(isBotTurn(s)).toBe(true);
    s = bot(s);
    expect(sans(s)).toBe("e4 e5");
    expect(isUserTurn(s)).toBe(true);
  });

  it("rejects a wrong move, then reveals the squares on the second miss", () => {
    let s = initTrainer(tree(), "white");
    s = user(s, "d2", "d4");
    expect(s).toMatchObject({ feedback: "wrong", hint: null, attempts: 1 });
    expect(s.path).toHaveLength(0);
    s = user(s, "g1", "f3");
    expect(s).toMatchObject({ feedback: "hint", hint: { from: "e2", to: "e4" } });
    s = user(s, "e2", "e4");
    expect(s).toMatchObject({ hint: null, attempts: 0 });
  });

  it("labels illegal moves distinctly", () => {
    const s = user(initTrainer(tree(), "white"), "e2", "e5");
    expect(s.feedback).toBe("illegal");
    expect(s.rejected?.square).toBe("e5");
  });

  it("ignores user moves on the bot's turn, stale bot timers and bad choices", () => {
    let s = user(initTrainer(tree(), "white"), "e2", "e4");
    expect(user(s, "e7", "e5")).toBe(s);
    expect(trainerReducer(s, { type: "botMove", ply: 0, choice: 0 })).toBe(s);
    expect(trainerReducer(s, { type: "botMove", ply: 1, choice: 5 })).toBe(s);
    s = trainerReducer(s, { type: "retract" });
    expect(trainerReducer(s, { type: "botMove", ply: 1, choice: 0 })).toBe(s);
  });

  it("the bot can take a variation, and the user must then follow that branch", () => {
    let s = advanceMain(initTrainer(tree(), "white"), 9); // after 5. d3
    expect(chooseBotMove(s, "main")).toBe(0);
    expect(chooseBotMove(s, "random", () => 0.5)).toBe(1);
    expect(chooseBotMove(s, "random", () => 0.99)).toBe(2);
    s = bot(s, 1); // 5... O-O
    expect(sans(s).endsWith("d3 O-O")).toBe(true);
    expect(isVariationMove(s, 9)).toBe(true);
    expect(remainingPlies(s)).toBe(11);
    // The main line's 6. O-O is also this branch's move; the hint follows the branch.
    s = user(s, "a2", "a4");
    s = user(s, "a2", "a4");
    expect(s.hint).toEqual({ from: "e1", to: "g1" });
  });

  it("retracts to the previous user turn", () => {
    let s = advanceMain(initTrainer(tree(), "white"), 4);
    s = trainerReducer(s, { type: "retract" });
    expect(s.path).toHaveLength(2);
    s = trainerReducer(s, { type: "retract" });
    expect(s.path).toHaveLength(0);
    expect(retractTarget(s)).toBeNull();
    expect(trainerReducer(s, { type: "retract" })).toBe(s);
  });

  it("completes the main line", () => {
    const t = tree();
    const s = advanceMain(initTrainer(t, "white"), 43);
    expect(isComplete(s)).toBe(true);
    expect(s.feedback).toBe("complete");
    expect(currentFen(s)).toBe(mainLineFrom(t.root).at(-1)?.fen);
    expect(trainerReducer(s, { type: "retract" }).path).toHaveLength(42);
  });
});

describe("as Black", () => {
  it("starts with the bot to move and cannot retract past its first move", () => {
    let s = initTrainer(tree(), "black");
    expect(isBotTurn(s)).toBe(true);
    s = bot(s);
    expect(retractTarget(s)).toBeNull();
    s = bot(user(s, "e7", "e5"));
    expect(s.path).toHaveLength(3);
    s = trainerReducer(s, { type: "retract" });
    expect(s.path).toHaveLength(1);
  });

  it("accepts a variation move and follows it to its end", () => {
    let s = advanceMain(initTrainer(tree(), "black"), 9); // after 5. d3, Black to move
    expect(isUserTurn(s)).toBe(true);
    s = user(s, "e8", "g8"); // 5... O-O (variation)
    expect(s.feedback).toBe("variation");
    s = bot(s); // 6. O-O
    expect(sans(s).endsWith("O-O O-O")).toBe(true);
    s = user(s, "h7", "h6");
    s = bot(s); // 7. d4
    s = user(s, "c5", "b6");
    s = bot(s); // 8. dxe5
    s = user(s, "f6", "e4");
    s = bot(s); // 9. Bd5
    // Both 9... Nxf2 (main of this branch) and 9... Nc5 (nested variation) are accepted.
    const branch = user(s, "e4", "c5");
    expect(branch.feedback).toBe("variation");
    s = user(s, "e4", "f2");
    expect(s.feedback).toBe("correct");
    s = bot(s); // 10. Rxf2
    s = user(s, "b6", "f2");
    s = bot(s); // 11. Kxf2
    expect(isComplete(s)).toBe(true);
    expect(s.feedback).toBe("complete");
  });
});

describe("path encoding", () => {
  it("round-trips through child indices", () => {
    const t = tree();
    let s = advanceMain(initTrainer(t, "white"), 9);
    s = bot(s, 2); // 5... d6
    const indices = pathToIndices(t, s.path);
    expect(indices.at(-1)).toBe(2);
    expect(indicesToPath(t, indices)).toEqual(s.path);
    expect(indicesToPath(t, [0, 7])).toBeNull();
  });
});

describe("alternatives", () => {
  it("offers the other PGN moves after the user plays at a branching position", () => {
    let s = advanceMain(initTrainer(tree(), "black"), 9); // after 5. d3
    s = user(s, "h7", "h6"); // main move; O-O and d6 are alternatives
    const alts = alternatives(s);
    expect(alts?.at).toBe(9);
    expect(alts?.moves.map((a) => a.move.san)).toEqual(["O-O", "d6"]);
    expect(alts?.moves.map((a) => a.choice)).toEqual([1, 2]);

    // Still offered after the bot replies.
    s = bot(s);
    expect(alternatives(s)?.at).toBe(9);

    // Playing one rewinds past the bot reply and takes the other branch.
    s = trainerReducer(s, { type: "playAlternative", at: 9, choice: 1 });
    expect(sans(s).endsWith("d3 O-O")).toBe(true);
    expect(s.path).toHaveLength(10);
    expect(s.feedback).toBe("variation");
    expect(isBotTurn(s)).toBe(true);
    expect(alternatives(s)?.moves.map((a) => a.move.san)).toEqual(["h6", "d6"]);

    // Back to the main move.
    s = trainerReducer(s, { type: "playAlternative", at: 9, choice: 0 });
    expect(s.feedback).toBe("correct");
    expect(s.path.at(-1)?.san).toBe("h6");
  });

  it("offers nothing where the PGN has a single move, and clears on retract or restart", () => {
    let s = initTrainer(tree(), "black");
    s = user(bot(s), "e7", "e5");
    expect(alternatives(s)).toBeNull();

    s = advanceMain(initTrainer(tree(), "black"), 9);
    s = bot(user(s, "h7", "h6"));
    expect(alternatives(s)).not.toBeNull();
    expect(alternatives(trainerReducer(s, { type: "retract" }))).toBeNull();
    expect(alternatives(trainerReducer(s, { type: "restart" }))).toBeNull();
    // The next user move without siblings clears it too.
    s = user(s, "d7", "d6");
    expect(alternatives(s)).toBeNull();
  });

  it("rejects invalid alternative requests", () => {
    let s = advanceMain(initTrainer(tree(), "black"), 9);
    s = user(s, "h7", "h6");
    expect(trainerReducer(s, { type: "playAlternative", at: 9, choice: 7 })).toBe(s);
    expect(trainerReducer(s, { type: "playAlternative", at: 8, choice: 0 })).toBe(s); // White's turn there
    expect(trainerReducer(s, { type: "playAlternative", at: 40, choice: 0 })).toBe(s);
  });
});
