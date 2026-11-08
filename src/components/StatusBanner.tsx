"use client";

import type { Dictionary } from "@/i18n/dictionaries/en";
import { format, useI18n } from "@/i18n/I18nProvider";
import { currentNode, isBotTurn, isComplete, sideToMove, type TrainerState } from "@/lib/trainer";

type Tone = "neutral" | "good" | "bad" | "hint" | "done";

function describe(state: TrainerState, t: Dictionary["status"]): { tone: Tone; title: string; detail: string } {
  if (isComplete(state)) {
    return { tone: "done", title: t.completeTitle, detail: t.completeDetail };
  }
  if (isBotTurn(state)) {
    const title = state.feedback === "correct" ? t.correct : state.feedback === "variation" ? t.variation : null;
    return { tone: title ? "good" : "neutral", title: title ?? t.opponentToMove, detail: t.thinking };
  }
  switch (state.feedback) {
    case "wrong":
      return { tone: "bad", title: t.wrong, detail: t.tryAgain };
    case "illegal":
      return { tone: "bad", title: t.illegal, detail: t.tryAgain };
    case "hint":
      return { tone: "hint", title: t.hintTitle, detail: t.hintDetail };
    default: {
      const node = currentNode(state);
      const n = node.fen.split(" ")[5];
      const side = sideToMove(node) === "white" ? t.sideWhite : t.sideBlack;
      return { tone: "neutral", title: t.yourMove, detail: format(t.findMove, { side, n }) };
    }
  }
}

const toneClasses: Record<Tone, string> = {
  neutral: "border-line bg-panel-raised text-ink",
  good: "border-good/30 bg-good/10 text-good",
  bad: "border-bad/40 bg-bad/10 text-bad",
  hint: "border-good/40 bg-good/10 text-good",
  done: "border-brass/50 bg-brass/10 text-brass-bright",
};

export function StatusBanner({ state }: { state: TrainerState }) {
  const { dict } = useI18n();
  const { tone, title, detail } = describe(state, dict.status);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="status"
      data-tone={tone}
      key={`${state.path.length}-${state.attempts}-${tone}`}
      className={`status-in shrink-0 rounded-xl border px-4 py-2 sm:py-3 ${toneClasses[tone]}`}
    >
      <p className="font-display text-base font-semibold leading-snug sm:text-lg">{title}</p>
      <p className="mt-0.5 text-sm text-ink">{detail}</p>
    </div>
  );
}
