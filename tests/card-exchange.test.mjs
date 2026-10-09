import assert from "node:assert/strict";
import test from "node:test";
import { applyExchangePairs } from "../lib/card-exchange.ts";

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
