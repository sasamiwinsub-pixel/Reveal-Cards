import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { GAME_CLEAR_PATH } from "../lib/routes.ts";
import { GAME_SESSION_VERSION, GAME_SAVE_RETENTION_MS, getSavedGameState, writeSessionState, clearGameProgress } from "../lib/session-state.ts";

const prefix = `reveal-cards:${GAME_SESSION_VERSION}:`;
const source = readFileSync(new URL("../lib/resume-progress.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function storage() {
  const data = {};
  return new Proxy({
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  }, {
    ownKeys: () => Object.keys(data),
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
  });
}

function browser(run) {
  const previous = globalThis.window;
  const local = storage();
  const session = storage();
  globalThis.window = { localStorage: local, sessionStorage: session, location: { href: "https://game.invalid/", origin: "https://game.invalid" } };
  const api = {};
  vm.runInNewContext(code, { exports: api, URL, Date, window: globalThis.window,
    performance: { getEntriesByType: () => [] }, require: (name) => {
      if (name === "./routes") return { GAME_CLEAR_PATH };
      if (name === "./session-state") return { getSavedGameState, writeSessionState };
      throw new Error(`Unexpected import: ${name}`);
    } });
  const save = (key, value) => local.setItem(prefix + key, JSON.stringify(value));
  try { run(api, local, session, save); } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

test("checkpoints order all stages, battles, final phases and clear without going backwards", () => browser((api) => {
  let rank = 0;
  for (const [stage, robots] of [[1, ["high-low-1-1", "high-low-1-2", "high-low-1-3"]], [2, ["blackjack-2-1", "blackjack-2-2", "blackjack-2-3", "blackjack-2-4"]], [3, ["poker-3-1", "poker-3-2", "poker-3-3", "poker-3-4"]], [4, ["all-games-last"]]]) {
    for (const robot of [null, ...robots]) {
      api.recordGameProgress(stage, robot);
      const current = api.getResumeCheckpoint();
      assert.ok(current.rank > rank);
      rank = current.rank;
    }
  }
  api.recordGameProgress(4, "all-games-last", 2);
  assert.equal(api.getResumeCheckpoint().rank, 411);
  api.recordGameProgress(2, "blackjack-2-1");
  assert.equal(api.getResumeCheckpoint().rank, 411);
  api.recordGameClear();
  api.recordGameProgress(4, "all-games-last", 2);
  assert.equal(api.getResumeCheckpoint().url, GAME_CLEAR_PATH);
}));

test("existing session data infers the highest battle and preserves final phase two", () => browser((api, _, session) => {
  session.setItem(`${prefix}stage-2:CasinoGame:activeBattle`, JSON.stringify({ robotId: "blackjack-2-4" }));
  session.setItem(`${prefix}stage-4:PokerBattle:all-games-last:finalPhase`, "2");
  session.setItem(`${prefix}stage-4:PokerBattle:all-games-last:scannedPokerCardIds`, '["scan-A"]');
  const checkpoint = api.getResumeCheckpoint();
  assert.equal(checkpoint.rank, 411);
  assert.equal(checkpoint.url, "/?stage=4&battle=poker&robot=all-games-last");
}));

test("expired saves do not offer resume and discard clears only this game's data", () => browser((api, local, session, save) => {
  save("stage-3:PokerBattle:poker-3-4:scannedPokerCardIds", ["scan-J"]);
  save("__last-played-at", Date.now() - GAME_SAVE_RETENTION_MS - 1);
  assert.equal(api.getResumeCheckpoint(), null);
  api.recordGameProgress(3, "poker-3-4");
  save("ability:copy-paste:unlocked", true);
  session.setItem(`${prefix}stage-1:old`, "true");
  local.setItem("cacacasino.gameSelectTutorialSeen", "true");
  local.setItem("other-app:key", "keep");
  clearGameProgress();
  assert.equal(api.getResumeCheckpoint(), null);
  assert.equal(local.getItem(`${prefix}ability:copy-paste:unlocked`), null);
  assert.equal(local.getItem("cacacasino.gameSelectTutorialSeen"), null);
  assert.equal(session.getItem(`${prefix}stage-1:old`), null);
  assert.equal(local.getItem("other-app:key"), "keep");
}));

test("URLs are canonical and saved external redirects are rejected", () => browser((api, _, __, save) => {
  assert.equal(api.normalizeGameUrl("/?robot=blackjack-2-3&stage=2&battle=blackjack#cards"), "/?stage=2&battle=blackjack&robot=blackjack-2-3");
  assert.equal(api.normalizeGameUrl("/hints"), null);
  for (const url of ["https://evil.invalid/", "//evil.invalid/", "/?stage=4&robot=unrecognized"]) {
    save("resume:checkpoint", { url, rank: 9999 });
    assert.equal(api.getResumeCheckpoint(), null);
  }
}));

test("internal-navigation hints are same-origin, expiring and consumed once", () => browser((api, _, session) => {
  api.markInternalNavigation("/?stage=1");
  assert.equal(api.consumeInternalNavigation("/?stage=1"), true);
  assert.equal(api.consumeInternalNavigation("/?stage=1"), false);
  api.markInternalNavigation("https://evil.invalid/");
  assert.equal(session.getItem("cacacasino.internalNavigation"), null);
  session.setItem("cacacasino.internalNavigation", JSON.stringify({ url: "/", time: Date.now() - 30_001 }));
  assert.equal(api.consumeInternalNavigation("/"), false);
}));
