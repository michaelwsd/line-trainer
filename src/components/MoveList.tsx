"use client";

import { useEffect, useRef } from "react";
import type { Color, ParsedLine } from "@/lib/trainer";

interface Props {
  line: ParsedLine;
  ply: number;
  userColor: Color;
  complete: boolean;
}

interface Row {
  number: number;
  white?: number;
  black?: number;
}

function buildRows(line: ParsedLine): Row[] {
  const rows: Row[] = [];
  line.moves.forEach((m, i) => {
    const number = Number(line.fens[i].split(" ")[5]);
    if (m.color === "w" || rows.length === 0) rows.push({ number });
    rows[rows.length - 1][m.color === "w" ? "white" : "black"] = i;
  });
  return rows;
}

/** Played moves are shown; upcoming moves stay hidden so the line is never spoiled. */
export function MoveList({ line, ply, userColor, complete }: Props) {
  const rows = buildRows(line);
  const activeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [ply]);

  function cell(i: number | undefined) {
    if (i === undefined) return <span />;
    const played = i < ply;
    const current = i === ply && !complete;
    const userMove = line.moves[i].color === userColor[0];
    return (
      <span
        ref={current || (complete && i === ply - 1) ? activeRef : undefined}
        data-testid={played ? "played-move" : undefined}
        className={`rounded px-1.5 py-0.5 font-mono text-[13px] ${
          played
            ? i === ply - 1
              ? "bg-brass/20 text-brass-bright"
              : userMove
                ? "text-ink"
                : "text-ink-soft"
            : current
              ? "text-brass ring-1 ring-inset ring-brass/60"
              : "text-ink-faint/60"
        }`}
      >
        {played ? line.moves[i].san : current ? "?" : "..."}
      </span>
    );
  }

  const visibleRows = rows.filter((r) => (r.white ?? r.black ?? 0) <= ply);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-black/20">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-ink-soft">
        <span>Moves</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2" data-testid="move-list">
        {visibleRows.map((r) => (
          <li key={r.number} className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1 px-2 py-0.5">
            <span className="text-right font-mono text-xs text-ink-faint">{r.number}.</span>
            {cell(r.white)}
            {cell(r.black)}
          </li>
        ))}
      </ol>
    </div>
  );
}
