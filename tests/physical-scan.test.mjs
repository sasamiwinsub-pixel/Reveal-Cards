import assert from "node:assert/strict";
import test from "node:test";
import { getFinalPhysicalScanReading, resolveFinalPhysicalScanSplit } from "../lib/physical-scan.ts";

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
