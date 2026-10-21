import { test, expect } from "@playwright/test";
import { GAME_CLEAR_PATH } from "../../lib/routes";

test("clear screen links to the supplied X post without publishing it", async ({ page }) => {
  await page.goto(GAME_CLEAR_PATH);
  const link = page.getByRole("link", { name: "Xにポスト", exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  const url = new URL((await link.getAttribute("href"))!);
  expect(url.origin + url.pathname).toBe("https://twitter.com/intent/tweet");
  expect(url.searchParams.get("openExternalBrowser")).toBe("1");
  expect(url.searchParams.get("text")).toBe(
    "WEB謎「Reveal Cards」、ゲームクリア！\n謎解き力と3つの能力を駆使して、全てのカードゲームに勝利した！\n#RevealCards謎\nhttps://reveal-cards-orpin.vercel.app/",
  );
});

test("final explanations expand independently above the X link", async ({ page }, testInfo) => {
  await page.goto(GAME_CLEAR_PATH);
  const first = page.locator("details").filter({ has: page.locator("summary", { hasText: /^ファイナルゲーム解説$/ }) });
  const second = page.locator("details").filter({ has: page.locator("summary", { hasText: /^ファイナルゲームもう1戦解説$/ }) });
  await expect(first.locator("p").first()).toBeHidden();
  await expect(second.locator("p").first()).toBeHidden();
  await first.locator("summary").click();
  await expect(first.locator("p").first()).toContainText("他ゲームでフィールドに置かれたカードも監視");
  await expect(first.locator("p").first()).toBeVisible();
  await second.locator("summary").click();
  await expect(second.locator("p").last()).toContainText("「にじゅういち」と読むことができます");
  await expect(second.locator("p").last()).toBeVisible();
  const link = page.getByRole("link", { name: "Xにポスト", exact: true });
  const linkTop = await link.evaluate((element) => element.getBoundingClientRect().top);
  const explanationBottom = await second.evaluate((element) => element.getBoundingClientRect().bottom);
  expect(explanationBottom).toBeLessThan(linkTop);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("clear-explanations.png"), fullPage: true });
  await first.locator("summary").click();
  await expect(first.locator("p").first()).toBeHidden();
  await expect(second.locator("p").first()).toBeVisible();
});

test("old clear query no longer opens the clear screen and the new path is noindex", async ({ page }) => {
  await page.goto("/?screen=clear");
  await expect(page.getByRole("heading", { name: "ゲームクリア！", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "始める", exact: true })).toBeVisible();
  await page.goto(GAME_CLEAR_PATH);
  await expect(page.getByRole("heading", { name: "ゲームクリア！", exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("clear screen credits show all contributors without horizontal overflow", async ({ page }, testInfo) => {
  await page.goto(GAME_CLEAR_PATH);
  const credits = page.locator("footer");
  await expect(credits.getByRole("heading", { name: "制作", exact: true })).toBeVisible();
  await expect(credits.getByRole("heading", { name: "テストプレイ協力", exact: true })).toBeVisible();
  for (const name of ["ささみカツ@謎解き", "まいたけ 三度の謎と謎解きが好き", "Lexer"]) {
    await expect(credits.getByText(name, { exact: true })).toBeVisible();
  }
  await credits.scrollIntoViewIfNeeded();
  await expect(credits.getByText("カク", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await credits.screenshot({ path: testInfo.outputPath("credits.png") });
});
