import { expect, test } from "@playwright/test";
import {
  center,
  drag,
  expectPiece,
  expectProgress,
  playMainUntil,
  square,
  startTraining,
  SAMPLE_MAIN,
  SAMPLE_PGN,
} from "./helpers";

const status = (page: import("@playwright/test").Page) => page.getByTestId("status");

test.describe("setup", () => {
  test("shows an error for invalid PGN and stays on setup", async ({ page }) => {
    await page.goto("/en");
    await page.getByLabel("Your game").fill("1. e4 e5 2. Ke3 Qxz9");
    await page.getByRole("button", { name: "Start training" }).click();
    await expect(page.locator("#pgn-error")).toHaveText('Move 2: "Ke3" is not legal in that position.');
    await expect(page.getByTestId("board")).toHaveCount(0);
  });

  test("setup card is centered in the viewport", async ({ page }) => {
    await page.goto("/en");
    const box = await page.locator("form").boundingBox();
    const vp = page.viewportSize()!;
    expect(Math.abs(box!.y + box!.height / 2 - vp.height / 2)).toBeLessThanOrEqual(4);
    expect(Math.abs(box!.x + box!.width / 2 - vp.width / 2)).toBeLessThanOrEqual(4);
  });

  test("load example fills the textarea", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Load example" }).click();
    await expect(page.getByLabel("Your game")).toHaveValue(SAMPLE_PGN);
  });
});

test.describe("playing as white", () => {
  test("white faces the user and the bot replies with the PGN move", async ({ page }) => {
    await startTraining(page, "white");
    await expect(page.getByTestId("board")).toHaveAttribute("data-orientation", "white");
    // a1 bottom-left, h8 top-right
    const a1 = await center(page, "a1");
    const h8 = await center(page, "h8");
    expect(a1.y).toBeGreaterThan(h8.y);
    expect(a1.x).toBeLessThan(h8.x);
    await expect(status(page)).toContainText("Your move");

    await drag(page, "e2", "e4");
    await expectPiece(page, "e4", "wP");
    await expectPiece(page, "e2", null);
    await expectProgress(page, 2);
    await expectPiece(page, "e5", "bP");
    await expect(status(page)).toContainText("Your move");
  });

  test("wrong move is rejected, second wrong move lights up the correct squares", async ({ page }) => {
    await startTraining(page, "white");
    await drag(page, "e2", "e4");
    await expectProgress(page, 2);

    // Legal but not in the line: piece snaps back.
    await drag(page, "d2", "d4");
    await expect(status(page)).toContainText("Not the move in this line");
    await expect(status(page)).toHaveAttribute("data-tone", "bad");
    await expectPiece(page, "d2", "wP");
    await expectPiece(page, "d4", null);
    await expectProgress(page, 2);
    await expect(square(page, "g1").locator("> div")).not.toHaveCSS("animation-name", "hint-pulse");

    // Second miss: hint on g1 and f3.
    await drag(page, "b1", "c3");
    await expect(status(page)).toContainText("Here's the move");
    await expectPiece(page, "b1", "wN");
    for (const sq of ["g1", "f3"]) {
      await expect(square(page, sq).locator("> div").first()).toHaveCSS("animation-name", "hint-pulse");
    }

    await drag(page, "g1", "f3");
    await expectPiece(page, "f3", "wN");
    await expectProgress(page, 4);
    await expectPiece(page, "c6", "bN");
    await expect(square(page, "g1").locator("> div").first()).not.toHaveCSS("animation-name", "hint-pulse");
  });

  test("illegal move is reported and does not move the piece", async ({ page }) => {
    await startTraining(page, "white");
    await drag(page, "e2", "e5");
    await expect(status(page)).toContainText("isn't legal");
    await expectPiece(page, "e2", "wP");
  });

  test("opponent pieces cannot be dragged", async ({ page }) => {
    await startTraining(page, "white");
    await drag(page, "e7", "e5");
    await expectPiece(page, "e7", "bP");
    await expectProgress(page, 0);
    await expect(status(page)).toContainText("Your move");
  });

  test("click-to-move is not supported, pieces must be dragged", async ({ page }) => {
    await startTraining(page, "white");
    await square(page, "e2").click();
    await square(page, "e4").click();
    await expectPiece(page, "e2", "wP");
    await expectProgress(page, 0);
  });

  test("flip button toggles orientation and back", async ({ page }) => {
    await startTraining(page, "white");
    const board = page.getByTestId("board");
    await page.getByRole("button", { name: "Flip board" }).click();
    await expect(board).toHaveAttribute("data-orientation", "black");
    expect((await center(page, "a1")).y).toBeLessThan((await center(page, "h8")).y);
    // Can still play after flipping.
    await drag(page, "e2", "e4");
    await expectProgress(page, 2);
    await page.getByRole("button", { name: "Flip board" }).click();
    await expect(board).toHaveAttribute("data-orientation", "white");
    await page.keyboard.press("f");
    await expect(board).toHaveAttribute("data-orientation", "black");
  });

  test("take back retracts the last move pair", async ({ page }) => {
    await startTraining(page, "white");
    const takeBack = page.getByRole("button", { name: "Take back" });
    await expect(takeBack).toBeDisabled();
    await drag(page, "e2", "e4");
    await expectProgress(page, 2);
    await drag(page, "g1", "f3");
    await expectProgress(page, 4);

    await takeBack.click();
    await expectProgress(page, 2);
    await expectPiece(page, "g1", "wN");
    await expectPiece(page, "c6", null);
    await expectPiece(page, "e5", "bP");

    await page.keyboard.press("ArrowLeft");
    await expectProgress(page, 0);
    await expectPiece(page, "e2", "wP");
    await expect(takeBack).toBeDisabled();

    // Replay works after retracting.
    await drag(page, "e2", "e4");
    await expectProgress(page, 2);
  });

  test("plays the whole line to completion", async ({ page }) => {
    test.setTimeout(90_000);
    await startTraining(page, "white");
    const moves = SAMPLE_MAIN;
    await playMainUntil(page, "white", moves.length);
    await expect(status(page)).toContainText("Line complete!");
    await expect(page.getByTestId("board")).toHaveAttribute("data-fen", SAMPLE_MAIN.at(-1)!.fen);
    await expect(page.getByTestId("played-move")).toHaveCount(moves.length);
    await expect(page.getByTestId("played-move").last()).toBeInViewport();

    await page.getByRole("button", { name: "Restart" }).click();
    await expectProgress(page, 0);
    await expectPiece(page, "e2", "wP");
  });
});

