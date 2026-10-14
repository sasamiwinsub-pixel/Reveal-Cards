import assert from "node:assert/strict";
import test from "node:test";
import { applyExchangePairs } from "../lib/card-exchange.ts";

test("third stage fourth battle accepts exchanging either ace for the generated jack", () => {
  for (const ace of ["A-daia", "A-heart"]) {
    const hand = applyExchangePairs(["A-daia", "A-heart"], [{ firstCardId: ace, secondCardId: "scan-J" }]);
    assert.equal(hand.filter((id) => id.startsWith("A-")).length, 1);
    assert.equal(hand.filter((id) => id === "scan-J").length, 1);
  }
});

test("declaration exchange preserves the positions of placed blackjack cards", () => {
  for (const [aceKing, jackKing] of [["scan-K", "K-crub"], ["K-crub", "scan-K"]]) {
    const pairs = [
      { firstCardId: "A-daia", secondCardId: aceKing },
      { firstCardId: "J-heart", secondCardId: jackKing },
    ];
    assert.deepEqual(applyExchangePairs(["A-daia", "J-heart"], pairs), [aceKing, jackKing]);
  }
});

test("final stage accepts either allocation of the two kings", () => {
  const variants = [
    [{ firstCardId: "K-crub", secondCardId: "J-heart" }, { firstCardId: "A-daia", secondCardId: "scan-K" }],
    [{ firstCardId: "K-crub", secondCardId: "A-daia" }, { firstCardId: "scan-K", secondCardId: "J-heart" }],
  ];
  for (const pairs of variants) {
    for (const orderedPairs of [pairs, [...pairs].reverse()]) {
      assert.deepEqual(applyExchangePairs(["A-daia", "J-heart"], orderedPairs).sort(), ["K-crub", "scan-K"]);
      assert.deepEqual(applyExchangePairs(["K-spade", "K-daia"], orderedPairs), ["K-spade", "K-daia"]);
      assert.deepEqual(applyExchangePairs(["A-spade", "A-heart"], orderedPairs), ["A-spade", "A-heart"]);
      const reversedEndpoints = orderedPairs.map((pair) => ({ firstCardId: pair.secondCardId, secondCardId: pair.firstCardId }));
      assert.deepEqual(applyExchangePairs(["A-daia", "J-heart"], reversedEndpoints).sort(), ["K-crub", "scan-K"]);
    }
  }
});
