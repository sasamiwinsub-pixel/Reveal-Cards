import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowReservedExchange } from "../lib/exchange-timing.ts";

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
