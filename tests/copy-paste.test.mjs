import assert from "node:assert/strict";
import test from "node:test";
import { resolvePaste } from "../lib/copy-paste.ts";

test("blackjack can replace the physical scan game", () => {
  const source = { id: "blackjack-declaration", text: "ブラックジャック" };
  assert.equal(resolvePaste(source, "scan-poker", "katakana"), "ブラックジャック");
  assert.equal(resolvePaste(source, "scan-poker", "hiragana"), null);
  assert.equal(resolvePaste({ ...source, text: "ハイ＆ロー" }, "scan-poker", "katakana"), null);
});

test("only configured source, target and format combinations are accepted", () => {
  const source = { id: "scan-example", text: "例" };
  assert.equal(resolvePaste(source, "blackjack-ace-value", "number"), "0");
  assert.equal(resolvePaste(source, "blackjack-ace-value", "katakana"), null);
  assert.equal(resolvePaste(source, "poker-role-name", "number"), null);
  assert.equal(resolvePaste({ id: "unknown", text: "例" }, "blackjack-ace-value", "number"), null);
});

test("both declarations accept any copy source in every format", () => {
  for (const target of ["high-low-declaration", "blackjack-declaration"]) {
    for (const format of ["hiragana", "katakana", "kanji", "number"]) {
      assert.notEqual(resolvePaste({ id: "unknown", text: "任意の言葉" }, target, format), null);
    }
  }
});

test("declarations use the selected text format", () => {
  const source = { id: "scan-example", text: "例" };
  assert.equal(resolvePaste(source, "high-low-declaration", "hiragana"), "れい");
  assert.equal(resolvePaste(source, "high-low-declaration", "katakana"), "レイ");
  assert.equal(resolvePaste(source, "blackjack-declaration", "kanji"), "例");
  assert.equal(resolvePaste(source, "blackjack-declaration", "number"), "0");
});

test("a target cannot overwrite itself", () => {
  assert.equal(resolvePaste({ id: "blackjack-declaration", text: "ブラックジャック" }, "blackjack-declaration", "kanji"), null);
});

test("blackjack can replace the exchange timing in katakana", () => {
  const source = { id: "blackjack-declaration", text: "ブラックジャック" };
  assert.equal(resolvePaste(source, "exchange-start-timing", "katakana"), "ブラックジャック");
  assert.equal(resolvePaste(source, "exchange-start-timing", "number"), null);
  assert.equal(resolvePaste({ ...source, text: "別の言葉" }, "exchange-start-timing", "katakana"), null);
  assert.equal(resolvePaste({ id: "unknown", text: "ブラックジャック" }, "exchange-start-timing", "katakana"), null);
});

test("high-low can replace the game on riddle four", () => {
  const source = { id: "high-low-declaration", text: "ハイ＆ロー" };
  assert.equal(resolvePaste(source, "blackjack-declaration", "katakana"), "ハイ＆ロー");
  assert.equal(resolvePaste(source, "blackjack-declaration", "hiragana"), "はい＆ろー");
  assert.equal(resolvePaste(source, "riddle-four-game", "katakana"), "ハイ＆ロー");
  assert.equal(resolvePaste(source, "riddle-four-game", "number"), null);
  assert.equal(resolvePaste({ ...source, text: "ポーカー" }, "riddle-four-game", "katakana"), null);
});

test("eleven can replace the scan role name in hiragana", () => {
  const source = { id: "blackjack-ace-value", text: "11" };
  assert.equal(resolvePaste(source, "scan-role-name", "hiragana"), "じゅういち");
  assert.equal(resolvePaste(source, "scan-role-name", "katakana"), null);
  assert.equal(resolvePaste(source, "scan-role-name", "number"), null);
  assert.equal(resolvePaste({ ...source, text: "0" }, "scan-role-name", "hiragana"), null);
});
