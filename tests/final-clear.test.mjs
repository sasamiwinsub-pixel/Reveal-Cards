import assert from "node:assert/strict";
import test from "node:test";
import { isFinalGameClear, isFinalAllInPreparation } from "../lib/final-clear.ts";
import { applyExchangePairs } from "../lib/card-exchange.ts";

test("final correct preparation makes the robot all-in with either king allocation", () => {
  const variants = [
    [{ firstCardId: "K-crub", secondCardId: "J-heart" }, { firstCardId: "A-daia", secondCardId: "scan-K" }],
    [{ firstCardId: "K-crub", secondCardId: "A-daia" }, { firstCardId: "scan-K", secondCardId: "J-heart" }],
  ];
  for (const pairs of variants) {
    const preparation = {
      exchangeTiming: "ブラックジャック",
      declaration: "ブラックジャック",
      riddleGame: "ハイ＆ロー",
      scanGame: "ブラックジャック",
      scanRole: "じゅういち",
      playerRanks: applyExchangePairs(["A-daia", "J-heart"], pairs).map((id) => id === "scan-K" ? "K" : id.split("-")[0]),
      fieldRanks: ["K", "K", "Q", "J"],
      robotRanks: ["A", "A"],
    };
    assert.equal(isFinalAllInPreparation(preparation), true);
    assert.equal(isFinalAllInPreparation({ ...preparation, exchangeTiming: "ゲームスタート" }), false);
    assert.equal(isFinalAllInPreparation({ ...preparation, riddleGame: "ポーカー" }), false);
    assert.equal(isFinalAllInPreparation({ ...preparation, scanGame: "ポーカー" }), false);
    assert.equal(isFinalAllInPreparation({ ...preparation, scanRole: "役名" }), false);
    assert.equal(isFinalAllInPreparation({ ...preparation, playerRanks: ["A", "J"] }), false);
    assert.equal(isFinalAllInPreparation({ ...preparation, fieldRanks: ["K", "Q", "Q", "J"] }), false);
    assert.equal(isFinalAllInPreparation({ ...preparation, robotRanks: ["A", "K"] }), false);
    assert.equal(isFinalAllInPreparation({ ...preparation, declaration: "ハイ＆ロー" }), false);
  }
});

test("final clear requires all three wins and zero robot chips", () => {
  const results = { highLow: "win", blackjack: "win", poker: "win", robotChips: 0 };
  assert.equal(isFinalGameClear(results), true);
  assert.equal(isFinalGameClear({ ...results, robotChips: 1 }), false);
  for (const game of ["highLow", "blackjack", "poker"]) {
    for (const outcome of [null, "draw", "lose"]) {
      assert.equal(isFinalGameClear({ ...results, [game]: outcome }), false);
    }
  }
});
