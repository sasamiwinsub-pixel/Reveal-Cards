import assert from "node:assert/strict";
import test from "node:test";
import { isFinalFirstPhaseComplete } from "../lib/final-phase.ts";

test("final first phase requires both robot kings and both player cards at blackjack timing", () => {
  for (const [first, second] of [["A-daia", "J-heart"], ["J-heart", "A-daia"]]) {
    const pairs = [{ firstCardId: first, secondCardId: "K-crub" }, { firstCardId: "K-heart", secondCardId: second }];
    assert.equal(isFinalFirstPhaseComplete(pairs, "ブラックジャック"), true);
    assert.equal(isFinalFirstPhaseComplete(pairs, "ゲームスタート"), false);
    assert.equal(isFinalFirstPhaseComplete(pairs.slice(0, 1), "ブラックジャック"), false);
    assert.equal(isFinalFirstPhaseComplete([pairs[0], pairs[0]], "ブラックジャック"), false);
    assert.equal(isFinalFirstPhaseComplete([pairs[0], { firstCardId: second, secondCardId: "scan-K" }], "ブラックジャック"), false);
  }
});
