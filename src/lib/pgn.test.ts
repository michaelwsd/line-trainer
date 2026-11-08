import { describe, expect, it } from "vitest";
import { mainLineFrom, parsePgnTree, type GameTree, type PositionNode } from "./pgn";
import { SAMPLE_PGN } from "./sample";

function tree(pgn: string): GameTree {
  const r = parsePgnTree(pgn);
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.tree;
}

const sans = (n: PositionNode) => n.children.map((c) => c.san);

/** Walk down the tree by SAN. */
function at(t: GameTree, ...moves: string[]): PositionNode {
  let n: PositionNode = t.root;
  for (const san of moves) {
    const next = n.children.find((c) => c.san === san);
    if (!next) throw new Error(`no ${san} after ${moves.join(" ")}`);
    n = next;
  }
  return n;
}

describe("parsePgnTree", () => {
  it("parses the sample main line", () => {
    const main = mainLineFrom(tree(SAMPLE_PGN).root);
    expect(main).toHaveLength(43);
    expect(
      main
        .slice(0, 12)
        .map((m) => m.san)
        .join(" "),
    ).toBe("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 h6 O-O d6");
    expect(main.at(-1)?.san).toBe("Nf1");
    expect(main[9]).toMatchObject({ san: "h6", color: "b", moveNumber: 5, from: "h7", to: "h6" });
  });

  it("keeps every variation, including nested ones", () => {
    const t = tree(SAMPLE_PGN);
    const after5d3 = at(t, "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3");
    expect(sans(after5d3)).toEqual(["h6", "O-O", "d6"]);

    const castleLine = at(t, "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3", "O-O");
    expect(
      mainLineFrom(castleLine)
        .map((m) => m.san)
        .join(" "),
    ).toBe("O-O h6 d4 Bb6 dxe5 Nxe4 Bd5 Nxf2 Rxf2 Bxf2+ Kxf2");
    const nested = at(t, "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3", "O-O", "O-O", "h6", "d4", "Bb6");
    expect(
      sans(
        at(
          t,
          ...[
            "e4",
            "e5",
            "Nf3",
            "Nc6",
            "Bc4",
            "Bc5",
            "c3",
            "Nf6",
            "d3",
            "O-O",
            "O-O",
            "h6",
            "d4",
            "Bb6",
            "dxe5",
            "Nxe4",
            "Bd5",
          ],
        ),
      ),
    ).toEqual(["Nxf2", "Nc5"]);
    expect(nested.children).toHaveLength(1);

    const move11 = at(
      t,
      ...mainLineFrom(t.root)
        .slice(0, 21)
        .map((m) => m.san),
    );
    expect(sans(move11)).toEqual(["Qe8", "Re8"]);
  });

  it("merges repeated moves and handles comments, NAGs, headers and loose notation", () => {
    const t = tree(
      '[Event "Test"]\n[White "A \\"B\\""]\n\n1.e4 {best by test} e5 $1 (1... c5!? 2. Nf3) (1... e5 2. Bc4) 2. Nf3 ; comment\n 2... Nc6 3. Bc4 Nf6 4. 0-0?? *',
    );
    expect(t.headers).toEqual({ Event: "Test", White: 'A "B"' });
    expect(sans(at(t, "e4"))).toEqual(["e5", "c5"]);
    expect(sans(at(t, "e4", "e5"))).toEqual(["Nf3", "Bc4"]);
    expect(sans(at(t, "e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"))).toEqual(["O-O"]);
  });

  it("honors a FEN start position", () => {
    const t = tree('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 40"]\n\n40... Kd7 41. e4 *');
    expect(t.root.children[0]).toMatchObject({ san: "Kd7", color: "b", moveNumber: 40 });
  });

  it("reports errors", () => {
    expect(parsePgnTree("  ")).toEqual({ ok: false, code: "empty" });
    expect(parsePgnTree("*")).toEqual({ ok: false, code: "noMoves" });
    expect(parsePgnTree("1. e4 e5 2. Ke3 Qxz9")).toEqual({ ok: false, code: "illegalMove", san: "Ke3", moveNumber: 2 });
    expect(parsePgnTree("1. e4 (1. d4")).toEqual({ ok: false, code: "syntax" });
    expect(parsePgnTree("1. e4 e5)")).toEqual({ ok: false, code: "syntax" });
    expect(parsePgnTree("(1. d4) 1. e4")).toEqual({ ok: false, code: "syntax" });
  });
});
