import { expect, test } from "@playwright/test";
import { drag, expectPiece, expectProgress, square, startTraining, SAMPLE_PGN } from "./helpers";

test.describe("locale detection", () => {
  test("English browsers are sent to /en", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Line Trainer/);
  });

  test.describe("Chinese browser", () => {
    test.use({ locale: "zh-CN" });

    test("is sent to /zh and sees Chinese UI", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/zh$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
      await expect(page).toHaveTitle("棋谱陪练 - 国际象棋练习");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/棋谱陪练/);
      await expect(page.getByLabel("你的棋谱")).toBeVisible();
      await expect(page.getByRole("button", { name: "开始训练" })).toBeVisible();
    });
  });
});

test.describe("Chinese UI", () => {
  test("shows localized errors", async ({ page }) => {
    await page.goto("/zh");
    await page.getByRole("button", { name: "开始训练" }).click();
    await expect(page.locator("#pgn-error")).toHaveText("请先粘贴 PGN 棋谱。");
    await page.getByLabel("你的棋谱").fill("1. e4 e5 2. Ke3 Qxz9");
    await page.getByRole("button", { name: "开始训练" }).click();
    await expect(page.locator("#pgn-error")).toHaveText("第 2 步：“Ke3” 在该局面下不合规则。");
  });

  test("full training flow works in Chinese", async ({ page }) => {
    await page.goto("/zh");
    await page.getByRole("button", { name: "加载示例" }).click();
    await page.getByText("机器人先走").click();
    await page.getByRole("button", { name: "开始训练" }).click();
    const status = page.getByTestId("status");
    await expectProgress(page, 1);
    await expect(page.getByText("执黑")).toBeVisible();
    await expect(status).toContainText("轮到你走");
    await expect(status).toContainText("请走出黑方第 1 步。");

    await drag(page, "d7", "d5");
    await expect(status).toContainText("这步不在棋谱中");
    await drag(page, "d7", "d6");
    await expect(status).toContainText("正确着法在这里");
    await expect(square(page, "e7").locator("> div").first()).toHaveCSS("animation-name", "hint-pulse");
    await drag(page, "e7", "e5");
    await expectProgress(page, 3);

    await page.getByRole("button", { name: "悔棋" }).click();
    await expectProgress(page, 1);
    await page.getByRole("button", { name: "翻转棋盘" }).click();
    await expect(page.getByTestId("board")).toHaveAttribute("data-orientation", "white");
    await page.getByRole("button", { name: "重新开始" }).click();
    await expectProgress(page, 1);
    await page.getByRole("button", { name: "新棋谱" }).click();
    await expect(page.getByLabel("你的棋谱")).toHaveValue(SAMPLE_PGN);
  });
});

test.describe("language switcher", () => {
  test("switching mid-drill keeps the position, and the choice is remembered", async ({ page }) => {
    await startTraining(page, "white");
    await drag(page, "e2", "e4");
    await expectProgress(page, 2);
    await drag(page, "g1", "f3");
    await expectProgress(page, 4);

    await page.getByRole("link", { name: "中文" }).click();
    await expect(page).toHaveURL(/\/zh$/);
    await expect(page.getByTestId("status")).toContainText("轮到你走");
    await expectProgress(page, 4);
    await expectPiece(page, "f3", "wN");
    await expectPiece(page, "c6", "bN");
    await expect(page.getByTestId("played-move")).toHaveCount(4);

    // Keep playing after the switch, then take back across it.
    await drag(page, "f1", "c4");
    await expectProgress(page, 6);
    await page.getByRole("button", { name: "悔棋" }).click();
    await expectProgress(page, 4);

    // Visiting the bare URL now goes to the remembered language.
    await page.goto("/");
    await expect(page).toHaveURL(/\/zh$/);

    await page.getByRole("link", { name: "EN" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByLabel("Your game")).toBeVisible();
  });

  test("switching on setup keeps the pasted PGN and chosen color", async ({ page }) => {
    await page.goto("/en");
    await page.getByLabel("Your game").fill("1. d4 d5 2. c4 *");
    await page.getByText("Bot moves first").click();
    await page.getByRole("link", { name: "中文" }).click();
    await expect(page).toHaveURL(/\/zh$/);
    await expect(page.getByLabel("你的棋谱")).toHaveValue("1. d4 d5 2. c4 *");
    await expect(page.getByRole("radio", { name: /黑方/ })).toBeChecked();
  });

  test("the active language is marked current", async ({ page }) => {
    await page.goto("/zh");
    await expect(page.getByRole("link", { name: "中文" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "EN" })).not.toHaveAttribute("aria-current");
  });
});

test("unknown locale paths 404", async ({ page }) => {
  const res = await page.goto("/en/nope");
  expect(res?.status()).toBe(404);
});
