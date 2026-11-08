"use client";

import { format, useI18n } from "@/i18n/I18nProvider";
import type { MoveNode } from "@/lib/pgn";
import { alternatives, type Alternatives, type TrainerState } from "@/lib/trainer";

export const moveLabel = (m: MoveNode) => `${m.moveNumber}${m.color === "w" ? "." : "..."} ${m.san}`;

/**
 * After a move at a branching position, offer the PGN's other moves: the user's own alternatives,
 * and the opponent's (so the user can steer the bot into a different variation).
 */
export function AlternativeMoves({
  state,
  onPlay,
}: {
  state: TrainerState;
  onPlay: (at: number, choice: number) => void;
}) {
  const { dict } = useI18n();
  const t = dict.session;
  const groups = [
    { side: "user", label: t.yourAlternatives, action: t.playInstead, alts: alternatives(state, "user") },
    { side: "bot", label: t.botAlternatives, action: t.botPlayInstead, alts: alternatives(state, "bot") },
  ].filter((g): g is typeof g & { alts: Alternatives } => g.alts !== null);
  if (groups.length === 0) return null;

  return (
    <section
      aria-label={t.alternativesTitle}
      data-testid="alternatives"
      className="status-in flex shrink-0 flex-col gap-1.5 rounded-xl border border-brass/40 bg-brass/10 px-4 py-2 sm:gap-2 sm:py-2.5"
    >
      {groups.map(({ side, label, action, alts }) => (
        <div key={side} data-testid={`alternatives-${side}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-brass-bright">
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
            {label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {alts.moves.map(({ move, choice }) => {
              const name = format(action, { move: moveLabel(move) });
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => onPlay(alts.at, choice)}
                  aria-label={name}
                  title={name}
                  className="cursor-pointer rounded-md border border-brass/50 bg-panel-raised px-2.5 py-0.5 font-mono sm:py-1 text-[13px] text-ink transition hover:border-brass hover:bg-[#3d2e22] active:translate-y-px"
                >
                  {moveLabel(move)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
