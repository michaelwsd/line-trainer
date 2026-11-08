"use client";

import { format, useI18n } from "@/i18n/I18nProvider";
import type { MoveNode } from "@/lib/pgn";
import { alternatives, type TrainerState } from "@/lib/trainer";

export const moveLabel = (m: MoveNode) => `${m.moveNumber}${m.color === "w" ? "." : "..."} ${m.san}`;

/** After a move at a branching position, offer the PGN's other moves for the user's side. */
export function AlternativeMoves({
  state,
  onPlay,
}: {
  state: TrainerState;
  onPlay: (at: number, choice: number) => void;
}) {
  const { dict } = useI18n();
  const alts = alternatives(state);
  if (!alts) return null;
  const t = dict.session;

  return (
    <section
      aria-label={t.alternativesTitle}
      data-testid="alternatives"
      className="status-in shrink-0 rounded-xl border border-brass/40 bg-brass/10 px-4 py-2 sm:py-3"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-brass-bright">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-4 w-4 shrink-0"
          aria-hidden
        >
          <path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 9a9 9 0 0 1-9 9" />
        </svg>
        {t.alternativesTitle}
      </p>
      <p className="mt-0.5 text-sm text-ink-soft max-lg:hidden">{t.alternativesDetail}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {alts.moves.map(({ move, choice }) => (
          <button
            key={choice}
            type="button"
            onClick={() => onPlay(alts.at, choice)}
            aria-label={format(t.playInstead, { move: moveLabel(move) })}
            title={format(t.playInstead, { move: moveLabel(move) })}
            className="cursor-pointer rounded-md border border-brass/50 bg-panel-raised px-2.5 py-1 font-mono text-[13px] text-ink transition hover:border-brass hover:bg-[#3d2e22] active:translate-y-px"
          >
            {moveLabel(move)}
          </button>
        ))}
      </div>
    </section>
  );
}
