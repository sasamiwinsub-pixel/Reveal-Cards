import assert from "node:assert/strict";
import test from "node:test";
import { getGuaranteedWinOpening } from "../lib/high-low-opening.ts";

test("an unavoidable player win chooses the higher robot card for LOW", () => {
  assert.equal(getGuaranteedWinOpening([4, 1], [2, 3]), 1);
  assert.equal(getGuaranteedWinOpening([4, 1], [3, 2]), 0);
  assert.equal(getGuaranteedWinOpening([4, 3], [4, 4]), 0);
});

test("other outcomes retain the existing opening behavior", () => {
  assert.equal(getGuaranteedWinOpening([3, 3], [4, 2]), null);
  assert.equal(getGuaranteedWinOpening([4, 4], [3, 2]), null);
  assert.equal(getGuaranteedWinOpening([], [3, 2]), null);
});
