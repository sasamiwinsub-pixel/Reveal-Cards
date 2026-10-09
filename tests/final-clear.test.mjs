import assert from "node:assert/strict";
import test from "node:test";
import { isFinalGameClear } from "../lib/final-clear.ts";

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
