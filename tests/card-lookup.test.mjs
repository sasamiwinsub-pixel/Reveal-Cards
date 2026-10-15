import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createDeck } from "../lib/game-data.ts";

const source = readFileSync(new URL("../components/CasinoGame.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("CasinoGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set([
  "generatedScanCards", "physicalScanTripleFiveInventoryCards", "getCardsById",
  "swapSelectedCardIds", "getBlackjackCardValue", "getBlackjackScore", "getBlackjackResult",
]);
const declarations = ast.statements.filter((node) => {
  if (ts.isFunctionDeclaration(node)) return names.has(node.name?.text);
  return ts.isVariableStatement(node) && node.declarationList.declarations.some(
    (declaration) => ts.isIdentifier(declaration.name) && names.has(declaration.name.text),
  );
});
assert.equal(declarations.length, names.size);
// Exercise the component's actual lookup and scoring functions without mounting React.
const { getCardsById, swapSelectedCardIds, generatedScanCards, getBlackjackScore, getBlackjackResult } = vm.runInNewContext(
  ts.transpileModule(declarations.map((node) => node.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText + "\n({ getCardsById, swapSelectedCardIds, generatedScanCards, getBlackjackScore, getBlackjackResult });",
  { deck: createDeck() },
);

test("a gifted queen exchanged into either player slot remains a playable queen", () => {
  for (const playerCard of ["K-spade", "Q-heart"]) {
    for (const pair of [[playerCard, "physical-queen-spade"], ["physical-queen-spade", playerCard]]) {
      const ids = swapSelectedCardIds(["K-spade", "Q-heart"], pair);
      const hand = getCardsById(ids, generatedScanCards);
      assert.equal(hand.length, 2);
      const queen = hand.find((card) => card.id === "physical-queen-spade");
      assert.equal(queen.rank, "Q");
      assert.equal(queen.suit, "spade");
      assert.equal(getBlackjackScore(hand), 20);
      assert.equal(getBlackjackResult(hand, getCardsById(["Q-daia", "scan-10"], generatedScanCards)), "draw");
    }
  }
});

test("all tutorial gifts resolve while generated queens and aces keep their behavior", () => {
  for (const id of ["physical-queen-spade", ...[1, 2, 3].map((index) => `physical-5-spade-${index}`)]) {
    const cards = getCardsById([id]);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].rank, id === "physical-queen-spade" ? "Q" : "5");
  }
  for (const [id, rank, score] of [["scan-12", "Q", 20], ["scan-A", "A", 21]]) {
    const hand = getCardsById(swapSelectedCardIds(["K-spade", "Q-heart"], ["K-spade", id]), generatedScanCards);
    assert.equal(hand.length, 2);
    assert.equal(hand[0].rank, rank);
    assert.equal(getBlackjackScore(hand), score);
  }
});
