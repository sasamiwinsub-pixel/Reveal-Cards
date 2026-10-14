import assert from "node:assert/strict";
import test from "node:test";
import { getStageTableGameType, stages } from "../lib/game-data.ts";

test("each stage uses its most complete table regardless of the venue selection", () => {
  assert.equal(getStageTableGameType(1), "high-low");
  assert.equal(getStageTableGameType(2), "blackjack");
  assert.equal(getStageTableGameType(3), "poker");
  assert.equal(getStageTableGameType(4), "poker");
});

test("third stage includes a fourth battle before the final stage", () => {
  const third = stages.find((stage) => stage.id === 3);
  assert.deepEqual(third.robots.map((robot) => robot.id), ["poker-3-1", "poker-3-2", "poker-3-3", "poker-3-4"]);
});
