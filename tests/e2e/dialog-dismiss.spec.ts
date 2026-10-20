import { test, expect } from "@playwright/test";

for (const kind of ["tutorial", "player", "image"] as const) {
  test(`${kind} dialog uses its expected dismissal behavior`, async ({ page }, testInfo) => {
    await page.addInitScript((kind) => {
      const prefix = "reveal-cards:v1:";
      const battle = "stage-4:PokerBattle:all-games-last:";
      const data: Record<string, unknown> = {
        "__last-played-at": Date.now(),
        "stage-4:CasinoGame:activeBattle": { gameType: "poker", robotId: "all-games-last" },
        [battle + "finalPhase"]: 2,
        [battle + "finalPhaseDialog"]: kind === "tutorial" ? "report" : null,
        [battle + "showFinalHighLowTimingDialog"]: kind === "player",
        [battle + "expandedPokerRiddle"]: kind === "image" ? { alt: "小謎", src: "/riddles/riddle_1.png" } : null,
      };
      for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
    }, kind);
    await page.goto("/?stage=4&battle=poker&robot=all-games-last");
    const card = kind === "tutorial" ? page.locator("[data-tutorial-card]") : page.getByRole("dialog");
    await expect(card).toBeVisible();
    if (kind === "image") {
      await expect(card.getByRole("img")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("riddle-image-outside-dismiss.png") });
    }
    const body = kind === "tutorial" ? card.locator("p").first()
      : kind === "image" ? card.getByRole("img", { name: "小謎", exact: true })
      : card.getByText(/ハイ＆ロー宣言のタイミング/);
    await body.click({ clickCount: 3 });
    await expect(card).toBeVisible();
    await page.mouse.click(2, 2);
    if (kind === "image") {
      await expect(card).toHaveCount(0);
      return;
    }
    await expect(card).toBeVisible();
    const close = card.getByRole("button", { name: "閉じる", exact: true });
    await close.focus();
    await expect(card).toBeVisible();
    await close.dispatchEvent("pointerdown");
    await expect(card).toBeVisible();
    await close.press("Escape");
    await expect(card).toBeVisible();
    await close.click();
    if (kind === "tutorial") {
      await expect(page.getByText(/能力使用回数を追加したので/)).toBeVisible();
      await page.locator("[data-tutorial-dismiss]").click();
    }
    await expect(card).toHaveCount(0);
  });
}