test.describe("playing as black", () => {
  test("black faces the user and the bot opens with the PGN move", async ({ page }) => {
    await startTraining(page, "black");
    await expect(page.getByTestId("board")).toHaveAttribute("data-orientation", "black");
    const a1 = await center(page, "a1");
    const h8 = await center(page, "h8");
    expect(a1.y).toBeLessThan(h8.y);
    expect(a1.x).toBeGreaterThan(h8.x);

    await expectPiece(page, "e4", "wP");
    await expectProgress(page, 1);
    await expect(page.getByRole("button", { name: "Take back" })).toBeDisabled();

    await drag(page, "e7", "e5");
    await expectProgress(page, 3);
    await expectPiece(page, "f3", "wN");

    await page.getByRole("button", { name: "Take back" }).click();
    await expectProgress(page, 1);
    await expectPiece(page, "e7", "bP");
    await expectPiece(page, "e4", "wP");
  });

  test("new PGN returns to setup with the previous text kept", async ({ page }) => {
    await startTraining(page, "black");
    await page.getByRole("button", { name: "New PGN" }).click();
    await expect(page.getByLabel("Your game")).toHaveValue(SAMPLE_PGN);
    await expect(page.getByRole("radio", { name: /black/i })).toBeChecked();
  });
});

test("the page never scrolls, in setup or after a full line", async ({ page }) => {
  test.setTimeout(90_000);
  const noScroll = async () => {
    const [sw, sh, w, h] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
      window.innerWidth,
      window.innerHeight,
    ]);
    expect(sw).toBeLessThanOrEqual(w);
    expect(sh).toBeLessThanOrEqual(h);
  };
  await page.goto("/en");
  await page.getByRole("button", { name: "Load example" }).click();
  await noScroll();

  await startTraining(page, "white");
  await noScroll();
  const moves = SAMPLE_MAIN;
  await playMainUntil(page, "white", moves.length);
  await noScroll();
  // The move list scrolls internally instead.
  const list = page.getByTestId("move-list");
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
});
