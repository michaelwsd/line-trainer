import { isBotTurn, isComplete, sideToMove, type TrainerState } from "@/lib/trainer";

type Tone = "neutral" | "good" | "bad" | "hint" | "done";

function describe(state: TrainerState): { tone: Tone; title: string; detail: string } {
  if (isComplete(state)) {
    return { tone: "done", title: "Line complete!", detail: "You played every move. Restart to drill it again." };
  }
  if (isBotTurn(state)) {
    return {
      tone: state.feedback === "correct" ? "good" : "neutral",
      title: state.feedback === "correct" ? "Correct!" : "Opponent to move",
      detail: "Opponent is thinking...",
    };
  }
  const moveNo = state.line.fens[state.ply].split(" ")[5];
  const side = sideToMove(state.line, state.ply) === "white" ? "White" : "Black";
  switch (state.feedback) {
    case "wrong":
      return { tone: "bad", title: "Not the move in this line", detail: "Try again." };
    case "illegal":
      return { tone: "bad", title: "That move isn't legal", detail: "Try again." };
    case "hint":
      return {
        tone: "hint",
        title: "Here's the move",
        detail: "Drag the piece on the glowing square to the other glowing square.",
      };
    default:
      return { tone: "neutral", title: "Your move", detail: `Find ${side}'s move ${moveNo}.` };
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
  const { tone, title, detail } = describe(state);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="status"
      data-tone={tone}
      key={`${state.ply}-${state.attempts}-${tone}`}
      className={`status-in shrink-0 rounded-xl border px-4 py-3 ${toneClasses[tone]}`}
    >
      <p className="font-display text-lg font-semibold leading-snug">{title}</p>
      <p className="mt-0.5 text-sm text-ink">{detail}</p>
    </div>
  );
}
