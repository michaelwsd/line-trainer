/**
 * English strings. This is the source of truth for the dictionary shape;
 * every other locale must provide the same keys (enforced by the type).
 * Placeholders like {n} are filled in by `format`.
 */
const en = {
  meta: {
    title: "Line Trainer - Chess Practice",
    description: "Paste a PGN and drill every move of the line against a bot that plays the other side.",
  },
  app: {
    name: "Line Trainer",
    tagline: "Paste a game. Play your side. Learn it by heart.",
    language: "Language",
  },
  setup: {
    gameLabel: "Your game",
    loadExample: "Load example",
    help: "Paste PGN text. Variations in parentheses count too - for your moves and the opponent's, which it picks at random.",
    playAs: "Play as",
    white: "White",
    black: "Black",
    start: "Start training",
    errors: {
      empty: "Paste a PGN to get started.",
      noMoves: "That PGN does not contain any moves.",
      syntax: "Could not read that PGN - check the brackets and move text.",
      illegalMove: 'Move {n}: "{san}" is not legal in that position.',
    },
  },
  session: {
    playing: "Playing {color}",
    white: "white",
    black: "black",
    moves: "Moves",
    sideLine: "Side line",
    alternativesTitle: "Other moves in the PGN",
    yourAlternatives: "Your other moves",
    botAlternatives: "Opponent's other moves",
    playInstead: "Play {move} instead",
    botPlayInstead: "Have the opponent play {move} instead",
    flip: "Flip board",
    takeBack: "Take back",
    restart: "Restart",
    newPgn: "New PGN",
  },
  status: {
    yourMove: "Your move",
    findMove: "Find {side}'s move {n}.",
    sideWhite: "White",
    sideBlack: "Black",
    correct: "Correct!",
    variation: "Correct - side line!",
    opponentToMove: "Opponent to move",
    thinking: "Opponent is thinking...",
    wrong: "Not the move in this line",
    illegal: "That move isn't legal",
    tryAgain: "Try again.",
    hintTitle: "Here's the move",
    hintDetail: "Drag the piece on the glowing square to the other glowing square.",
    completeTitle: "Line complete!",
    completeDetail: "You played every move. Restart to drill it again.",
  },
};

export type Dictionary = typeof en;
export default en;
