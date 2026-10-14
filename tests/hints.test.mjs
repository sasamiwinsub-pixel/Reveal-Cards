import assert from "node:assert/strict";
import test from "node:test";
import { hintStages } from "../lib/hints.ts";

test("hints cover all supplied stages, battles and individual lines", () => {
  assert.deepEqual(hintStages.map((stage) => stage.title), ["1stStage", "2ndStage", "3rdStage"]);
  assert.deepEqual(hintStages.map((stage) => stage.battles.length), [3, 4, 4]);
  const groups = hintStages.flatMap((stage) => stage.battles.flatMap((battle) => battle.groups));
  assert.equal(groups.flatMap((group) => group.lines).length, 92);
  assert.ok(groups.every((group) => group.title && group.lines.length && group.lines.every((line) => line.trim())));
  assert.equal(hintStages[1].battles[1].groups[0].title, "スキャン解放謎のヒント");
  assert.equal(hintStages[2].battles[3].groups[0].lines.at(-1), "11を自分の手札にエクスチェンジすることで勝てそうです");
});
