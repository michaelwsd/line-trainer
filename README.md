# Line Trainer

Paste a PGN, choose White or Black, and drill the main line. The bot plays the opponent's moves from the PGN; you drag your own pieces. A wrong move is rejected, and after a second miss the correct from/to squares light up. Variations in parentheses are ignored.

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
