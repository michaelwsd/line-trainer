import { expect, type Page } from "@playwright/test";
import { mainLineFrom, parsePgnTree } from "../src/lib/pgn";
import { SAMPLE_PGN } from "../src/lib/sample";

export { SAMPLE_PGN };

const sample = parsePgnTree(SAMPLE_PGN);
if (!sample.ok) throw new Error(sample.code);
/** The sample's main line as move nodes (from, to, san, fen). */
export const SAMPLE_MAIN = mainLineFrom(sample.tree.root);

export async function startTraining(page: Page, color: "white" | "black", { pgn = SAMPLE_PGN }: { pgn?: string } = {}) {
  await page.goto("/en");
  await page.getByLabel("Your game").fill(pgn);
  await page.getByText(color === "white" ? "You move first" : "Bot moves first").click();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.getByTestId("board")).toBeVisible();
}

export function square(page: Page, sq: string) {
  return page.locator(`[data-testid="board"] [data-square="${sq}"]`);
}

export async function center(page: Page, sq: string) {
  const box = await square(page, sq).boundingBox();
  if (!box) throw new Error(`square ${sq} not found`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Drag a piece with real pointer events, like a user would. */
export async function drag(page: Page, from: string, to: string) {
  const a = await center(page, from);
  const b = await center(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 6, a.y + 6, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  // dnd-kit swallows clicks for 50ms after a drag ends; a human never clicks that fast.
  await page.waitForTimeout(60);
}

export function piece(page: Page, sq: string) {
  return square(page, sq).locator("[data-piece]");
}

export async function expectPiece(page: Page, sq: string, pieceType: string | null) {
  if (pieceType === null) await expect(piece(page, sq)).toHaveCount(0);
  else await expect(piece(page, sq)).toHaveAttribute("data-piece", pieceType);
}

export async function expectProgress(page: Page, ply: number, total?: number) {
  await expect(page.getByTestId("progress")).toHaveText(new RegExp(`^${ply} / ${total ?? "\\d+"}$`));
}

export const moveLabel = (m: { moveNumber: number; color: string; san: string }) =>
  `${m.moveNumber}${m.color === "w" ? "." : "..."} ${m.san}`;

/**
 * The bot picks among PGN variations at random. After its reply at `ply`, steer it back to the
 * sample's main line the way a user would: with the "opponent's other moves" buttons.
 */
export async function steerBotToMain(page: Page, ply: number) {
  await expectProgress(page, ply + 1);
  const board = page.getByTestId("board");
  const expected = SAMPLE_MAIN[ply];
  if ((await board.getAttribute("data-fen")) !== expected.fen) {
    await page.getByRole("button", { name: `Have the opponent play ${moveLabel(expected)} instead` }).click();
  }
  await expect(board).toHaveAttribute("data-fen", expected.fen);
}

/**
 * Play the sample main line for plies below `until`, as `color`, keeping the bot on the main line.
 * If the last of those plies is the user's, the bot may already be replying when this returns.
 */
export async function playMainUntil(page: Page, color: "white" | "black", until: number) {
  // Resume from the current position, which must be the user's turn (or the bot's opening move).
  let from = await currentPly(page);
  if (color === "black" && from <= 1) {
    await steerBotToMain(page, 0);
    from = 1;
  }
  for (let i = from; i < until; i += 2) {
    await drag(page, SAMPLE_MAIN[i].from, SAMPLE_MAIN[i].to);
    if (i + 1 < until) await steerBotToMain(page, i + 1);
    else await expect.poll(() => currentPly(page)).toBeGreaterThanOrEqual(i + 1);
  }
}

async function currentPly(page: Page): Promise<number> {
  return parseInt((await page.getByTestId("progress").textContent()) ?? "0", 10);
}
