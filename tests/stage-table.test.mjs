import assert from "node:assert/strict";
import test from "node:test";
import { getStageTableGameType } from "../lib/game-data.ts";

test("each stage uses its most complete table regardless of the venue selection", () => {
  assert.equal(getStageTableGameType(1), "high-low");
  assert.equal(getStageTableGameType(2), "blackjack");
  assert.equal(getStageTableGameType(3), "poker");
  assert.equal(getStageTableGameType(4), "poker");
});
