# Line Trainer

Paste a PGN, choose White or Black, and drill it. You drag your own pieces; the bot replies with moves from the PGN.

- **Variations count.** Any move from the main line or a (nested) variation in parentheses is accepted, and play continues down that branch. The bot picks among the PGN's moves for its side at random.
- **Other moves.** After a move at a branching point, the panel offers the PGN's other moves - yours and the opponent's - so you can switch to a different variation.
- **Mistakes.** A move in no line is rejected; after a second miss the main move's from/to squares light up.
- **English and Chinese.** `/en` and `/zh`, chosen from the browser language and remembered after switching. Switching mid-drill keeps your position.

## Scripts

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Dev server on http://localhost:3000                   |
| `npm run build`     | Production build                                      |
| `npm test`          | Unit tests (Vitest) for PGN parsing and trainer logic |
| `npm run test:e2e`  | Playwright E2E (desktop + mobile) on a prod build     |
| `npm run lint`      | ESLint                                                |
| `npm run typecheck` | TypeScript                                            |

Keyboard: `←` take back, `F` flip board.

# line-trainer
