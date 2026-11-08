"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { saveHandoff, takeHandoff } from "@/lib/handoff";
import { parsePgnTree, type GameTree, type MoveNode } from "@/lib/pgn";
import { indicesToPath, pathToIndices, type Color, type OpponentMode } from "@/lib/trainer";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PgnSetup } from "./PgnSetup";
import { TrainingSession } from "./TrainingSession";

interface Session {
  tree: GameTree;
  userColor: Color;
  opponent: OpponentMode;
  initialPath: MoveNode[];
  /** Bumped on every start so the session remounts with fresh state. */
  id: number;
}

export function TrainerApp() {
  const { dict } = useI18n();
  const [pgn, setPgn] = useState("");
  const [color, setColor] = useState<Color>("white");
  const [opponent, setOpponent] = useState<OpponentMode>("main");
  const [session, setSession] = useState<Session | null>(null);
  const pathRef = useRef<MoveNode[]>([]);

  // Pick up state handed over from the other language's page.
  useEffect(() => {
    const handoff = takeHandoff();
    if (!handoff) return;
    /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage is only readable after hydration */
    setPgn(handoff.pgn);
    setColor(handoff.color);
    setOpponent(handoff.opponent);
    if (handoff.path !== null) {
      const parsed = parsePgnTree(handoff.pgn);
      const initialPath = parsed.ok ? indicesToPath(parsed.tree, handoff.path) : null;
      if (parsed.ok && initialPath) {
        setSession({ tree: parsed.tree, userColor: handoff.color, opponent: handoff.opponent, initialPath, id: 1 });
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const onPathChange = useCallback((path: MoveNode[]) => {
    pathRef.current = path;
  }, []);

  return (
    <div className="mx-auto flex h-svh w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-4 flex shrink-0 items-center justify-between gap-4 sm:mb-6">
        <div className="flex min-w-0 items-baseline gap-x-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            <span aria-hidden className="mr-2 text-brass">
              ♞
            </span>
            {dict.app.name}
          </h1>
          <p className="truncate text-sm text-ink-faint max-sm:hidden">{dict.app.tagline}</p>
        </div>
        <LanguageSwitcher
          onBeforeSwitch={() =>
            saveHandoff({
              pgn,
              color,
              opponent,
              path: session ? pathToIndices(session.tree, pathRef.current) : null,
            })
          }
        />
      </header>

      <main
        // On setup, bottom padding mirrors the header's height (line height + margin) so the card is centered in the viewport.
        className={`flex min-h-0 flex-1 flex-col ${session ? "" : "pb-12 sm:pb-15"}`}
      >
        {session ? (
          <TrainingSession
            key={session.id}
            tree={session.tree}
            userColor={session.userColor}
            opponent={session.opponent}
            initialPath={session.initialPath}
            onPathChange={onPathChange}
            onNewPgn={() => setSession(null)}
          />
        ) : (
          <PgnSetup
            pgn={pgn}
            color={color}
            opponent={opponent}
            onPgnChange={setPgn}
            onColorChange={setColor}
            onOpponentChange={setOpponent}
            onStart={(tree) =>
              setSession((s) => ({ tree, userColor: color, opponent, initialPath: [], id: (s?.id ?? 0) + 1 }))
            }
          />
        )}
      </main>
    </div>
  );
}
