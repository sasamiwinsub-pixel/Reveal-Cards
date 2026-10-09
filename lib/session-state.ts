"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

// Increment this when saved game data is no longer compatible.
export const GAME_SESSION_VERSION = "v1";
const prefix = `reveal-cards:${GAME_SESSION_VERSION}:`;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
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
    for (const oldKey of Object.keys(target)) {
      if (oldKey.startsWith("reveal-cards:") && !oldKey.startsWith(prefix)) target.removeItem(oldKey);
    }
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
