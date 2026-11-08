"use client";

import { useState } from "react";
import type { Color, ParsedLine } from "@/lib/trainer";
import { PgnSetup } from "./PgnSetup";
import { TrainingSession } from "./TrainingSession";

interface Session {
  line: ParsedLine;
  userColor: Color;
  /** Bumped on every start so the session remounts with fresh state. */
  id: number;
}

export function TrainerApp() {
  const [pgn, setPgn] = useState("");
  const [color, setColor] = useState<Color>("white");
  const [session, setSession] = useState<Session | null>(null);

  return (
    <div className="mx-auto flex h-svh w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-4 flex shrink-0 items-baseline gap-x-4 gap-y-1 max-sm:flex-col sm:mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <span aria-hidden className="mr-2 text-brass">
            ♞
          </span>
          Line Trainer
        </h1>
        <p className="text-sm text-ink-faint max-sm:hidden">Paste a game. Play your side. Learn it by heart.</p>
      </header>

      <main
        // On setup, bottom padding mirrors the header's height (line height + margin) so the card is centered in the viewport.
        className={`flex min-h-0 flex-1 flex-col ${session ? "" : "pb-12 sm:pb-15"}`}
      >
        {session ? (
          <TrainingSession
            key={session.id}
            line={session.line}
            userColor={session.userColor}
            onNewPgn={() => setSession(null)}
          />
        ) : (
          <PgnSetup
            pgn={pgn}
            color={color}
            onPgnChange={setPgn}
            onColorChange={setColor}
            onStart={(line) => setSession((s) => ({ line, userColor: color, id: (s?.id ?? 0) + 1 }))}
          />
        )}
      </main>
    </div>
  );
}
