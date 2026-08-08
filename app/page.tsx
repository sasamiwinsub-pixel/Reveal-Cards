import CasinoGame from "@/components/CasinoGame";
import type { GameType } from "@/lib/game-data";

const GUN_MAX_TRIGGERS = 6;

function createLiveRounds() {
  return [1];
}

function parseZone(value?: string) {
  return value === "HIGH" || value === "LOW" ? value : null;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{
    battle?: string;
    gun?: string;
    live?: string;
    pz?: string;
    robot?: string;
    rz?: string;
    shots?: string;
    stage?: string;
  }>;
}) {
  const params = await searchParams;
  const initialStageId = Number(params?.stage ?? 1);
  const liveRounds = createLiveRounds();
  const triggerCount = Math.min(
    Math.max(Number(params?.shots ?? 0), 0),
    GUN_MAX_TRIGGERS,
  );
  const battleGameType: GameType | null =
    params?.battle === "blackjack" ||
    params?.battle === "poker" ||
    params?.battle === "high-low"
      ? params.battle
      : null;
  const initialBattle = battleGameType
      ? {
          gameType: battleGameType,
          robotId: params?.robot ?? "",
        }
      : null;

  return (
    <CasinoGame
      initialBattle={initialBattle}
      initialGunState={{
        gunResult:
          params?.gun === "1" && triggerCount > 0 ? "fire" : null,
        isStarted: params?.gun === "1",
        liveRounds,
        playerZone: parseZone(params?.pz),
        robotZone: parseZone(params?.rz),
        triggerCount,
      }}
      initialStageId={initialStageId}
      nextLiveRounds={createLiveRounds()}
    />
  );
}
