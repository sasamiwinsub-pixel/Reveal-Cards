import { test, expect } from "@playwright/test";

test("final scans reject unknown answers and both vehicle scans before the riddle paste without consuming uses", async ({ page }) => {
  await page.addInitScript(() => {
    const prefix = "reveal-cards:v1:";
    const battle = "stage-4:PokerBattle:all-games-last:";
    const data: Record<string, unknown> = {
      "__last-played-at": Date.now(),
      "ability:copy-paste:unlocked": true,
      "stage-4:CasinoGame:activeBattle": { gameType: "poker", robotId: "all-games-last" },
      [battle + "finalPhase"]: 2,
      [battle + "showPreparation"]: true,
      [battle + "pokerPreparationAbility"]: "scan",
      [battle + "pastedBlueTexts"]: { "exchange-start-timing": "ブラックジャック" },
    };
    for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
  });
  await page.goto("/?stage=4&battle=poker&robot=all-games-last");
  const summary = page.getByText("スキャン回答済み", { exact: true }).locator("..");
  for (const entry of [
    { answer: "不正解", reading: "ハイエース" },
    { answer: "ハイキング", reading: "ハイエース" },
    { answer: "ハイキング", reading: "ハイジャック" },
  ]) {
    await page.getByPlaceholder("謎の答えを入力", { exact: true }).fill(entry.answer);
    await page.getByPlaceholder("イラスト読み方を入力", { exact: true }).fill("");
    await page.getByPlaceholder("イラスト読み方を入力", { exact: true }).fill(entry.reading);
    const split = page.locator("div").filter({ has: page.locator(":scope > p", { hasText: "区切り位置" }) }).filter({ visible: true }).first();
    await split.getByRole("button", { name: "/", exact: true }).nth(1).click();
    await page.getByRole("button", { name: "スキャン発動", exact: true }).click();
    await expect(page.getByText("上手くいかないようだ...", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "スキャン 残3", exact: true })).toBeVisible();
    await expect(summary.getByText("ハイ/エース", { exact: true })).toHaveCount(0);
    await expect(summary.getByText("ハイ/ジャック", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("img", { name: "今回スキャンした対象", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("reveal-cards:v1:stage-4:PokerBattle:all-games-last:scannedPokerCardIds") ?? "[]"))).toEqual([]);
  }
});
