import assert from "node:assert/strict";
import test from "node:test";
import { GAME_SESSION_VERSION, GAME_SAVE_RETENTION_MS, readSessionState, clearStageSession } from "../lib/session-state.ts";

const prefix = `reveal-cards:${GAME_SESSION_VERSION}:`;
const lastPlayedKey = `${prefix}__last-played-at`;

function createStorage() {
  const data = {};
  const storage = {
    getItem: (key) => data[key] ?? null,
    removeItem: (key) => { delete data[key]; delete storage[key]; },
    setItem: (key, value) => { data[key] = value; storage[key] = value; },
  };
  return storage;
}

function browser(run) {
  const original = globalThis.window;
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  globalThis.window = { localStorage, sessionStorage };
  try { run(localStorage, sessionStorage); } finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
}

test("local saves survive a new browser session and stage reset preserves other progress", () => browser((local) => {
  local.setItem(`${prefix}stage-4:test`, JSON.stringify({ scans: 3, cards: ["scan-K"] }));
  local.setItem("reveal-cards:obsolete:stage-4:test", "old");
  local.setItem("other-app:key", "keep");
  assert.deepEqual(readSessionState("stage-4:test", {}), { scans: 3, cards: ["scan-K"] });
  assert.equal(local.getItem("reveal-cards:obsolete:stage-4:test"), null);
  assert.equal(local.getItem("other-app:key"), "keep");
  globalThis.window = { localStorage: local, sessionStorage: createStorage() };
  assert.deepEqual(readSessionState("stage-4:test", {}), { scans: 3, cards: ["scan-K"] });
  local.setItem(`${prefix}stage-3:test`, "true");
  local.setItem(`${prefix}ability:copy-paste:unlocked`, "true");
  clearStageSession(4);
  assert.equal(local.getItem(`${prefix}stage-4:test`), null);
  assert.equal(local.getItem(`${prefix}stage-3:test`), "true");
  clearStageSession(3);
  assert.equal(readSessionState("ability:copy-paste:unlocked", false), true);
}));

test("migrates all current session saves once without overwriting newer local saves", () => browser((local, session) => {
  session.setItem(`${prefix}stage-2:cards`, '["Q","Q"]');
  session.setItem(`${prefix}ability:copy-paste:unlocked`, "true");
  session.setItem(`${prefix}stage-4:phase`, "1");
  session.setItem("reveal-cards:obsolete:stage-1:test", "old");
  session.setItem("other-app:key", "keep");
  local.setItem(`${prefix}stage-4:phase`, "2");
  assert.deepEqual(readSessionState("stage-2:cards", []), ["Q", "Q"]);
  assert.equal(readSessionState("ability:copy-paste:unlocked", false), true);
  assert.equal(readSessionState("stage-4:phase", 0), 2);
  assert.equal(session.getItem(`${prefix}stage-2:cards`), null);
  assert.equal(session.getItem("reveal-cards:obsolete:stage-1:test"), null);
  assert.equal(session.getItem("other-app:key"), "keep");
  clearStageSession(2);
  assert.deepEqual(readSessionState("stage-2:cards", []), []);
}));

test("expires the whole save at 30 days without restoring stale session data", () => browser((local, session) => {
  local.setItem(lastPlayedKey, String(Date.now() - GAME_SAVE_RETENTION_MS));
  local.setItem(`${prefix}stage-4:phase`, "2");
  local.setItem(`${prefix}ability:copy-paste:unlocked`, "true");
  session.setItem(`${prefix}stage-4:phase`, "1");
  local.setItem("other-app:key", "keep");
  assert.equal(readSessionState("stage-4:phase", 0), 0);
  assert.equal(readSessionState("ability:copy-paste:unlocked", false), false);
  assert.equal(session.getItem(`${prefix}stage-4:phase`), null);
  assert.equal(local.getItem("other-app:key"), "keep");
}));

test("playing before expiry renews the retention period", () => browser((local) => {
  local.setItem(lastPlayedKey, String(Date.now() - GAME_SAVE_RETENTION_MS + 60_000));
  local.setItem(`${prefix}stage-4:phase`, "2");
  const before = Date.now();
  assert.equal(readSessionState("stage-4:phase", 0), 2);
  assert.ok(Number(local.getItem(lastPlayedKey)) >= before);
}));

test("corrupt saves and invalid timestamps fall back safely", () => browser((local) => {
  local.setItem(`${prefix}bad`, "not json");
  assert.equal(readSessionState("bad", 2), 2);
  local.setItem(`${prefix}bad`, '"wrong type"');
  assert.equal(readSessionState("bad", 2), 2);
  local.setItem(lastPlayedKey, "invalid");
  local.setItem(`${prefix}stage-4:phase`, "2");
  assert.equal(readSessionState("stage-4:phase", 0), 0);
}));

test("blocked localStorage falls back to sessionStorage, and unavailable storage is safe", () => browser((_, session) => {
  globalThis.window = { get localStorage() { throw new Error("blocked"); }, sessionStorage: session };
  session.setItem(`${prefix}stage-4:phase`, "2");
  assert.equal(readSessionState("stage-4:phase", 0), 2);
  globalThis.window = {
    get localStorage() { throw new Error("blocked"); },
    get sessionStorage() { throw new Error("blocked"); },
  };
  assert.equal(readSessionState("stage-4:phase", 0), 0);
  assert.doesNotThrow(() => clearStageSession(4));
  delete globalThis.window;
  assert.equal(readSessionState("stage-4:phase", 0), 0);
}));
