import assert from "node:assert/strict";
import test from "node:test";
import { getFinalPhysicalScanReading, resolveFinalPhysicalScanSplit, isPhysicalScanSelectionValid, getFinalSingleCardScan, getAvailablePhysicalScanCards } from "../lib/physical-scan.ts";

test("consumed queens are removed from both physical inventory and exchange candidates", () => {
  const queen = { id: "scan-12", rank: "Q" };
  const gift = { id: "physical-queen-spade", rank: "Q" };
  const ace = { id: "scan-A", rank: "A" };
  const consumed = [queen.id, gift.id];
  assert.deepEqual(getAvailablePhysicalScanCards([gift, queen, ace], consumed), [ace]);
  assert.deepEqual(getAvailablePhysicalScanCards([queen, ace], consumed), [ace]);
  assert.deepEqual(getAvailablePhysicalScanCards([queen, ace], []), [queen, ace]);
});

test("numeric eleven permits a single ace or jack but not the normal two-card scan", () => {
  for (const rank of ["A", "J"]) {
    for (const role of ["11", "ジュウイチ", "十一"]) {
      assert.equal(getFinalSingleCardScan([rank], "ブラックジャック", role), rank);
      assert.equal(getFinalSingleCardScan([rank], "ポーカー", role), null);
      assert.equal(getFinalSingleCardScan(["A", "J"], "ブラックジャック", role), null);
    }
    assert.equal(getFinalSingleCardScan([rank], "ブラックジャック", "11"), rank);
    assert.equal(getFinalSingleCardScan([rank], "ポーカー", "11"), null);
    assert.equal(getFinalSingleCardScan([rank], "ブラックジャック", "じゅういち"), null);
  }
  assert.equal(getFinalSingleCardScan(["A", "J"], "ブラックジャック", "11"), null);
  assert.equal(getFinalSingleCardScan(["K"], "ブラックジャック", "11"), null);
});

test("physical scan accepts the gifted queen and the previously generated queen", () => {
  const inventory = [
    { id: "physical-queen-spade", rank: "Q" },
    { id: "scan-12", rank: "Q" },
  ];
  assert.equal(isPhysicalScanSelectionValid(["physical-queen-spade", "scan-12"], inventory, "Q", 2), true);
  assert.equal(isPhysicalScanSelectionValid(["physical-queen-spade", "physical-queen-crub"], inventory, "Q", 2), false);
  assert.equal(isPhysicalScanSelectionValid(["scan-12", "scan-12"], inventory, "Q", 2), false);
  assert.equal(isPhysicalScanSelectionValid(["scan-12"], inventory, "Q", 2), false);
  assert.equal(isPhysicalScanSelectionValid(["physical-queen-spade", "scan-12"], [], "Q", 2), false);
});

test("physical scan still requires three available fives for the tutorial", () => {
  const inventory = [1, 2, 3].map((index) => ({ id: `physical-5-spade-${index}`, rank: "5" }));
  assert.equal(isPhysicalScanSelectionValid(inventory.map((card) => card.id), inventory, "5", 3), true);
  assert.equal(isPhysicalScanSelectionValid(inventory.map((card) => card.id), inventory, "Q", 3), false);
});

test("final physical scan requires both rule changes and A plus J", () => {
  assert.equal(getFinalPhysicalScanReading(["A", "J"], "ブラックジャック", "じゅういち"), "にじゅういち");
  assert.equal(getFinalPhysicalScanReading(["J", "A"], "ブラックジャック", "じゅういち"), "にじゅういち");
  assert.equal(getFinalPhysicalScanReading(["A", "J"], undefined, "じゅういち"), null);
  assert.equal(getFinalPhysicalScanReading(["A", "J"], "ブラックジャック", undefined), null);
  assert.equal(getFinalPhysicalScanReading(["A", "Q"], "ブラックジャック", "じゅういち"), null);
});

test("two plus eleven produces K only with the correct split", () => {
  assert.equal(resolveFinalPhysicalScanSplit("に じゅういち"), "scan-K");
  assert.equal(resolveFinalPhysicalScanSplit("にじゅういち"), null);
  assert.equal(resolveFinalPhysicalScanSplit("に じゅう いち"), null);
});
