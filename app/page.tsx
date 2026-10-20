import CasinoGame from "@/components/CasinoGame";
import TitleScreen from "@/components/TitleScreen";
import { OpeningScreen, IntroductionScreen } from "@/components/OpeningPages";
import type { GameType } from "@/lib/game-data";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{
    battle?: string;
    robot?: string;
    stage?: string;
    tutorial?: string;
    screen?: string;
  }>;
}) {
  const params = await searchParams;
  if (!params?.stage && !params?.battle && !params?.tutorial) {
    if (params?.screen === "introduction") return <IntroductionScreen />;
    if (params?.screen === "title") return <TitleScreen />;
    return <OpeningScreen />;
  }
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
        robotId: initialStageId === 3 && params?.tutorial === "betting" ? "poker-3-3" : params?.robot ?? "",
      }
    : null;
  const gameKey = `${initialStageId}:${battleGameType ?? "select"}:${params?.robot ?? ""}:${params?.tutorial ?? ""}`;

  return (
    <CasinoGame
      key={gameKey}
      initialBattle={initialBattle}
      initialStageId={initialStageId}
      initialGameSelectTutorial={initialStageId === 1 && params?.tutorial === "venue"}
    />
  );
}
