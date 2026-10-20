import { test, expect, type Page } from "@playwright/test";

const prefix = "reveal-cards:v1:";
const finalUrl = "/?stage=4&battle=poker&robot=all-games-last";

async function seedProgress(page: Page, expired = false) {
  // Isolated legacy-save fixtures; the full-clear suite still uses UI-only progress.
  await page.addInitScript(({ prefix, expired }) => {
    if (sessionStorage.getItem("test:resume-seeded")) return;
    sessionStorage.setItem("test:resume-seeded", "true");
    const data = {
      "stage-4:CasinoGame:activeBattle": { gameType: "poker", robotId: "all-games-last" },
      "stage-4:PokerBattle:all-games-last:finalPhase": 2,
      "stage-4:PokerBattle:all-games-last:scannedPokerCardIds": ["scan-A"],
      "ability:copy-paste:unlocked": true,
      "__last-played-at": Date.now() - (expired ? 31 * 24 * 60 * 60 * 1000 : 0),
    };
    for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
    localStorage.setItem("other-app:key", "keep");
  }, { prefix, expired });
}

test("yes resumes the furthest legacy save without overwriting it before answering", async ({ page }, testInfo) => {
  await seedProgress(page);
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "続きから再開しますか？" });
  await expect(dialog).toBeVisible();
  await dialog.screenshot({ path: testInfo.outputPath("resume-confirmation.png") });
  expect(await page.evaluate((prefix) => Object.keys(localStorage).some((key) => key.startsWith(prefix + "stage-1:")), prefix)).toBe(false);
  await dialog.getByRole("button", { name: "はい", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("stage=4&battle=poker&robot=all-games-last$"));
  await expect(page.getByRole("dialog", { name: "続きから再開しますか？" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "やること", exact: true })).toContainText("まずはスキャンでカードを2枚生成しよう");
  expect(await page.evaluate((prefix) => JSON.parse(localStorage.getItem(prefix + "stage-4:PokerBattle:all-games-last:scannedPokerCardIds")!), prefix)).toEqual(["scan-A"]);
});

test("no explicitly discards all progress and initializes the current URL", async ({ page }) => {
  await seedProgress(page);
  const current = "/?stage=2&battle=blackjack&robot=blackjack-2-3";
  await page.goto(current);
  const dialog = page.getByRole("dialog", { name: "続きから再開しますか？" });
  await expect(dialog).toContainText("保存済みの進捗をすべて破棄");
  await dialog.getByRole("button", { name: "いいえ（進捗を破棄）", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp("stage=2&battle=blackjack&robot=blackjack-2-3$"));
  await expect(page.getByRole("button", { name: "やること", exact: true })).toBeVisible();
  expect(await page.evaluate((prefix) => Object.keys(localStorage).some((key) => key.startsWith(prefix + "stage-4:")), prefix)).toBe(false);
  expect(await page.evaluate((prefix) => localStorage.getItem(prefix + "ability:copy-paste:unlocked"), prefix)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("other-app:key"))).toBe("keep");
  await page.reload();
  await expect(page.getByRole("dialog", { name: "続きから再開しますか？" })).toHaveCount(0);
});

test("same saved URL and reload do not ask to resume", async ({ page }) => {
  await seedProgress(page);
  await page.goto(finalUrl);
  await expect(page.getByRole("button", { name: "やること", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "続きから再開しますか？" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "やること", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "続きから再開しますか？" })).toHaveCount(0);
});

test("expired progress starts fresh without prompting", async ({ page }) => {
  await seedProgress(page, true);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "始める", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "続きから再開しますか？" })).toHaveCount(0);
  expect(await page.evaluate((prefix) => localStorage.getItem(prefix + "stage-4:PokerBattle:all-games-last:finalPhase"), prefix)).toBeNull();
});

test("in-game links to an earlier page do not prompt or lower the checkpoint", async ({ page }) => {
  await seedProgress(page);
  await page.addLocatorHandler(page.locator("[data-tutorial-card]").last(), async (dialog) => {
    await dialog.locator("p").first().click();
    if (await dialog.isVisible()) await dialog.locator("[data-tutorial-dismiss]").click();
  }, { noWaitAfter: true });
  await page.goto(finalUrl);
  await page.getByRole("link", { name: "ゲーム会場へ", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("stage=4&battle=poker&robot=all-games-last$"));
  await expect(page.getByRole("button", { name: "ゲームテーブルへ", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "やること", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "続きから再開しますか？" })).toHaveCount(0);
  expect(await page.evaluate((prefix) => JSON.parse(localStorage.getItem(prefix + "resume:checkpoint")!).rank, prefix)).toBe(411);
  expect(await page.evaluate(() => sessionStorage.getItem("cacacasino.internalNavigation"))).toBeNull();
});
