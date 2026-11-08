"use client";

import { useState } from "react";
import { defaultPieces } from "react-chessboard";
import { SAMPLE_PGN } from "@/lib/sample";
import { format, useI18n } from "@/i18n/I18nProvider";
import { parsePgnTree, type GameTree, type PgnError } from "@/lib/pgn";
import type { Color, OpponentMode } from "@/lib/trainer";

interface Props {
  pgn: string;
  color: Color;
  opponent: OpponentMode;
  onPgnChange: (pgn: string) => void;
  onColorChange: (color: Color) => void;
  onOpponentChange: (mode: OpponentMode) => void;
  onStart: (tree: GameTree) => void;
}

export function PgnSetup({ pgn, color, opponent, onPgnChange, onColorChange, onOpponentChange, onStart }: Props) {
  const { dict } = useI18n();
  const t = dict.setup;
  // Kept as a code (not a string) so the message follows the active language.
  const [failure, setFailure] = useState<PgnError | null>(null);
  const error = failure
    ? failure.code === "illegalMove"
      ? format(t.errors.illegalMove, { n: failure.moveNumber, san: failure.san })
      : t.errors[failure.code]
    : null;

  function start(e: React.FormEvent) {
    e.preventDefault();
    const result = parsePgnTree(pgn);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    setFailure(null);
    onStart(result.tree);
  }

  return (
    <form
      onSubmit={start}
      className="mx-auto my-auto flex max-h-full min-h-0 w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] sm:p-8"
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="pgn" className="font-display text-xl font-semibold text-ink">
          {t.gameLabel}
        </label>
        <button
          type="button"
          onClick={() => {
            onPgnChange(SAMPLE_PGN);
            setFailure(null);
          }}
          className="cursor-pointer text-sm text-brass underline-offset-4 transition hover:text-brass-bright hover:underline"
        >
          {t.loadExample}
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-faint">{t.help}</p>

      <textarea
        id="pgn"
        name="pgn"
        value={pgn}
        onChange={(e) => {
          onPgnChange(e.target.value);
          if (failure) setFailure(null);
        }}
        spellCheck={false}
        rows={10}
        placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 ..."
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "pgn-error" : undefined}
        className="mt-4 block min-h-28 w-full flex-1 resize-none rounded-xl border border-line bg-[#1a120c] px-4 py-3 font-mono text-[13px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-brass/60 focus:outline-none focus:ring-2 focus:ring-brass/30"
      />
      {error && (
        <p id="pgn-error" role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}

      <fieldset className="mt-4 shrink-0">
        <legend className="font-display text-xl font-semibold text-ink">{t.playAs}</legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["white", "black"] as const).map((c) => {
            const selected = color === c;
            return (
              <label
                key={c}
                className={`group flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brass/60 sm:gap-3 sm:px-4 ${
                  selected
                    ? "border-brass/70 bg-brass/10 ring-1 ring-brass/40"
                    : "border-line bg-panel-raised/40 hover:border-ink-faint/50"
                }`}
              >
                <input
                  type="radio"
                  name="color"
                  value={c}
                  checked={selected}
                  onChange={() => onColorChange(c)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-1 shadow-inner sm:h-11 sm:w-11 ${
                    c === "white" ? "bg-[#3a2a1e] ring-1 ring-line" : "bg-[#eedcbb]"
                  }`}
                >
                  {defaultPieces[c === "white" ? "wK" : "bK"]({ svgStyle: { width: "100%", height: "100%" } })}
                </span>
                <span className="flex flex-col">
                  <span className="font-medium text-ink">{c === "white" ? t.white : t.black}</span>
                  <span className="text-xs text-ink-soft">{c === "white" ? t.whiteHint : t.blackHint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span id="opponent-label" className="font-display text-base font-semibold text-ink">
            {t.opponent}
          </span>
          <div
            role="radiogroup"
            aria-labelledby="opponent-label"
            className="flex rounded-lg border border-line bg-[#1a120c] p-0.5 text-sm"
          >
            {(["main", "random"] as const).map((mode) => {
              const selected = opponent === mode;
              return (
                <label
                  key={mode}
                  className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brass/50 ${
                    selected ? "bg-brass/20 text-brass-bright" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="opponent"
                    value={mode}
                    checked={selected}
                    onChange={() => onOpponentChange(mode)}
                    className="sr-only"
                  />
                  {mode === "main" ? t.opponentMain : t.opponentRandom}
                </label>
              );
            })}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">
          {opponent === "main" ? t.opponentMainHint : t.opponentRandomHint}
        </p>
      </div>

      <button
        type="submit"
        className="mt-6 w-full shrink-0 cursor-pointer rounded-xl bg-gradient-to-b from-brass-bright to-brass px-5 py-3.5 font-semibold text-[#2a1a0c] shadow-[0_8px_20px_-8px_rgba(212,169,79,0.6),inset_0_1px_0_rgba(255,255,255,0.4)] transition hover:brightness-105 active:translate-y-px"
      >
        {t.start}
      </button>
    </form>
  );
}
