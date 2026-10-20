import { test, expect, type Page } from "@playwright/test";
import { GAME_CLEAR_PATH } from "../../lib/routes";

const button = (page: Page, name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true });
const blue = (page: Page, id: string) => page.locator(`[data-blue-text-id="${id}"]`).filter({ visible: true });

async function click(page: Page, name: string | RegExp) {
  await button(page, name).and(page.locator(":not([disabled]):not([aria-disabled='true'])")).first().click();
}

async function enterPreparation(page: Page, stageOne = false) {
  await click(page, "車内で準備");
  if (stageOne) await click(page, "車内へ入る");
}

async function ability(page: Page, name: string) {
  await click(page, new RegExp(`^${name}(?: 残\\d+)?$`));
}

async function exchange(page: Page, first: string, second: string, decision: string | RegExp = /^エクスチェンジ決定/) {
  await click(page, "エクスチェンジ起動");
  if (decision === "エクスチェンジ決定") {
    await expect(page.getByTestId("exchange-mode-frame")).toBeVisible();
    await click(page, "対象選択を停止");
    await expect(page.getByTestId("exchange-mode-frame")).toHaveCount(0);
    await click(page, "エクスチェンジ起動");
    await expect(page.getByTestId("exchange-mode-frame")).toBeVisible();
  }
  await click(page, first);
  if (second.startsWith("scan-")) await page.locator(`[data-card-id="${second}"]`).filter({ visible: true }).click();
  else await click(page, second);
  await click(page, decision);
  if (decision === "エクスチェンジ決定") await expect(page.getByTestId("exchange-mode-frame")).toHaveCount(0);
}

async function returnToTable(page: Page, stageOne = false) {
  await click(page, stageOne ? "ゲームスタートへ" : "ゲームテーブルへ");
}

async function highLow(page: Page, card: string, zone: "HIGH" | "LOW", reloadAtConfirmation = false) {
  await click(page, card);
  await expect(button(page, card)).toHaveAttribute("aria-pressed", "true");
  await page.getByText(zone === "HIGH" ? "H" : "L", { exact: true }).first().click();
  if (reloadAtConfirmation) await page.reload();
  await click(page, "確定");
  if (reloadAtConfirmation) await page.reload();
}

async function blackjack(page: Page, cards: [string, string]) {
  for (const card of cards) {
    await click(page, card);
    await click(page, "プレイヤーフィールドへ配置");
    await click(page, "確定");
  }
}

async function closeResult(page: Page) {
  const close = button(page, "結果表示を閉じる");
  await expect(close).toBeVisible();
  const result = (await close.innerText()).includes("YOU WIN") ? "win" : "lose";
  await page.screenshot({ path: test.info().outputPath(`result-${result}.png`) });
  await page.mouse.click(2, 2);
  await expect(close).toHaveCount(0);
}

async function pokerRound(page: Page, highLowCard: string, zone: "HIGH" | "LOW", blackjackCards: [string, string], field: [string, string]) {
  await click(page, "ゲームスタート");
  await highLow(page, highLowCard, zone);
  await click(page, "ブラックジャックへ");
  await blackjack(page, blackjackCards);
  await click(page, "ポーカーへ");
  for (const card of field) await click(page, card);
  await click(page, "役を決定");
  await closeResult(page);
  await expect(page.getByText("ポーカーまで勝利しました。", { exact: true })).toBeVisible();
}

async function stageTwoRound(page: Page, highLowCard: string, zone: "HIGH" | "LOW", cards: [string, string]) {
  await click(page, "ゲームスタート");
  await highLow(page, highLowCard, zone);
  await blackjack(page, cards);
  await closeResult(page);
  await expect(page.getByText(/YOU WIN。ブラックジャックとハイ＆ローの両方に勝利しました。/)).toBeVisible();
}

async function venue(page: Page, tutorial = false, mapTutorial = false) {
  if (tutorial) {
    await click(page, /のルール$/);
    await click(page, "閉じる");
    await click(page, /の仕様$/);
    await click(page, "閉じる");
  }
  if (mapTutorial) {
    await click(page, "会場MAP");
    await click(page, "会場MAPを閉じる");
  }
  await click(page, "ゲームテーブルへ");
}

async function split(page: Page, indexes: number[], group = 0) {
  const groups = page.locator("div").filter({ has: page.locator(":scope > p", { hasText: "区切り位置" }) });
  const target = groups.filter({ visible: true }).nth(group);
  for (const index of indexes) await target.getByRole("button", { name: "/", exact: true }).nth(index - 1).click();
}

async function scan(page: Page, answer: string, reading: string, indexes: number[]) {
  await page.getByPlaceholder("謎の答えを入力", { exact: true }).fill(answer);
  await page.getByPlaceholder("イラスト読み方を入力", { exact: true }).fill(reading);
  await split(page, indexes);
  await click(page, "スキャン発動");
}

