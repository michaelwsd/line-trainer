import { expect, test } from "@playwright/test";
import { drag, expectPiece, expectProgress, playMainUntil, startTraining } from "./helpers";

const status = (page: import("@playwright/test").Page) => page.getByTestId("status");

test.describe("variations", () => {
  test("a side-line move is accepted and the bot follows that branch", async ({ page }) => {
    await startTraining(page, "black");
    await expectProgress(page, 1);
    await playMainUntil(page, "black", 9); // up to 5. d3, Black to move

    // 5... O-O is a variation, not the main 5... h6.
    await drag(page, "e8", "g8");
    await expect(status(page)).toContainText("Correct - side line!");
    await expectPiece(page, "g8", "bK");
    // The bot continues the variation: 6. O-O.
    await expectPiece(page, "g1", "wK");
    // Progress now counts this branch: 11 plies in, 21 total (the 5... O-O line ends at 11. Kxf2).
    await expectProgress(page, 11, 21);
    const castle = page.getByTestId("played-move").filter({ hasText: /^O-O$/ }).first();
    await expect(castle).toHaveAttribute("data-variation", "true");

    // Continue down the branch, including its nested variation 9... Nc5.
    await drag(page, "h7", "h6");
    await expectPiece(page, "d4", "wP"); // 7. d4
    await drag(page, "c5", "b6");
    await expectPiece(page, "e5", "wP"); // 8. dxe5
    await drag(page, "f6", "e4");
    await expectPiece(page, "d5", "wB"); // 9. Bd5
    await drag(page, "e4", "c5");
    await expect(status(page)).toContainText("Correct - side line!");
    await expectPiece(page, "b4", "wP"); // 10. b4
    await drag(page, "c5", "e6");
    await expectPiece(page, "a3", "wN"); // 11. Na3
    await expect(status(page)).toContainText("Line complete!");

    // Take back works inside a variation.
    await page.getByRole("button", { name: "Take back" }).click();
    await expectPiece(page, "c5", "bN");
    await expectPiece(page, "a3", null);
    await expectPiece(page, "b1", "wN");
  });

  test("the main-line move is still accepted where variations exist", async ({ page }) => {
    await startTraining(page, "black");
    await expectProgress(page, 1);
    await playMainUntil(page, "black", 9);
    await drag(page, "h7", "h6");
    await expect(status(page)).toContainText("Correct!");
    await expect(status(page)).not.toContainText("side line");
    await expectProgress(page, 11, 43);
  });

  test("a move in no line at all is still wrong, and the hint shows the main move", async ({ page }) => {
    await startTraining(page, "black");
    await expectProgress(page, 1);
    await playMainUntil(page, "black", 9);
    await drag(page, "a7", "a6");
    await expect(status(page)).toContainText("Not the move in this line");
    await drag(page, "a7", "a6");
    await expect(status(page)).toContainText("Here's the move");
    for (const sq of ["h7", "h6"]) {
      await expect(page.locator(`[data-testid="board"] [data-square="${sq}"] > div`).first()).toHaveCSS(
        "animation-name",
        "hint-pulse",
      );
    }
  });

  test("the bot plays a random PGN move, and the user can make it play another", async ({ page }) => {
    await startTraining(page, "white");
    await playMainUntil(page, "white", 9); // through 5. d3; the bot picks 5... h6 / O-O / d6
    await expectProgress(page, 10);
    const reply = await page.getByTestId("played-move").last().textContent();
    expect(["h6", "O-O", "d6"]).toContain(reply);

    // The two moves the bot did not play are offered.
    const botAlts = page.getByTestId("alternatives-bot");
    const others = ["5... h6", "5... O-O", "5... d6"].filter((l) => !l.endsWith(` ${reply}`));
    await expect(botAlts.getByRole("button")).toHaveText(others);
    await expect(page.getByTestId("alternatives-user")).toHaveCount(0);

    // Make the bot play 5... d6 (or h6 if it already chose d6), then answer in that line.
    const target = reply === "d6" ? "5... h6" : "5... d6";
    await botAlts.getByRole("button", { name: `Have the opponent play ${target} instead` }).click();
    await expectProgress(page, 10);
    if (target === "5... d6") {
      await expectPiece(page, "d6", "bP");
      await drag(page, "a2", "a4"); // 6. a4 in the 5... d6 line
      await expectPiece(page, "a4", "wP");
    } else {
      await expectPiece(page, "h6", "bP");
      await drag(page, "e1", "g1"); // 6. O-O
      await expectPiece(page, "g1", "wK");
    }
    // The user's next move clears the bot's offer.
    await expect(page.getByTestId("alternatives-bot")).toHaveCount(0);
  });

  test("switching language keeps a side-line position", async ({ page }) => {
    await startTraining(page, "black");
    await expectProgress(page, 1);
    await playMainUntil(page, "black", 9);
    await drag(page, "e8", "g8");
    await expectProgress(page, 11, 21);
    const fen = await page.getByTestId("board").getAttribute("data-fen");

    await page.getByRole("link", { name: "中文" }).click();
    await expect(page).toHaveURL(/\/zh$/);
    await expect(page.getByTestId("board")).toHaveAttribute("data-fen", fen!);
    await expectProgress(page, 11, 21);
    await drag(page, "h7", "h6");
    await expectPiece(page, "d4", "wP");
  });

  test("after a move at a branch, the other PGN moves are offered and can be played instead", async ({ page }) => {
    await startTraining(page, "black");
    await expectProgress(page, 1);
    const alts = page.getByTestId("alternatives");

    // No branch at 1... e5: nothing offered.
    await drag(page, "e7", "e5");
    await expectProgress(page, 3);
    await expect(alts).toHaveCount(0);

    await playMainUntil(page, "black", 9);
    await drag(page, "h7", "h6");
    await expect(alts).toBeVisible();
    await expect(alts).toContainText("Your other moves");
    await expect(alts.getByRole("button")).toHaveText(["5... O-O", "5... d6"]);

    // Still offered once the bot has replied (6. O-O).
    await expectProgress(page, 11, 43);
    // The move list keeps the current move in view, even with the panel this full.
    await expect(page.getByTestId("move-list").getByText("?", { exact: true })).toBeInViewport();
    await expectPiece(page, "g1", "wK");

    // Switch to 5... O-O: rewinds the bot's reply and follows that branch.
    await alts.getByRole("button", { name: "Play 5... O-O instead" }).click();
    await expectPiece(page, "g8", "bK");
    await expectPiece(page, "h7", "bP");
    await expect(page.getByTestId("status")).toContainText(/side line|Your move/);
    await expectProgress(page, 11, 21);
    await expect(alts.getByRole("button")).toHaveText(["5... h6", "5... d6"]);

    // Hop to 5... d6, then back to the main move.
    await alts.getByRole("button", { name: "Play 5... d6 instead" }).click();
    await expectPiece(page, "d6", "bP");
    await expectPiece(page, "a4", "wP"); // 6. a4 in that line
    await alts.getByRole("button", { name: "Play 5... h6 instead" }).click();
    await expectPiece(page, "h6", "bP");
    await expectPiece(page, "a2", "wP");
    await expectProgress(page, 11, 43);

    // The next move (no siblings) clears the offer.
    await drag(page, "d7", "d6");
    await expectProgress(page, 13);
    await expect(alts).toHaveCount(0);
  });

  test("alternatives are offered in Chinese too", async ({ page }) => {
    await startTraining(page, "black");
    await expectProgress(page, 1);
    await playMainUntil(page, "black", 9);
    await page.getByRole("link", { name: "中文" }).click();
    await expect(page).toHaveURL(/\/zh$/);
    await drag(page, "h7", "h6");
    const alts = page.getByTestId("alternatives");
    await expect(alts).toContainText("你的其他着法");
    await alts.getByRole("button", { name: "改走 5... d6" }).click();
    await expectPiece(page, "d6", "bP");
  });
});
