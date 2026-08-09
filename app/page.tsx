import CasinoGame from "@/components/CasinoGame";
import type { GameType } from "@/lib/game-data";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{
    battle?: string;
    robot?: string;
    stage?: string;
  }>;
}) {
  const params = await searchParams;
  const initialStageId = Number(params?.stage ?? 1);
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
  const gameKey = `${initialStageId}:${battleGameType ?? "select"}:${params?.robot ?? ""}`;

  return (
    <CasinoGame
      key={gameKey}
      initialBattle={initialBattle}
      initialStageId={initialStageId}
    />
  );
}
