import assert from "node:assert/strict";
import test from "node:test";
import { normalizeScanIllustrationName } from "../lib/scan-input.ts";

test("scan readings accept hiragana, katakana and half-width kana", () => {
  const expected = normalizeScanIllustrationName("ハイ　エース");
  for (const reading of ["はい/えーす", "ハイ／エース", "ﾊｲ/ｴｰｽ", " はい  えーす "]) {
    assert.equal(normalizeScanIllustrationName(reading), expected);
  }
});

test("scan reading normalization preserves meaningful split positions", () => {
  const expected = normalizeScanIllustrationName("ハイ　エース");
  assert.notEqual(normalizeScanIllustrationName("はいえーす"), expected);
  assert.notEqual(normalizeScanIllustrationName("は/いえーす"), expected);
  assert.notEqual(normalizeScanIllustrationName("はい/じゃっく"), expected);
});
