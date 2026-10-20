import { test, expect } from "@playwright/test";

const prefix = "reveal-cards:v1:";
const battle = "stage-4:PokerBattle:all-games-last:";

for (const scenario of [
  { name: "rule first", count: 0, texts: {} },
  { name: "riddle first", count: 1, texts: { "final-riddle-game": "ハイ＆ロー" } },
  { name: "role first", count: 1, texts: { "scan-role-name": "じゅういち" } },
  { name: "rule last", count: 2, texts: { "final-riddle-game": "ハイ＆ロー", "scan-role-name": "じゅういち" } },
  { name: "incorrect paste first", count: 1, texts: { "exchange-start-timing": "ハイ＆ロー" } },
]) {
  test(`one physical-rule paste consumes exactly one use: ${scenario.name}`, async ({ page }) => {
    await page.addInitScript(({ prefix, battle, scenario }) => {
      if (sessionStorage.getItem("test:copy-count-seeded")) return;
      sessionStorage.setItem("test:copy-count-seeded", "true");
      const data: Record<string, unknown> = {
        "__last-played-at": Date.now(),
        "ability:copy-paste:unlocked": true,
        "stage-4:CasinoGame:activeBattle": { gameType: "poker", robotId: "all-games-last" },
        [battle + "finalPhase"]: 2,
        [battle + "showPreparation"]: true,
        [battle + "pokerPreparationAbility"]: "copy-paste",
        [battle + "copyPasteFormat"]: "katakana",
        [battle + "copyPasteUseCount"]: scenario.count,
        [battle + "pastedBlueTexts"]: { "exchange-start-timing": "ブラックジャック", ...scenario.texts },
        [battle + "copiedTargetId"]: "blackjack-declaration",
        [battle + "pasteTargetId"]: "scan-poker",
        [battle + "selectedBlueTexts"]: {
          "blackjack-declaration": { id: "blackjack-declaration", text: "ブラックジャック", label: "ブラックジャック" },
          "scan-poker": { id: "scan-poker", text: "ポーカー", label: "ポーカー" },
        },
      };
      for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
    }, { prefix, battle, scenario });
    await page.goto("/?stage=4&battle=poker&robot=all-games-last");
    const execute = page.getByRole("button", { name: "ペースト実行", exact: true });
    await execute.click();
    const hint = page.locator("[data-tutorial-card]").filter({ hasText: "現物スキャンに目を付けたのは良い着眼点だ" });
    await expect(hint).toBeVisible();
    const expectedCount = scenario.count + 1;
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), prefix + battle + "copyPasteUseCount")).toBe(expectedCount);
    if (expectedCount < 3) await expect(hint).toContainText(`残り${3 - expectedCount}回`);
    else await expect(hint).not.toContainText("残り1回");
    await hint.locator("p").first().click();
    await expect(hint).toHaveCount(0);
    await expect(execute).toBeDisabled();
    await page.reload();
    await expect(execute).toBeDisabled();
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), prefix + battle + "copyPasteUseCount")).toBe(expectedCount);
    await expect(page.getByRole("button", { name: `コピーペースト 残${3 - expectedCount}`, exact: true })).toBeVisible();
    if (expectedCount < 3) {
      await page.getByRole("button", { name: "対象選択を開始", exact: true }).click();
      const spec = page.locator("summary").filter({ hasText: "ブラックジャックの仕様" });
      if (await spec.locator("..").getAttribute("open") === null) await spec.click();
      await page.locator('[data-blue-text-id="blackjack-declaration"]').filter({ visible: true }).click();
      await page.getByRole("button", { name: /^スキャン(?: 残\d+)?$/ }).click();
      await page.locator('[data-blue-text-id="scan-poker"]').filter({ visible: true }).click();
      await page.getByRole("button", { name: `コピーペースト 残${3 - expectedCount}`, exact: true }).click();
      await execute.click();
      await expect(page.getByRole("alert").filter({ hasText: "回数は消費しません" })).toBeVisible();
      expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), prefix + battle + "copyPasteUseCount")).toBe(expectedCount);
      await page.getByRole("button", { name: "対象選択を停止", exact: true }).click();
    }
    if (scenario.name === "incorrect paste first") {
      await page.getByRole("button", { name: "やり直し", exact: true }).click();
      await expect(page.getByRole("button", { name: "コピーペースト 残2", exact: true })).toBeVisible();
      const texts = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), prefix + battle + "pastedBlueTexts");
      expect(texts["scan-poker"]).toBe("ブラックジャック");
      expect(texts["exchange-start-timing"]).toBe("ブラックジャック");
    }
  });
}
