import assert from "node:assert/strict";
import test from "node:test";
import { getBlackjackOrderValue, isLargestBlackjackCard } from "../lib/blackjack-order.ts";

test("blackjack placement order uses ranks rather than blackjack scores", () => {
  assert.deepEqual(["A", "K", "Q", "J", "10", "9", "0"].map((rank) => getBlackjackOrderValue(rank)), [14, 13, 12, 11, 10, 9, 0]);
  assert.equal(isLargestBlackjackCard("Q", ["K", "Q"]), false);
  assert.equal(isLargestBlackjackCard("K", ["K", "Q"]), true);
  assert.equal(isLargestBlackjackCard("K", ["K", "K"]), true);
});

test("an ace changed to zero must be placed last", () => {
  assert.equal(isLargestBlackjackCard("A", ["A", "J"], true), false);
  assert.equal(isLargestBlackjackCard("J", ["A", "J"], true), true);
  assert.equal(isLargestBlackjackCard("A", ["A", "J"]), true);
});
