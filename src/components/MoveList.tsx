"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { currentNode, isComplete, isVariationMove, type TrainerState } from "@/lib/trainer";

interface Slot {
  /** Index into the played path, or null for the pending "?" move. */
  index: number | null;
}

interface Row {
  number: number;
  white?: Slot;
  black?: Slot;
}

/** Played moves are shown; the next move is a "?" so the line is never spoiled. */
export function MoveList({ state }: { state: TrainerState }) {
  const { dict } = useI18n();
  const activeRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const { path, userColor } = state;
  const complete = isComplete(state);

  const rows: Row[] = [];
  const place = (color: "w" | "b", number: number, slot: Slot) => {
    const last = rows.at(-1);
    if (color === "w" || !last || last.number !== number || last.black) rows.push({ number });
    rows[rows.length - 1][color === "w" ? "white" : "black"] = slot;
  };
  path.forEach((m, index) => place(m.color, m.moveNumber, { index }));
  if (!complete) {
    const [, turn, , , , fullmove] = currentNode(state).fen.split(" ");
    place(turn as "w" | "b", Number(fullmove), { index: null });
  }

  useEffect(() => {
    // Scroll only the list itself: scrollIntoView would also scroll the (overflow-hidden) page.
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active) return;
    const l = list.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    if (a.top < l.top) list.scrollTop += a.top - l.top - 8;
    else if (a.bottom > l.bottom) list.scrollTop += a.bottom - l.bottom + 8;
  }, [path]);

  function cell(slot: Slot | undefined) {
    if (!slot) return <span />;
    if (slot.index === null) {
      return (
        <span
          ref={activeRef}
          className="rounded px-1.5 py-0.5 font-mono text-[13px] text-brass ring-1 ring-inset ring-brass/60"
        >
          ?
        </span>
      );
    }
    const move = path[slot.index];
    const isLast = slot.index === path.length - 1;
    const variation = isVariationMove(state, slot.index);
    return (
      <span
        ref={complete && isLast ? activeRef : undefined}
        data-testid="played-move"
        data-variation={variation || undefined}
        title={variation ? dict.session.sideLine : undefined}
        className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[13px] ${
          isLast ? "bg-brass/20 text-brass-bright" : move.color === userColor[0] ? "text-ink" : "text-ink-soft"
        } ${variation ? "italic" : ""}`}
      >
        {move.san}
        {variation && (
          <span aria-label={dict.session.sideLine} className="h-1.5 w-1.5 shrink-0 rounded-full bg-brass/80" />
        )}
      </span>
    );
  }

  return (
    <div className="flex min-h-18 flex-1 flex-col rounded-xl border border-line bg-black/20 lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2 text-xs caps-label text-ink-soft">
        <span>{dict.session.moves}</span>
      </div>
      <ol ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2" data-testid="move-list">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1 px-2 py-0.5">
            <span className="text-right font-mono text-xs text-ink-faint">{r.number}.</span>
            {r.white ? cell(r.white) : <span className="px-1.5 font-mono text-[13px] text-ink-faint">...</span>}
            {cell(r.black)}
          </li>
        ))}
      </ol>
    </div>
  );
}
