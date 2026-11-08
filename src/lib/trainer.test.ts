import { describe, expect, it } from "vitest";
import { SAMPLE_PGN } from "./sample";
import {
  currentFen,
  initTrainer,
  isBotTurn,
  isComplete,
  isUserTurn,
  parsePgn,
  retractTarget,
  trainerReducer,
  type ParsedLine,
  type TrainerState,
} from "./trainer";

function line(pgn = SAMPLE_PGN): ParsedLine {
  const r = parsePgn(pgn);
  if (!r.ok) throw new Error(r.error);
  return r.line;
}

function play(state: TrainerState, ...moves: [string, string][]): TrainerState {
  let s = state;
  for (const [from, to] of moves) {
    s = trainerReducer(s, { type: "userMove", from, to });
    if (isBotTurn(s)) s = trainerReducer(s, { type: "botMove", ply: s.ply });
  }
  return s;
}

describe("parsePgn", () => {
  it("keeps only the main line of the sample", () => {
    const l = line();
    expect(l.moves).toHaveLength(43);
    expect(
      l.moves
        .slice(0, 12)
        .map((m) => m.san)
        .join(" "),
    ).toBe("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 h6 O-O d6");
    expect(l.moves.at(-1)?.san).toBe("Nf1");
    expect(l.fens).toHaveLength(44);
  });

  it("rejects empty and illegal input", () => {
    expect(parsePgn("   ")).toMatchObject({ ok: false });
    expect(parsePgn("1. e4 e5 2. Ke3 Ke6 3. Qh8")).toMatchObject({ ok: false });
    expect(parsePgn("*")).toMatchObject({ ok: false });
  });

  it("handles headers, comments and results", () => {
    const l = line('[White "A"]\n[Black "B"]\n\n1. d4 {main} d5 $1 2. c4 1-0');
    expect(l.moves.map((m) => m.san)).toEqual(["d4", "d5", "c4"]);
    expect(l.headers.White).toBe("A");
  });
});

describe("trainerReducer as White", () => {
  it("accepts the correct move and lets the bot reply", () => {
    let s = initTrainer(line(), "white");
    expect(isUserTurn(s)).toBe(true);
    s = trainerReducer(s, { type: "userMove", from: "e2", to: "e4" });
    expect(s.ply).toBe(1);
    expect(s.feedback).toBe("correct");
    expect(isBotTurn(s)).toBe(true);
    s = trainerReducer(s, { type: "botMove", ply: 1 });
    expect(s.ply).toBe(2);
    expect(isUserTurn(s)).toBe(true);
  });

  it("rejects a wrong move, then reveals the squares on the second miss", () => {
    let s = initTrainer(line(), "white");
    s = trainerReducer(s, { type: "userMove", from: "d2", to: "d4" });
    expect(s.ply).toBe(0);
    expect(s.feedback).toBe("wrong");
    expect(s.hint).toBeNull();
    s = trainerReducer(s, { type: "userMove", from: "g1", to: "f3" });
    expect(s.feedback).toBe("hint");
    expect(s.hint).toEqual({ from: "e2", to: "e4" });
    s = trainerReducer(s, { type: "userMove", from: "e2", to: "e4" });
    expect(s.hint).toBeNull();
    expect(s.attempts).toBe(0);
  });

  it("labels illegal moves distinctly", () => {
    const s = trainerReducer(initTrainer(line(), "white"), { type: "userMove", from: "e2", to: "e5" });
    expect(s.feedback).toBe("illegal");
    expect(s.rejected?.square).toBe("e5");
  });

  it("ignores user moves on the bot's turn and stale bot timers", () => {
    let s = trainerReducer(initTrainer(line(), "white"), { type: "userMove", from: "e2", to: "e4" });
    expect(trainerReducer(s, { type: "userMove", from: "e7", to: "e5" })).toBe(s);
    expect(trainerReducer(s, { type: "botMove", ply: 0 })).toBe(s);
    s = trainerReducer(s, { type: "retract" });
    expect(s.ply).toBe(0);
    expect(trainerReducer(s, { type: "botMove", ply: 1 })).toBe(s);
  });

  it("retracts to the previous user turn", () => {
    let s = play(initTrainer(line(), "white"), ["e2", "e4"], ["g1", "f3"]);
    expect(s.ply).toBe(4);
    s = trainerReducer(s, { type: "retract" });
    expect(s.ply).toBe(2);
    s = trainerReducer(s, { type: "retract" });
    expect(s.ply).toBe(0);
    expect(retractTarget(s)).toBeNull();
    expect(trainerReducer(s, { type: "retract" })).toBe(s);
  });

  it("completes the line", () => {
    const l = line();
    let s = initTrainer(l, "white");
    for (const m of l.moves) {
      s = isUserTurn(s)
        ? trainerReducer(s, { type: "userMove", from: m.from, to: m.to })
        : trainerReducer(s, { type: "botMove", ply: s.ply });
    }
    expect(isComplete(s)).toBe(true);
    expect(s.feedback).toBe("complete");
    expect(currentFen(s)).toBe(l.fens.at(-1));
    // Last move was White's, so retract goes back one ply.
    expect(trainerReducer(s, { type: "retract" }).ply).toBe(l.moves.length - 1);
  });
});

describe("trainerReducer as Black", () => {
  it("starts with the bot to move and cannot retract past its first move", () => {
    let s = initTrainer(line(), "black");
    expect(isBotTurn(s)).toBe(true);
    s = trainerReducer(s, { type: "botMove", ply: 0 });
    expect(isUserTurn(s)).toBe(true);
    expect(retractTarget(s)).toBeNull();
    s = play(s, ["e7", "e5"]);
    expect(s.ply).toBe(3);
    s = trainerReducer(s, { type: "retract" });
    expect(s.ply).toBe(1);
  });
});
