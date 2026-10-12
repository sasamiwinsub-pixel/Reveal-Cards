import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowReservedExchange, isBlackjackKingExchangeExposed } from "../lib/exchange-timing.ts";

test("deferred exchanges are previews only until the declaration", () => {
  for (const game of ["ready", "high-low", "blackjack", "poker"]) {
    assert.equal(shouldShowReservedExchange({ deferred: true, preparation: false, triggered: false, game }), false);
  }
  assert.equal(shouldShowReservedExchange({ deferred: true, preparation: true, triggered: false, game: "ready" }), true);
});

test("declaration hides the exchange until the next game", () => {
  assert.equal(shouldShowReservedExchange({ deferred: true, preparation: false, triggered: true, game: "blackjack" }), false);
  assert.equal(shouldShowReservedExchange({ deferred: true, preparation: false, triggered: true, game: "poker" }), true);
});

test("normal exchange previews are unchanged", () => {
  assert.equal(shouldShowReservedExchange({ deferred: false, preparation: false, triggered: false, game: "ready" }), true);
});

test("final blackjack declaration exposes exchanging the robot's king with either player card", () => {
  const options = {
    finalStage: true,
    timing: "ブラックジャック",
    declaration: "ブラックジャック",
    playerCardIds: ["A-daia", "K-crub"],
    robotKingCardIds: ["K-heart"],
  };
  for (const playerCardId of options.playerCardIds) {
    for (const pair of [
      { firstCardId: "K-heart", secondCardId: playerCardId },
      { firstCardId: playerCardId, secondCardId: "K-heart" },
    ]) {
      assert.equal(isBlackjackKingExchangeExposed({ ...options, pairs: [pair] }), true);
      assert.equal(isBlackjackKingExchangeExposed({ ...options, pairs: [pair], finalStage: false }), false);
      assert.equal(isBlackjackKingExchangeExposed({ ...options, pairs: [pair], timing: "ゲームスタート" }), false);
      assert.equal(isBlackjackKingExchangeExposed({ ...options, pairs: [pair], declaration: "ハイ＆ロー" }), false);
    }
  }
  for (const pairs of [
    [],
    [{ firstCardId: "A-daia", secondCardId: "scan-K" }],
    [{ firstCardId: "A-daia", secondCardId: "Q-daia" }],
    [{ firstCardId: "K-heart", secondCardId: "scan-K" }],
  ]) assert.equal(isBlackjackKingExchangeExposed({ ...options, pairs }), false);
});
