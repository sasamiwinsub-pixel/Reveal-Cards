import { GAME_CLEAR_PATH } from "./routes";
import { getSavedGameState, writeSessionState } from "./session-state";

export type ResumeCheckpoint = { url: string; rank: number };
const checkpointKey = "resume:checkpoint";
const navigationKey = "cacacasino.internalNavigation";
const battles: Record<number, string[]> = {
  1: ["high-low-1-1", "high-low-1-2", "high-low-1-3"],
  2: ["blackjack-2-1", "blackjack-2-2", "blackjack-2-3", "blackjack-2-4"],
  3: ["poker-3-1", "poker-3-2", "poker-3-3", "poker-3-4"],
  4: ["all-games-last"],
};

export function gameCheckpoint(stage: number, robot: string | null = null, phase = 1): ResumeCheckpoint | null {
  if (!battles[stage]) return null;
  const index = robot ? battles[stage].indexOf(robot) : -1;
  const game = stage >= 3 ? "poker" : stage === 2 ? "blackjack" : "high-low";
  return {
    url: index < 0 ? `/?stage=${stage}` : `/?stage=${stage}&battle=${game}&robot=${robot}`,
    rank: stage * 100 + (index + 1) * 10 + (stage === 4 && index >= 0 && phase === 2 ? 1 : 0),
  };
}

export function normalizeGameUrl(value: string): string | null {
  const url = new URL(value, "https://game.invalid");
  if (url.pathname === GAME_CLEAR_PATH) return GAME_CLEAR_PATH;
  if (url.pathname !== "/") return null;
  const stage = Number(url.searchParams.get("stage") ?? 1);
  if (url.searchParams.has("stage") || url.searchParams.has("battle") || url.searchParams.has("tutorial")) {
    return gameCheckpoint(stage, url.searchParams.get("robot"))?.url ?? "/";
  }
  const screen = url.searchParams.get("screen");
  return screen === "title" || screen === "introduction" ? `/?screen=${screen}` : "/";
}

function validCheckpoint(value: unknown): value is ResumeCheckpoint {
  if (!value || typeof value !== "object") return false;
  const item = value as ResumeCheckpoint;
  if (typeof item.url !== "string" || !item.url.startsWith("/") || item.url.startsWith("//")) return false;
  if (item.url === GAME_CLEAR_PATH) return item.rank === 500;
  const url = new URL(item.url, "https://game.invalid");
  const stage = Number(url.searchParams.get("stage"));
  const candidate = gameCheckpoint(stage, url.searchParams.get("robot"), item.rank === 411 ? 2 : 1);
  return candidate?.url === item.url && candidate.rank === item.rank;
}

export function getResumeCheckpoint(): ResumeCheckpoint | null {
  const saved = getSavedGameState();
  let best: ResumeCheckpoint | null = validCheckpoint(saved[checkpointKey]) ? saved[checkpointKey] : null;
  // Existing saves predate the checkpoint: infer the furthest battle from their state keys.
  for (const [key, value] of Object.entries(saved)) {
    const match = /^stage-([1-4]):/.exec(key);
    if (!match) continue;
    const stage = Number(match[1]);
    const battleMatch = /:(?:HighLowBattle|BlackjackBattle|PokerBattle):([^:]+):/.exec(key);
    const active = key.endsWith(":CasinoGame:activeBattle") && value && typeof value === "object"
      ? (value as { robotId?: string }).robotId : undefined;
    const robot = battleMatch?.[1] ?? active ?? null;
    const phase = saved["stage-4:PokerBattle:all-games-last:finalPhase"] === 2 ? 2 : 1;
    const candidate = gameCheckpoint(stage, robot, phase);
    if (candidate && (!best || candidate.rank > best.rank)) best = candidate;
  }
  return best;
}

export function recordGameProgress(stage: number, robot: string | null, phase = 1) {
  const candidate = gameCheckpoint(stage, robot, phase);
  const previous = getResumeCheckpoint();
  if (candidate && (!previous || candidate.rank >= previous.rank)) writeSessionState(checkpointKey, candidate);
}

export function recordGameClear() {
  writeSessionState(checkpointKey, { url: GAME_CLEAR_PATH, rank: 500 });
}

export function markInternalNavigation(value: string) {
  try {
    const url = new URL(value, window.location.href);
    if (url.origin === window.location.origin) {
      window.sessionStorage.setItem(navigationKey, JSON.stringify({ url: normalizeGameUrl(url.href), time: Date.now() }));
    }
  } catch { /* Resume checks still work without navigation hints. */ }
}

export function consumeInternalNavigation(value: string): boolean {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(navigationKey) ?? "null");
    window.sessionStorage.removeItem(navigationKey);
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return navigation?.type !== "reload" && saved?.url === normalizeGameUrl(value) && Date.now() - saved.time < 30_000;
  } catch { return false; }
}
