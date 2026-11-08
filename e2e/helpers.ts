import { expect, type Page } from "@playwright/test";
import { mainLineFrom, parsePgnTree } from "../src/lib/pgn";
import { SAMPLE_PGN } from "../src/lib/sample";

export { SAMPLE_PGN };

const sample = parsePgnTree(SAMPLE_PGN);
if (!sample.ok) throw new Error(sample.code);
/** The sample's main line as move nodes (from, to, san, fen). */
export const SAMPLE_MAIN = mainLineFrom(sample.tree.root);

export async function startTraining(
  page: Page,
  color: "white" | "black",
  { pgn = SAMPLE_PGN, opponent = "main" }: { pgn?: string; opponent?: "main" | "random" } = {},
) {
  await page.goto("/en");
  await page.getByLabel("Your game").fill(pgn);
  await page.getByText(color === "white" ? "You move first" : "Bot moves first").click();
  if (opponent === "random") await page.getByText("Variations too").click();
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

/** Play the sample main line up to (not including) ply `until`, as `color`, waiting for each bot reply. */
export async function playMainUntil(page: Page, color: "white" | "black", until: number) {
  for (let i = color === "white" ? 0 : 1; i < until; i += 2) {
    await drag(page, SAMPLE_MAIN[i].from, SAMPLE_MAIN[i].to);
    await expectProgress(page, Math.min(i + 2, until));
  }
}