async function copyStart(page: Page, format: string) {
  await ability(page, "コピーペースト");
  await click(page, format);
  await click(page, "対象選択を開始");
}

async function openSpecification(page: Page, name: string) {
  const summary = page.locator("summary").filter({ hasText: name });
  if (await summary.locator("..").getAttribute("open") === null) await summary.click();
}

async function copyCommit(page: Page) {
  await ability(page, "コピーペースト");
  await click(page, "ペースト実行");
  await expect(page.getByText(/ペースト実行しました。/)).toBeVisible();
}

for (const scanOrder of ["A-first", "J-first"] as const) {
test(`opening to final clear through every battle and both final phases (${scanOrder})`, async ({ page }, testInfo) => {
  const errors: string[] = [];
  const tutorialMessages: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Only dismiss ordinary story/tutorial dialogs; no saved-state injection or route skipping.
  await page.addLocatorHandler(page.locator("[data-tutorial-card]").last(), async (dialog) => {
    tutorialMessages.push(await dialog.locator("p").first().innerText());
    await dialog.locator("p").first().click();
    if (await dialog.isVisible()) await dialog.locator("[data-tutorial-dismiss]").click();
  }, { noWaitAfter: true });
  const playerDialog = page.getByRole("dialog").filter({ hasText: "プレイヤー" }).first();
  const dismissPlayerDialog = async (dialog: ReturnType<typeof button>) => { await dialog.getByRole("button", { name: "閉じる", exact: true }).click(); };
  await page.addLocatorHandler(playerDialog, dismissPlayerDialog, { noWaitAfter: true });

  await test.step("Opening and venue tutorial", async () => {
    await page.goto("/");
    await page.getByRole("link", { name: "始める", exact: true }).click();
    await page.getByRole("link", { name: "タイトル画面へ", exact: true }).click();
    await page.getByRole("link", { name: "ゲームスタート", exact: true }).click();
    await venue(page, true, true);
  });

  await test.step("Stage1: tutorial defeat and all three wins", async () => {
    await click(page, "ゲームスタート");
    await highLow(page, "A spade", "LOW");
    await closeResult(page);
    await click(page, "次へ");
    await click(page, "確認");
    await click(page, "車内へ入る");
    await exchange(page, "A spade", "K spade", "エクスチェンジ決定");
    await returnToTable(page, true);
    await click(page, "ゲームスタート");
    await highLow(page, "A daia", "HIGH");
    await closeResult(page);
    await click(page, "2戦目へ");
    await enterPreparation(page, true);
    await exchange(page, "Q spade", "J spade", "エクスチェンジ決定");
    await returnToTable(page, true);
    await click(page, "ゲームスタート");
    await highLow(page, "A heart", "HIGH", true);
    await closeResult(page);
    await click(page, "3戦目へ");
    await enterPreparation(page, true);
    await exchange(page, "Q heart", "A spade", "エクスチェンジ決定");
    await returnToTable(page, true);
    await click(page, "ゲームスタート");
    await highLow(page, "A spade", "HIGH");
    await closeResult(page);
    await click(page, /第2ステージ|2ndStage/);
  });

  await test.step("Stage2 game1: exchange and two wins", async () => {
    await venue(page, true);
    await enterPreparation(page);
    await exchange(page, "A daia", "J spade", "決定");
    await returnToTable(page);
    await stageTwoRound(page, "A heart", "HIGH", ["A heart", "J spade"]);
    await click(page, "2戦目へ");
  });

  await test.step("Stage2 game2: unlock scan, solve papers, physical scan tutorial", async () => {
    await enterPreparation(page);
    await page.getByPlaceholder("答えを入力", { exact: true }).fill("らっと");
    await click(page, "回答");
    await page.getByPlaceholder("数字で回答", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("riddle-one-number-placeholder.png") });
    await page.getByPlaceholder("数字で回答", { exact: true }).fill("0315");
    await page.getByPlaceholder("小謎②の答えを入力").fill("すいり");
    await click(page, "回答");
    const readings = page.getByPlaceholder("イラストの呼称を入力");
    await readings.nth(0).fill("じゅう/しょ");
    await readings.nth(1).fill("くいーん");
    await click(page, "回答");
    await ability(page, "エクスチェンジ");
    await exchange(page, "A heart", "10 spade", "決定");
    await ability(page, "スキャン");
    for (let i = 0; i < 3; i++) await button(page, "5のカードを現物スキャン対象に選択").nth(i).click();
    await click(page, "回答");
    await split(page, [3], -1);
    await click(page, "現物スキャン発動");
    await returnToTable(page);
    await stageTwoRound(page, "A daia", "HIGH", ["A daia", "10 spade"]);
    await click(page, "3戦目へ");
  });

  await test.step("Stage2 game3: consume two queens to create A", async () => {
    await enterPreparation(page);
    const queens = button(page, "Qのカードを現物スキャン対象に選択");
    await expect(queens).toHaveCount(2);
    await queens.nth(0).click();
    await queens.nth(1).click();
    await click(page, "回答");
    await split(page, [2], -1);
    await click(page, "現物スキャン発動");
    await ability(page, "エクスチェンジ");
    await exchange(page, "K spade", "A spade", "決定");
    await returnToTable(page);
    await stageTwoRound(page, "A spade", "HIGH", ["A spade", "Q heart"]);
    await click(page, "4戦目へ");
  });

  await test.step("Stage2 game4: exchange printed riddle, scan 9 and weaken robot", async () => {
    await enterPreparation(page);
    await ability(page, "エクスチェンジ");
    await click(page, "エクスチェンジ起動");
    await ability(page, "スキャン");
    await click(page, "小謎の交換対象: 中央行左側");
    await click(page, "小謎の交換対象: ど真ん中");
    await ability(page, "エクスチェンジ");
    await click(page, "決定");
    await scan(page, "ななめ", "きゅうしょ", [3]);
    await ability(page, "エクスチェンジ");
    await exchange(page, "9 spade", "10 spade", "決定");
    await returnToTable(page);
    await stageTwoRound(page, "K spade", "HIGH", ["K spade", "Q heart"]);
    await click(page, /第3ステージ|3rdStage/);
  });

  await test.step("Stage3 game1: three kings", async () => {
    await venue(page, true);
    await enterPreparation(page);
    await exchange(page, "Q heart", "K spade");
    await returnToTable(page);
    await pokerRound(page, "A daia", "HIGH", ["A daia", "K spade"], ["K crub", "K heart"]);
    await click(page, "2戦目へ");
  });

  await test.step("Stage3 game2: generate zero and A, win three games", async () => {
    await enterPreparation(page);
    await ability(page, "スキャン");
    await scan(page, "フエ", "れいん", [2]);
    await scan(page, "ツーペア", "わんぺあ", [2]);
    await ability(page, "エクスチェンジ");
    await exchange(page, "0 spade", "J daia");
    await exchange(page, "A spade", "K spade");
    await returnToTable(page);
    await pokerRound(page, "A daia", "HIGH", ["A daia", "A spade"], ["A heart", "Q heart"]);
    await click(page, "3戦目へ");
  });

  await test.step("Stage3 game3: unlock copy-paste and change A value", async () => {
    await enterPreparation(page);
    await ability(page, "コピーペースト");
    await page.getByPlaceholder("答えを入力", { exact: true }).fill("りすく");
    await click(page, "回答");
    await copyStart(page, "数字");
    await ability(page, "スキャン");
    await blue(page, "scan-example").click();
    await ability(page, "コピーペースト");
    await openSpecification(page, "ブラックジャックの仕様");
    await blue(page, "blackjack-ace-value").click();
    await copyCommit(page);
    await returnToTable(page);
    await pokerRound(page, "K spade", "HIGH", ["K spade", "Q daia"], ["K crub", "Q heart"]);
    await click(page, "4戦目へ");
  });

  await test.step("Stage3 game4: scan sugoroku to create J", async () => {
    await enterPreparation(page);
    await ability(page, "スキャン");
    await scan(page, "りすく", "すごろく", [1, 2]);
    await ability(page, "エクスチェンジ");
    await exchange(page, "A daia", "J spade");
    await returnToTable(page);
    await pokerRound(page, "A heart", "HIGH", ["A heart", "J spade"], ["A crub", "J crub"]);
    await click(page, /ファイナル/);
    await click(page, "ファイナルゲームへ");
  });

  await test.step("Final: high-low timing paste warns, loses and allows retry", async () => {
    await enterPreparation(page);
    await copyStart(page, "カタカナ");
    await openSpecification(page, "ハイ＆ローの仕様");
    await blue(page, "high-low-declaration").click();
    await ability(page, "エクスチェンジ");
    await blue(page, "exchange-start-timing").click();
    await copyCommit(page);
    await returnToTable(page);
    await page.removeLocatorHandler(playerDialog);
    for (let attempt = 0; attempt < 2; attempt++) {
      await click(page, "ゲームスタート");
      await expect(page.getByRole("dialog")).toContainText("ハイ＆ロー宣言のタイミングでのエクスチェンジしても、ブラックジャックに勝てない気がする。もう一度考えなそう...");
      await expect(page.getByRole("button", { name: "結果表示を閉じる" })).toHaveCount(0);
      await dismissPlayerDialog(playerDialog);
      await closeResult(page);
      await expect(page.getByText("YOU LOSE", { exact: true })).toBeVisible();
      await click(page, "もう一度確認");
    }
    await page.addLocatorHandler(playerDialog, dismissPlayerDialog, { noWaitAfter: true });
    await enterPreparation(page);
    await ability(page, "コピーペースト");
    await click(page, "やり直し");
    await expect(button(page, "コピーペースト 残1")).toBeVisible();
    await returnToTable(page);
  });

  await test.step("Final phase1: declared exchange, intentional defeat and phase2 retry", async () => {
    await enterPreparation(page);
    await copyStart(page, "カタカナ");
    await openSpecification(page, "ブラックジャックの仕様");
    await blue(page, "blackjack-declaration").click();
    await ability(page, "エクスチェンジ");
    await blue(page, "exchange-start-timing").click();
    await copyCommit(page);
    await ability(page, "エクスチェンジ");
    await exchange(page, "A daia", "K crub");
    await exchange(page, "J heart", "K heart");
    await returnToTable(page);
    await click(page, "ゲームスタート");
    await highLow(page, "A daia", "HIGH");
    await click(page, "ブラックジャックへ");
    await blackjack(page, ["A daia", "J heart"]);
    await closeResult(page);
    await expect(page.getByText("YOU LOSE", { exact: true })).toBeVisible();
    await click(page, "もう一度確認");
    await enterPreparation(page);
    await expect(button(page, "スキャン 残3")).toBeVisible();
    await expect(button(page, "コピーペースト 残3")).toBeVisible();
    await expect(page.getByText("ブラックジャック宣言時の手札状況", { exact: true })).toBeVisible();
  });

  await test.step("Final phase2: three copy-pastes, A/J/K scans, hidden king exchange and clear", async () => {
    await expect(button(page, "やること")).toContainText("まずはスキャンでカードを2枚生成しよう");
    await copyStart(page, "カタカナ");
    await openSpecification(page, "ハイ＆ローの仕様");
    await blue(page, "high-low-declaration").click();
    await ability(page, "スキャン");
    await click(page, "小謎④の青字のポーカー");
    await copyCommit(page);
    await copyStart(page, "カタカナ");
    await openSpecification(page, "ブラックジャックの仕様");
    await blue(page, "blackjack-declaration").click();
    await ability(page, "スキャン");
    await blue(page, "scan-poker").click();
    await copyCommit(page);
    await copyStart(page, "平仮名");
    await openSpecification(page, "ブラックジャックの仕様");
    await blue(page, "blackjack-ace-value").click();
    await ability(page, "スキャン");
    await blue(page, "scan-role-name").click();
    await copyCommit(page);
    await ability(page, "スキャン");
    const targets = [
      { reading: "ハイエース", image: /hiace\.png/, name: "hiace" },
      { reading: "ハイジャック", image: /hijack\.png/, name: "hijack" },
    ];
    if (scanOrder === "J-first") targets.reverse();
    for (const target of targets) {
      await scan(page, "ハイキング", target.reading, [2]);
      const preview = page.getByRole("img", { name: "今回スキャンした対象", exact: true });
      await expect(preview).toHaveAttribute("src", target.image);
      await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      await page.getByRole("button", { name: "今回スキャンした対象を拡大表示", exact: true }).screenshot({ path: testInfo.outputPath(`final-${target.name}-scan.png`) });
    }
    await expect(button(page, "やること")).toContainText("全てのゲームで勝利する");
    await click(page, "Aのカードを現物スキャン対象に選択");
    await click(page, "Jのカードを現物スキャン対象に選択");
    await click(page, "現物スキャン");
    await split(page, [1], -1);
    await click(page, "現物スキャン発動");
    await ability(page, "エクスチェンジ");
    await exchange(page, "A daia", "K crub");
    await exchange(page, "J heart", "scan-K");
    await returnToTable(page);
    await pokerRound(page, "A daia", "HIGH", ["A daia", "J heart"], ["K spade", "K daia"]);
    await click(page, "クリア画面へ");
    await expect(page).toHaveURL(new RegExp(`${GAME_CLEAR_PATH}$`));
    await expect(page.getByRole("heading", { name: "ゲームクリア！", exact: true })).toBeVisible();
    await expect(page.getByText("全てのゲームで勝利しました。", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("game-clear.png"), fullPage: true });
  });
  expect(errors, "No uncaught client-side errors during the entire playthrough").toEqual([]);
  expect(tutorialMessages).toContain("2枚生成できたようだね。AとJ以外スキャン生成できないことは保証する");
  expect(tutorialMessages).toContain("現物スキャンに目を付けたのは良い着眼点だ。残り1回のコピーペーストも隠された青字や探索の必要はなく、今表示されているものしか使わないことは保証しよう。後は自力で頑張ると良い");
});
}
