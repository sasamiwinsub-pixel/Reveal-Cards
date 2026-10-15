import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../components/CasinoGame.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("CasinoGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const battle = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "HighLowBattle");
function run(code, context) {
  return vm.runInNewContext(ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, { ...context });
}
function initializer(name, statements = battle.body.statements) {
  const declaration = statements.flatMap((node) => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
    .find((node) => ts.isIdentifier(node.name) && node.name.text === name);
  assert.ok(declaration, name);
  return declaration.initializer.getText(ast);
}
function evaluate(name, context) {
  return run(`const result = ${initializer(name)}; result;`, context);
}

test("all selected Stage1 exchange pairs apply independently of the solution list", () => {
  const configs = run(`const configs = ${initializer("highLowBattleConfigs", ast.statements)}; configs;`, {});
  const swap = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "swapSelectedCardIds");
  const swapSelectedCardIds = run(`${swap.getText(ast)}; swapSelectedCardIds;`, {});
  for (const id of ["high-low-1-1", "high-low-1-2", "high-low-1-3"]) {
    const highLowConfig = configs[id];
    const allIds = [...highLowConfig.initialPlayerHandIds, ...highLowConfig.initialRobotHandIds];
    for (let first = 0; first < allIds.length; first++) {
      for (let second = first + 1; second < allIds.length; second++) {
        const exchangeCardIds = [allIds[first], allIds[second]];
        const context = {
          exchangeConfirmed: true, exchangeApplied: false, isExchangeCorrect: false,
          exchangeCardIds, highLowConfig, swapSelectedCardIds,
          initialPlayerHand: highLowConfig.initialPlayerHandIds.map((id) => ({ id })),
          initialRobotHand: highLowConfig.initialRobotHandIds.map((id) => ({ id })),
        };
        context.isExchangeApplied = evaluate("isExchangeApplied", context);
        assert.equal(context.isExchangeApplied, true);
        for (const [variable, initial] of [["exchangedPlayerHandIds", highLowConfig.initialPlayerHandIds], ["exchangedRobotHandIds", highLowConfig.initialRobotHandIds]]) {
          const expected = initial.map((id) => id === exchangeCardIds[0] ? exchangeCardIds[1] : id === exchangeCardIds[1] ? exchangeCardIds[0] : id);
          assert.equal(evaluate(variable, context).join(","), expected.join(","));
        }
      }
    }
  }
  assert.equal(evaluate("isExchangeApplied", { exchangeConfirmed: false, exchangeCardIds: ["A", "K"] }), false);
  assert.equal(evaluate("isExchangeApplied", { exchangeConfirmed: true, exchangeCardIds: ["A"] }), false);
});

test("placement settlement survives reloads and restores older interrupted confirmations", () => {
  const placed = { playerZone: "LOW", playerPlacedCard: { id: "Q-spade" } };
  for (const placementConfirmed of [false, true]) {
    assert.equal(evaluate("hasSettledPlacement", { ...placed, placementConfirmed, placementPendingConfirm: false, placementAnimation: null }), true);
    assert.equal(evaluate("hasSettledPlacement", { ...placed, placementConfirmed, placementPendingConfirm: false, placementAnimation: { mode: "release" } }), false);
    assert.equal(evaluate("hasSettledPlacement", { ...placed, placementConfirmed, placementPendingConfirm: true, placementAnimation: null }), false);
  }
  assert.equal(evaluate("hasSettledPlacement", { playerZone: null, playerPlacedCard: null, placementConfirmed: false, placementPendingConfirm: false, placementAnimation: null }), false);
});

test("confirmation works without animation state and persists before the timer completes", () => {
  const confirm = battle.body.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "confirmPlayerPlacement");
  const timers = [];
  const state = { pending: true, confirmed: false, animation: null };
  run(`${confirm.getText(ast)}; confirmPlayerPlacement();`, {
    placementPendingConfirm: true, playerZone: "LOW", playerPlacedCard: { id: "Q-spade" },
    placementAnimation: null,
    setPlacementPendingConfirm: (value) => { state.pending = value; },
    setPlacementConfirmed: (value) => { state.confirmed = value; },
    setPlacementAnimation: (value) => { state.animation = typeof value === "function" ? value(state.animation) : value; },
    window: { setTimeout: (callback) => timers.push(callback) },
  });
  assert.equal(state.pending, false);
  assert.equal(state.confirmed, true);
  assert.equal(state.animation.mode, "release");
  assert.equal(timers.length, 1);
  timers[0]();
  assert.equal(state.animation, null);
  assert.equal(state.confirmed, true);
});
