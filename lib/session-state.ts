"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

// Increment this when saved game data is no longer compatible.
export const GAME_SESSION_VERSION = "v1";
export const GAME_SAVE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const prefix = `reveal-cards:${GAME_SESSION_VERSION}:`;
const lastPlayedKey = `${prefix}__last-played-at`;

function sessionStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function removeGameKeys(target: Storage, matches: (key: string) => boolean) {
  for (const key of Object.keys(target)) {
    if (matches(key)) target.removeItem(key);
  }
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  const legacy = sessionStorage();
  let target: Storage | null;
  try {
    target = window.localStorage;
  } catch {
    target = null;
  }
  target ??= legacy;
  if (!target) return null;
  try {
    const savedTime = target.getItem(lastPlayedKey);
    const lastPlayed = Number(savedTime);
    const now = Date.now();
    if (savedTime !== null && (!Number.isFinite(lastPlayed) || now - lastPlayed >= GAME_SAVE_RETENTION_MS)) {
      removeGameKeys(target, (key) => key.startsWith(prefix));
      // Do not resurrect expired progress from the old tab-scoped save.
      if (legacy && legacy !== target) removeGameKeys(legacy, (key) => key.startsWith(prefix));
    }
    for (const store of new Set([target, legacy])) {
      if (store) removeGameKeys(store, (key) => key.startsWith("reveal-cards:") && !key.startsWith(prefix));
    }
    if (legacy && legacy !== target) {
      for (const key of Object.keys(legacy)) {
        if (!key.startsWith(prefix)) continue;
        const saved = legacy.getItem(key);
        if (saved !== null && target.getItem(key) === null) target.setItem(key, saved);
        legacy.removeItem(key);
      }
    }
    target.setItem(lastPlayedKey, String(now));
    return target;
  } catch {
    return null;
  }
}

export function clearStageSession(stageId: number) {
  const target = storage();
  if (!target) return;
  try {
    for (const key of Object.keys(target)) {
      if (key.startsWith(`${prefix}stage-${stageId}:`)) target.removeItem(key);
    }
  } catch { /* Storage may be disabled by the browser. */ }
}

export function readSessionState<S>(key: string, fallback: S): S {
  const target = storage();
  if (!target) return fallback;
  try {
    const saved = target.getItem(prefix + key);
    if (saved === null) return fallback;
    const parsed = JSON.parse(saved) as S;
    if (fallback !== null && (typeof parsed !== typeof fallback || Array.isArray(parsed) !== Array.isArray(fallback))) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function useSessionState<S>(key: string, initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  const fullKey = prefix + key;
  const [value, setValue] = useState<S>(() => readSessionState(key, typeof initial === "function" ? (initial as () => S)() : initial));
  const save = useCallback((next: S) => {
    try { storage()?.setItem(fullKey, JSON.stringify(next)); } catch { /* Keep the game usable without storage. */ }
  }, [fullKey]);
  const update = useCallback<Dispatch<SetStateAction<S>>>((next) => {
    setValue((current) => {
      const result = typeof next === "function" ? (next as (previous: S) => S)(current) : next;
      save(result);
      return result;
    });
  }, [save]);
  useEffect(() => { save(value); }, [save, value]);
  return [value, update];
}
