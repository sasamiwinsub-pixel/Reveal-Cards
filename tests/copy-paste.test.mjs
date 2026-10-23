import assert from "node:assert/strict";
import test from "node:test";
import { resolvePaste, getCopyFormatPreview, getCorrectCopyPasteChanges } from "../lib/copy-paste.ts";

test("copy-paste redo preserves correct final changes and removes only mistakes", () => {
  const correct = {
    "exchange-start-timing": "ブラックジャック",
    "riddle-four-game": "ハイ＆ロー",
    "scan-poker": "ブラックジャック",
    "scan-role-name": "じゅういち",
  };
  assert.deepEqual(getCorrectCopyPasteChanges(correct, true), correct);
  for (const wrongRole of ["11", "ジュウイチ", "十一"]) {
    assert.deepEqual(getCorrectCopyPasteChanges({ ...correct, "scan-role-name": wrongRole, "blackjack-ace-value": "0" }, true), {
      "exchange-start-timing": "ブラックジャック",
      "riddle-four-game": "ハイ＆ロー",
      "scan-poker": "ブラックジャック",
    });
  }
  assert.deepEqual(getCorrectCopyPasteChanges({ "paste-blackjack-ace": "0", "high-low-declaration": "11" }, false), { "paste-blackjack-ace": "0" });
});

test("copy source previews distinguish conversion from paste eligibility", () => {
  assert.equal(getCopyFormatPreview("ハイ＆ロー", "hiragana"), "はい＆ろー");
  assert.equal(getCopyFormatPreview("ハイ＆ロー", "katakana"), "ハイ＆ロー");
  assert.equal(getCopyFormatPreview("ハイ＆ロー", "kanji"), null);
  assert.equal(getCopyFormatPreview("ハイ＆ロー", "number"), null);
  assert.equal(getCopyFormatPreview("11", "hiragana"), "じゅういち");
  assert.equal(getCopyFormatPreview("11", "katakana"), "ジュウイチ");
  assert.equal(getCopyFormatPreview("11", "kanji"), "十一");
  assert.equal(getCopyFormatPreview("11", "number"), "11");
  assert.equal(getCopyFormatPreview("例", "number"), "0");
  assert.equal(getCopyFormatPreview("例", "kanji"), "例");
  assert.equal(getCopyFormatPreview("例", "hiragana"), "れい");
  assert.equal(getCopyFormatPreview("例", "katakana"), "レイ");
  assert.equal(getCopyFormatPreview("役名", "kanji"), "役名");
});

test("blackjack can replace the physical scan game", () => {
  const source = { id: "blackjack-declaration", text: "ブラックジャック" };
  assert.equal(resolvePaste(source, "scan-poker", "katakana"), "ブラックジャック");
  assert.equal(resolvePaste(source, "scan-poker", "hiragana"), null);
  assert.equal(resolvePaste({ ...source, text: "ハイ＆ロー" }, "scan-poker", "katakana"), null);
});

test("blackjack can replace the role name as a resettable incorrect paste", () => {
  const source = { id: "blackjack-declaration", text: "ブラックジャック" };
  assert.equal(resolvePaste(source, "scan-role-name", "katakana"), "ブラックジャック");
  for (const format of ["hiragana", "kanji", "number"]) {
    assert.equal(resolvePaste(source, "scan-role-name", format), null);
  }
  assert.deepEqual(getCorrectCopyPasteChanges({ "scan-role-name": "ブラックジャック" }, true), {});
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

test("high-low exchange timing is allowed but remains an incorrect change that can be reset", () => {
  const source = { id: "high-low-declaration", text: "ハイ＆ロー" };
  assert.equal(resolvePaste(source, "exchange-start-timing", "katakana"), "ハイ＆ロー");
  for (const format of ["hiragana", "kanji", "number"]) {
    assert.equal(resolvePaste(source, "exchange-start-timing", format), null);
  }
  assert.equal(resolvePaste({ ...source, text: "ポーカー" }, "exchange-start-timing", "katakana"), null);
  assert.equal(resolvePaste({ id: "unknown", text: "ハイ＆ロー" }, "exchange-start-timing", "katakana"), null);
  assert.deepEqual(getCorrectCopyPasteChanges({ "exchange-start-timing": "ハイ＆ロー" }, true), {});
});

test("eleven can replace the scan role name in every format", () => {
  const source = { id: "blackjack-ace-value", text: "11" };
  assert.equal(resolvePaste(source, "scan-role-name", "hiragana"), "じゅういち");
  assert.equal(resolvePaste(source, "scan-role-name", "katakana"), "ジュウイチ");
  assert.equal(resolvePaste(source, "scan-role-name", "kanji"), "十一");
  assert.equal(resolvePaste(source, "scan-role-name", "number"), "11");
  assert.equal(resolvePaste({ ...source, text: "0" }, "scan-role-name", "hiragana"), null);
});
