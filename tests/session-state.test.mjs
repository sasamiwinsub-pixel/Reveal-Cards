import assert from "node:assert/strict";
import test from "node:test";
import { GAME_SESSION_VERSION, readSessionState, clearStageSession } from "../lib/session-state.ts";

test("versioned session state restores progress and discards older versions", () => {
  const data = {};
  const prefix = `reveal-cards:${GAME_SESSION_VERSION}:`;
  const sessionStorage = {
    getItem: (key) => data[key] ?? null,
    removeItem: (key) => { delete data[key]; delete sessionStorage[key]; },
    setItem: (key, value) => { data[key] = value; sessionStorage[key] = value; },
  };
  globalThis.window = { sessionStorage };
  try {
    sessionStorage.setItem(`${prefix}stage-4:test`, JSON.stringify({ scans: 3, cards: ["scan-K"] }));
    sessionStorage.setItem("reveal-cards:obsolete:stage-4:test", "old");
    sessionStorage.setItem("other-app:key", "keep");
    assert.deepEqual(readSessionState("stage-4:test", {}), { scans: 3, cards: ["scan-K"] });
    assert.equal(sessionStorage.getItem("reveal-cards:obsolete:stage-4:test"), null);
    assert.equal(sessionStorage.getItem("other-app:key"), "keep");
    sessionStorage.setItem(`${prefix}stage-3:test`, "true");
    clearStageSession(4);
    assert.equal(sessionStorage.getItem(`${prefix}stage-4:test`), null);
    assert.equal(sessionStorage.getItem(`${prefix}stage-3:test`), "true");
    sessionStorage.setItem(`${prefix}bad`, "not json");
    assert.equal(readSessionState("bad", 2), 2);
    sessionStorage.setItem(`${prefix}bad`, '"wrong type"');
    assert.equal(readSessionState("bad", 2), 2);
  } finally {
    delete globalThis.window;
  }
});
