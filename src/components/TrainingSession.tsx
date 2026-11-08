"use client";

import { useCallback, useEffect, useState } from "react";
import { Chessboard, type PieceDropHandlerArgs, type PieceHandlerArgs } from "react-chessboard";
import {
  currentFen,
  initTrainer,
  isBotTurn,
  isComplete,
  isUserTurn,
  retractTarget,
  trainerReducer,
  type Color,
  type ParsedLine,
  type TrainerAction,
  type TrainerState,
} from "@/lib/trainer";
import { MoveList } from "./MoveList";
import { StatusBanner } from "./StatusBanner";

const BOT_DELAY_MS = 550;

interface Props {
  line: ParsedLine;
  userColor: Color;
  onNewPgn: () => void;
}

const opposite = (c: Color): Color => (c === "white" ? "black" : "white");

export function TrainingSession({ line, userColor, onNewPgn }: Props) {
  const [state, setState] = useState<TrainerState>(() => initTrainer(line, userColor));
  const [flipped, setFlipped] = useState(false);
  const orientation = flipped ? opposite(userColor) : userColor;

  const dispatch = useCallback((action: TrainerAction) => setState((s) => trainerReducer(s, action)), []);

  // The bot replies with the next PGN move after a short pause.
  const botPly = isBotTurn(state) ? state.ply : null;
  useEffect(() => {
    if (botPly === null) return;
    const t = setTimeout(() => dispatch({ type: "botMove", ply: botPly }), BOT_DELAY_MS);
    return () => clearTimeout(t);
  }, [botPly, dispatch]);

  const canRetract = retractTarget(state) !== null;
  const retract = useCallback(() => dispatch({ type: "retract" }), [dispatch]);
  const flip = useCallback(() => setFlipped((f) => !f), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        retract();
      } else if (e.key === "f" || e.key === "F") {
        flip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [retract, flip]);

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare || targetSquare === sourceSquare) return false;
    const action: TrainerAction = { type: "userMove", from: sourceSquare, to: targetSquare };
    const next = trainerReducer(state, action);
    setState(next);
    return next.ply > state.ply;
  }

  function canDragPiece({ piece }: PieceHandlerArgs): boolean {
    return isUserTurn(state) && piece.pieceType[0] === userColor[0];
  }

  const squareStyles: Record<string, React.CSSProperties> = {};
  const last = state.ply > 0 ? line.moves[state.ply - 1] : null;
  if (last) {
    squareStyles[last.from] = { backgroundColor: "rgba(232, 196, 80, 0.38)" };
    squareStyles[last.to] = { backgroundColor: "rgba(232, 196, 80, 0.5)" };
  }
  if (state.rejected) {
    squareStyles[state.rejected.square] = {
      ...squareStyles[state.rejected.square],
      animation: `${state.rejected.id % 2 ? "flash-a" : "flash-b"} 900ms ease-out`,
    };
  }
  if (state.hint) {
    const hint: React.CSSProperties = { animation: "hint-pulse 1.4s ease-in-out infinite" };
    squareStyles[state.hint.from] = hint;
    squareStyles[state.hint.to] = hint;
  }

  const total = line.moves.length;
  const progress = Math.round((state.ply / total) * 100);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-8">
      <div className="board-area flex items-start justify-center">
        <div className="board-size">
          <div className="board-frame">
            <div
              className="board-inner"
              data-testid="board"
              data-orientation={orientation}
              data-fen={currentFen(state)}
            >
              <Chessboard
                options={{
                  id: "trainer",
                  position: currentFen(state),
                  boardOrientation: orientation,
                  allowDragging: true,
                  allowDragOffBoard: false,
                  allowDrawingArrows: false,
                  canDragPiece,
                  onPieceDrop,
                  squareStyles,
                  animationDurationInMs: 220,
                  darkSquareStyle: { backgroundColor: "var(--sq-dark)" },
                  lightSquareStyle: { backgroundColor: "var(--sq-light)" },
                  dropSquareStyle: { boxShadow: "inset 0 0 0 3px rgba(255, 248, 230, 0.75)" },
                  draggingPieceStyle: { transform: "scale(1.15)", filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.45))" },
                  draggingPieceGhostStyle: { opacity: 0.35 },
                  darkSquareNotationStyle: { color: "#fbf1de", fontWeight: 700 },
                  lightSquareNotationStyle: { color: "#6e4b2f", fontWeight: 700 },
                  alphaNotationStyle: { fontSize: "clamp(9px, 1.4vw, 12px)", bottom: 1, right: 4 },
                  numericNotationStyle: { fontSize: "clamp(9px, 1.4vw, 12px)", top: 2, left: 3 },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <aside className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-line bg-panel p-4 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] sm:gap-4 sm:p-5 lg:w-[340px] lg:flex-none">
        <div className="flex shrink-0 items-center justify-between text-xs uppercase tracking-[0.14em] text-ink-soft">
          <span>
            Playing <span className="font-semibold text-ink">{userColor}</span>
          </span>
          <span data-testid="progress">
            {state.ply} / {total}
          </span>
        </div>
        <div className="h-1.5 shrink-0 overflow-hidden rounded-full bg-black/40" aria-hidden>
          <div
            className="h-full rounded-full bg-gradient-to-r from-brass to-brass-bright transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <StatusBanner state={state} />

        <div className="grid shrink-0 grid-cols-4 gap-2 lg:grid-cols-2">
          <ControlButton onClick={flip} label="Flip board" shortcut="F" icon={<FlipIcon />} />
          <ControlButton onClick={retract} disabled={!canRetract} label="Take back" shortcut="←" icon={<UndoIcon />} />
          <ControlButton onClick={() => dispatch({ type: "restart" })} label="Restart" icon={<RestartIcon />} />
          <ControlButton onClick={onNewPgn} label="New PGN" icon={<PasteIcon />} />
        </div>

        <MoveList line={line} ply={state.ply} userColor={userColor} complete={isComplete(state)} />
      </aside>
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  icon,
  shortcut,
  disabled,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-line bg-panel-raised px-2 py-2 text-xs font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-brass/60 hover:bg-[#3d2e22] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-line disabled:hover:bg-panel-raised sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm"
    >
      <span className="h-4 w-4 shrink-0 text-brass" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-4 w-4",
} as const;

function FlipIcon() {
  return (
    <svg {...iconProps}>
      <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}
function RestartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
function PasteIcon() {
  return (
    <svg {...iconProps}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}
