"use client";

import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Info,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState, type MouseEvent } from "react";
import {
  createDeck,
  drawOpeningHand,
  getGameSeat,
  getGameLabel,
  getRobotGameTypes,
  stages,
  type GameType,
  type PlayingCard,
  type Robot,
  type Seat,
  type Stage,
} from "@/lib/game-data";

type Outcome = "win" | "draw" | "lose";
type ModalKind = "rules" | "spec";

const chipDelta: Record<Outcome, number> = {
  win: 0,
  draw: 0,
  lose: -20,
};

const viewImage: Record<Seat, { alt: string; src: string }> = {
  left: {
    alt: "左側のロボットを見るカジノ卓",
    src: "/robots-look-left.png",
  },
  top: {
    alt: "カジノ卓に座る3体のロボット",
    src: "/robots-three.png",
  },
  right: {
    alt: "右側のロボットを見るカジノ卓",
    src: "/robots-look-right.png",
  },
};

const gameLogo: Record<GameType, { alt: string; src: string }> = {
  blackjack: {
    alt: "ブラックジャック",
    src: "/game-logos/blackjack.png",
  },
  poker: {
    alt: "ポーカー",
    src: "/game-logos/poker.png",
  },
  "high-low": {
    alt: "ハイアンドロー",
    src: "/game-logos/high-low.png",
  },
};

const GUN_MAX_TRIGGERS = 6;
const GUN_LIVE_ROUNDS = 1;
const HIGH_LOW_TUTORIAL_ROBOT_ID = "high-low-1-1";
const deck = createDeck();

type FocusOption = {
  gameType: GameType;
  robot: Robot;
};

type ActiveBattle = {
  gameType: GameType;
  robotId: string;
};

type GunResult = "fire";
type HighLowZoneName = "HIGH" | "LOW";

type InitialGunState = {
  gunResult: GunResult | null;
  isStarted: boolean;
  liveRounds: number[];
  playerZone: HighLowZoneName | null;
  robotZone: HighLowZoneName | null;
  triggerCount: number;
};

export default function CasinoGame({
  initialBattle = null,
  initialGunState,
  initialStageId = 1,
  nextLiveRounds,
}: {
  initialBattle?: ActiveBattle | null;
  initialGunState: InitialGunState;
  initialStageId?: number;
  nextLiveRounds: number[];
}) {
  const initialStage = stages.find((item) => item.id === initialStageId) ?? stages[0];
  const [stageId, setStageId] = useState(initialStage.id);
  const [, setChips] = useState(initialStage.startingChips);
  const [playedRobotIds, setPlayedRobotIds] = useState<string[]>([]);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(
    initialBattle?.robotId ?? null,
  );
  const [selectedGameType, setSelectedGameType] = useState<GameType | null>(
    initialBattle?.gameType ?? null,
  );
  const [activeBattle, setActiveBattle] = useState<ActiveBattle | null>(
    initialBattle,
  );
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(0);
  const [modal, setModal] = useState<{ robot: Robot; kind: ModalKind } | null>(
    null,
  );

  const stage = stages.find((item) => item.id === stageId) ?? stages[0];
  const hand = useMemo(() => drawOpeningHand(stage.id), [stage.id]);
  const focusOptions = useMemo<FocusOption[]>(
    () =>
      stage.robots.flatMap((robot) =>
        getRobotGameTypes(robot).map((gameType) => ({ gameType, robot })),
      ),
    [stage],
  );
  const boundedFocusedOptionIndex = Math.min(
    focusedOptionIndex,
    Math.max(focusOptions.length - 1, 0),
  );
  const focusedOption =
    focusOptions[boundedFocusedOptionIndex] ?? null;
  const focusedRobot = focusedOption?.robot ?? null;
  const selectedRobot =
    stage.robots.find((robot) => robot.id === selectedRobotId) ?? null;
  const activeBattleRobot =
    stage.robots.find((robot) => robot.id === activeBattle?.robotId) ?? null;
  const isHighLowBattle = activeBattle?.gameType === "high-low" && activeBattleRobot;
  const allRobotsPlayed = playedRobotIds.length === stage.robots.length;
  const isStageClear = allRobotsPlayed;

  function resetCurrentStage() {
    setStageId(stage.id);
    setChips(stage.startingChips);
    setPlayedRobotIds([]);
    setSelectedRobotId(null);
    setSelectedGameType(null);
    setActiveBattle(null);
    setFocusedOptionIndex(0);
    setModal(null);
  }

  function focusRobot(offset: number) {
    setFocusedOptionIndex((current) => {
      const robotCount = focusOptions.length;
      const next = current + offset;

      return (next + robotCount) % robotCount;
    });
  }

  function selectRobot(robot: Robot, gameType: GameType) {
    if (playedRobotIds.includes(robot.id) || isStageClear) {
      return;
    }

    setSelectedRobotId(robot.id);
    setSelectedGameType(gameType);
    setActiveBattle({ gameType, robotId: robot.id });
  }

  function resolveRound(outcome: Outcome) {
    if (!selectedRobot || playedRobotIds.includes(selectedRobot.id)) {
      return;
    }

    const reward = outcome === "win" ? selectedRobot.rewardChips ?? 0 : chipDelta[outcome];

    setChips((current) => Math.max(0, current + reward));
    setPlayedRobotIds((current) => [...current, selectedRobot.id]);
    setSelectedRobotId(null);
    setSelectedGameType(null);
    setActiveBattle(null);
  }

  return (
    <main className="min-h-screen px-3 py-3 sm:px-5 lg:px-8 lg:py-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-3 sm:gap-5">
        <header className="rounded border border-white/12 bg-black/30 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass sm:text-sm sm:tracking-[0.28em]">
                Cacacasino Riddle
              </p>
              <h1 className="mt-1 text-xl font-black leading-tight sm:text-3xl">
                {stage.label} Stage
              </h1>
              <p className="mt-1 text-sm text-stone-300">{stage.title}</p>
            </div>
            <button
              aria-label="ステージをリセット"
              className="grid h-10 w-10 shrink-0 place-items-center rounded border border-white/14 bg-white/8 hover:bg-white/14"
              onClick={resetCurrentStage}
              title="リセット"
              type="button"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[1fr_340px] lg:gap-5">
          <section className="overflow-hidden rounded border border-white/12 bg-[#1a1714] shadow-table">
            {isHighLowBattle ? (
              <HighLowBattle
                backHref={`/?stage=${stage.id}`}
                hand={hand}
                initialGunState={initialGunState}
                nextLiveRounds={nextLiveRounds}
                onBack={() => {
                  setSelectedRobotId(null);
                  setSelectedGameType(null);
                  setActiveBattle(null);
                }}
                robotId={activeBattle.robotId}
                stageId={stage.id}
              />
            ) : (
              <OpponentSelector
                focusedGameType={focusedOption?.gameType ?? null}
                focusedRobot={focusedRobot}
                hand={hand}
                isStageClear={isStageClear}
                onFocusRobot={focusRobot}
                stageId={stage.id}
                onOpenModal={(robot, kind) => setModal({ robot, kind })}
                onSelectRobot={selectRobot}
                playedRobotIds={playedRobotIds}
              />
            )}
          </section>

          <aside className="flex flex-col gap-3 sm:gap-4">
            <section className="rounded border border-white/12 bg-black/30 p-3 sm:p-4">
              <h2 className="text-base font-bold sm:text-lg">対戦パネル</h2>
              {selectedRobot ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded border border-brass/50 bg-brass/10 p-3">
                    <p className="text-xs text-stone-300">選択中</p>
                    <div className="my-2 flex flex-wrap items-center gap-2">
                      <GameLogo
                        gameType={selectedGameType ?? selectedRobot.gameType}
                        compact
                      />
                    </div>
                    {selectedRobot.rewardChips ? (
                      <p className="text-sm font-bold">
                        勝利報酬: {selectedRobot.rewardChips} chips
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-stone-300">ダミー</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="min-h-12 rounded bg-emerald-600 px-2 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                      onClick={() => resolveRound("win")}
                      type="button"
                    >
                      勝利
                    </button>
                    <button
                      className="min-h-12 rounded bg-stone-600 px-2 py-3 text-sm font-bold text-white hover:bg-stone-500"
                      onClick={() => resolveRound("draw")}
                      type="button"
                    >
                      引分
                    </button>
                    <button
                      className="min-h-12 rounded bg-red-700 px-2 py-3 text-sm font-bold text-white hover:bg-red-600"
                      onClick={() => resolveRound("lose")}
                      type="button"
                    >
                      敗北
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-stone-300">
                  矢印で対戦相手を選び、未対戦のロボットを選択してください。謎や正式な勝敗判定は後から差し替えできます。
                </p>
              )}
            </section>

            <section className="rounded border border-white/12 bg-black/30 p-3 sm:p-4">
              <h2 className="text-base font-bold sm:text-lg">共通ルール</h2>
              <p className="mt-3 text-sm leading-6 text-stone-300">ダミー</p>
            </section>
          </aside>
        </div>
      </section>

      {modal ? (
        <div className="fixed inset-0 z-30 grid place-items-end bg-black/70 p-3 sm:place-items-center sm:p-4">
          <section className="max-h-[86vh] w-full overflow-auto rounded border border-white/14 bg-stone-950 p-4 shadow-2xl sm:max-w-lg sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-brass">
                  {modal.kind === "rules" ? "ゲームルール" : "ロボット仕様"}
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {getRobotGameTypes(modal.robot).map(getGameLabel).join(" / ")}
                </h2>
              </div>
              <button
                aria-label="閉じる"
                className="grid h-10 w-10 shrink-0 place-items-center rounded border border-white/12 bg-white/8 hover:bg-white/14"
                onClick={() => setModal(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-5 min-h-28 rounded border border-white/10 bg-white/6 p-4 leading-7 text-stone-200">
              {modal.kind === "rules" ? modal.robot.ruleText : modal.robot.specText}
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function OpponentSelector({
  focusedGameType,
  focusedRobot,
  hand,
  isStageClear,
  onFocusRobot,
  onOpenModal,
  onSelectRobot,
  playedRobotIds,
  stageId,
}: {
  focusedGameType: GameType | null;
  focusedRobot: Robot | null;
  hand: PlayingCard[];
  isStageClear: boolean;
  onFocusRobot: (offset: number) => void;
  onOpenModal: (robot: Robot, kind: ModalKind) => void;
  onSelectRobot: (robot: Robot, gameType: GameType) => void;
  playedRobotIds: string[];
  stageId: number;
}) {
  const currentSeat = focusedGameType ? getGameSeat(focusedGameType) : "top";
  const currentImage = viewImage[currentSeat];
  const isFocusedPlayed = focusedRobot
    ? playedRobotIds.includes(focusedRobot.id)
    : false;
  const isTutorialPreview =
    stageId === 1 && focusedRobot?.id === HIGH_LOW_TUTORIAL_ROBOT_ID;
  const previewPlayerHand = isTutorialPreview
    ? getCardsById(["A-daia", "A-spade"])
    : hand;
  const previewRobotHand = isTutorialPreview
    ? getCardsById(["A-heart", "K-spade"])
    : hand.slice().reverse();
  const shouldShowFieldCards = focusedGameType === "poker";

  return (
    <div className="relative bg-black">
      <div className="relative aspect-[1402/1124] min-h-[330px] overflow-visible sm:min-h-[560px]">
        <Image
          alt={currentImage.alt}
          className="absolute inset-0 h-full w-full object-contain"
          fill
          priority
          sizes="(min-width: 1024px) 840px, 100vw"
          src={currentImage.src}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/64" />

        {focusedRobot ? (
          <>
            {focusedRobot.chips ? (
              <div className="absolute inset-x-0 top-[18%] z-20 flex justify-center px-4 sm:top-[20%]">
                <div className="rounded border border-brass/80 bg-black/78 px-4 py-2 text-center shadow-[0_8px_20px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:px-5 sm:py-3">
                  <p className="text-[10px] font-black uppercase text-stone-200 sm:text-xs">
                    Robot Chips
                  </p>
                  <p className="text-2xl font-black leading-none text-brass sm:text-4xl">
                    {focusedRobot.chips}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="absolute inset-x-3 bottom-0 z-20 translate-y-[78%] rounded border border-stone-200 bg-white p-3 text-stone-950 shadow-[0_12px_28px_rgba(0,0,0,0.45)] sm:inset-x-6 sm:p-4">
              <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
                <button
                  aria-label="前の対戦相手"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded border border-stone-300 bg-stone-100 text-stone-950 hover:bg-stone-200"
                  onClick={() => onFocusRobot(-1)}
                  type="button"
                >
                  <ChevronLeft size={22} />
                </button>

                <div className="flex min-h-36 min-w-0 flex-col items-center justify-center gap-2 text-center sm:min-h-56">
                  {focusedGameType ? <GameLogo gameType={focusedGameType} /> : null}
                </div>

                <button
                  aria-label="次の対戦相手"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded border border-stone-300 bg-stone-100 text-stone-950 hover:bg-stone-200"
                  onClick={() => onFocusRobot(1)}
                  type="button"
                >
                  <ChevronRight size={22} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-[44px_44px_1fr] gap-2">
                <button
                  aria-label={`${focusedRobot.name}のルール`}
                  className="grid h-11 place-items-center rounded border border-stone-300 bg-stone-100 text-stone-950 hover:bg-stone-200"
                  onClick={() => onOpenModal(focusedRobot, "rules")}
                  title="ルール"
                  type="button"
                >
                  <BookOpen size={18} />
                </button>
                <button
                  aria-label={`${focusedRobot.name}の仕様`}
                  className="grid h-11 place-items-center rounded border border-stone-300 bg-stone-100 text-stone-950 hover:bg-stone-200"
                  onClick={() => onOpenModal(focusedRobot, "spec")}
                  title="仕様"
                  type="button"
                >
                  <Info size={18} />
                </button>
                {isFocusedPlayed || isStageClear || !focusedGameType ? (
                  <button
                    className="h-11 cursor-not-allowed rounded bg-stone-700 px-3 text-sm font-bold text-stone-400"
                    disabled
                    type="button"
                  >
                    {isFocusedPlayed ? "対戦済み" : "対戦"}
                  </button>
                ) : (
                  <a
                    className="grid h-11 place-items-center rounded bg-casinoRed px-3 text-sm font-bold text-white hover:bg-red-700"
                    href={`/?stage=${stageId}&battle=${focusedGameType}&robot=${focusedRobot.id}`}
                    onClick={() => onSelectRobot(focusedRobot, focusedGameType)}
                  >
                    対戦
                  </a>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="border-t border-brass/25 bg-black/72 px-3 pb-4 pt-48 text-center backdrop-blur-sm sm:px-6 sm:pt-72">
        {shouldShowFieldCards ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
              Field Cards
            </p>
            <div className="mt-2 flex justify-center gap-2 sm:gap-3">
              {hand.map((card) => (
                <PlayingCardView
                  card={card}
                  key={`field-${card.id}`}
                  size="field"
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
              Robot Hand
            </p>
            <div className="mt-2 flex justify-center gap-2 sm:gap-3">
              {previewRobotHand.map((card) => (
                <PlayingCardView
                  card={card}
                  key={`robot-preview-${card.id}`}
                  size="hand"
                />
              ))}
            </div>
          </>
        )}

        <div className="my-3 h-px bg-white/10" />

        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
          Player Hand
        </p>
        <div className="mt-2 flex justify-center gap-2 sm:gap-3">
          {previewPlayerHand.map((card) => (
            <PlayingCardView card={card} key={`hand-${card.id}`} size="hand" />
          ))}
        </div>
      </div>
    </div>
  );
}

function HighLowBattle({
  backHref,
  hand,
  initialGunState,
  nextLiveRounds,
  onBack,
  robotId,
  stageId,
}: {
  backHref: string;
  hand: PlayingCard[];
  initialGunState: InitialGunState;
  nextLiveRounds: number[];
  onBack: () => void;
  robotId: string;
  stageId: number;
}) {
  const isTutorial = stageId === 1 && robotId === HIGH_LOW_TUTORIAL_ROBOT_ID;
  const tutorialPlayerHand = getCardsById(["A-daia", "A-spade"]);
  const tutorialRobotHand = getCardsById(["A-heart", "K-spade"]);
  const playerHand = isTutorial ? tutorialPlayerHand : hand;
  const robotHand = isTutorial ? tutorialRobotHand : hand.slice().reverse();
  const tutorialRobotCard = tutorialRobotHand.find((card) => card.rank === "K");
  const tutorialPlayerCard = tutorialPlayerHand.find((card) => card.suit === "spade");
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [liveRounds, setLiveRounds] = useState<number[]>(initialGunState.liveRounds);
  const [triggerCount, setTriggerCount] = useState(initialGunState.triggerCount);
  const [gunResult, setGunResult] = useState<GunResult | null>(
    initialGunState.gunResult,
  );
  const [battleStarted, setBattleStarted] = useState(initialGunState.isStarted);
  const [canPlaceCard, setCanPlaceCard] = useState(
    initialGunState.gunResult === "fire",
  );
  const [robotZone, setRobotZone] = useState<HighLowZoneName | null>(
    initialGunState.robotZone ?? (isTutorial && initialGunState.isStarted ? "HIGH" : null),
  );
  const [playerZone, setPlayerZone] = useState<HighLowZoneName | null>(
    initialGunState.playerZone,
  );
  const [isGunDialogOpen, setIsGunDialogOpen] = useState(
    initialGunState.isStarted && !initialGunState.playerZone,
  );
  const liveParam = liveRounds.join(",");
  const startHref = `/?stage=${stageId}&battle=high-low&robot=${robotId}&gun=1&shots=0&live=${nextLiveRounds.join(",")}${
    isTutorial ? "&rz=HIGH" : ""
  }`;
  const nextTriggerCount = Math.min(triggerCount + 1, GUN_MAX_TRIGGERS);
  const nextIsFire = true;
  const nextRobotZone: HighLowZoneName =
    isTutorial || liveRounds.reduce((sum, item) => sum + item, 0) % 2 === 0
      ? "HIGH"
      : "LOW";
  const triggerHref = `/?stage=${stageId}&battle=high-low&robot=${robotId}&gun=1&shots=${nextTriggerCount}&live=${liveParam}${
    nextIsFire ? `&rz=${nextRobotZone}` : ""
  }`;
  const tutorialStep = getHighLowTutorialStepContent({
    battleStarted,
    canPlaceCard,
    playerZone,
  });
  const draggableCardIds =
    canPlaceCard && !playerZone
      ? isTutorial && tutorialPlayerCard
        ? [tutorialPlayerCard.id]
        : playerHand.map((card) => card.id)
      : [];

  function createLiveRounds() {
    return [1];
  }

  function startGunSequence() {
    setLiveRounds(createLiveRounds());
    setTriggerCount(0);
    setGunResult(null);
    setBattleStarted(true);
    setIsGunDialogOpen(true);
    setCanPlaceCard(false);
    setRobotZone(isTutorial ? "HIGH" : null);
    setPlayerZone(null);
  }

  function pullTrigger() {
    if (!battleStarted || canPlaceCard || triggerCount >= GUN_MAX_TRIGGERS) {
      return;
    }

    const nextCount = triggerCount + 1;
    const isFire = true;
    setTriggerCount(nextCount);
    setGunResult("fire");

    if (isFire) {
      setCanPlaceCard(true);
      setRobotZone(isTutorial ? "HIGH" : Math.random() > 0.5 ? "HIGH" : "LOW");
      window.setTimeout(() => setIsGunDialogOpen(false), 1400);
    }
  }

  function placePlayerCard(zone: "HIGH" | "LOW") {
    if (!canPlaceCard) {
      return;
    }

    setPlayerZone(zone);
  }

  function dropPlayerCard(zone: "HIGH" | "LOW") {
    if (!draggingCardId || !draggableCardIds.includes(draggingCardId)) {
      return;
    }

    placePlayerCard(zone);
    setDraggingCardId(null);
  }

  return (
    <div className="min-h-[680px] bg-[#14391f] text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/45 p-3 sm:p-4">
        <a
          className="grid h-10 w-10 place-items-center rounded border border-white/14 bg-white/8 hover:bg-white/14"
          href={backHref}
          onClick={onBack}
          aria-label="選択画面に戻る"
        >
          <ArrowLeft size={18} />
        </a>
        <GameLogo gameType="high-low" compact />
        <div className="h-10 w-10" />
      </div>

      <div className="relative overflow-hidden px-3 py-4 sm:px-6 sm:py-6">
        {!battleStarted ? (
          <GunStartCue
            isSpotlight={isTutorial && tutorialStep.target === "start"}
            onStart={startGunSequence}
            startHref={startHref}
          />
        ) : null}

        {isTutorial && tutorialStep.target === "start" ? (
          <TutorialBubble>{tutorialStep.text}</TutorialBubble>
        ) : null}

        {battleStarted && isGunDialogOpen ? (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/78 p-3 sm:p-4">
            <div className="w-full max-w-3xl rounded border border-brass bg-stone-950 p-3 shadow-2xl sm:p-4">
              {isTutorial && tutorialStep.target === "trigger" ? (
                <TutorialBubble className="mb-3">{tutorialStep.text}</TutorialBubble>
              ) : null}
              <GunCue
                gunResult={gunResult}
                isSpotlight={isTutorial && tutorialStep.target === "trigger"}
                onPullTrigger={pullTrigger}
                triggerHref={triggerHref}
                triggerCount={triggerCount}
              />
            </div>
          </div>
        ) : null}

        <section className="mx-auto max-w-4xl rounded border border-emerald-200/20 bg-emerald-950/45 p-3 shadow-[inset_0_0_70px_rgba(0,0,0,0.35)] sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <HighLowZone
              canPlace={canPlaceCard}
              label="HIGH"
              placeHref={`/?stage=${stageId}&battle=high-low&robot=${robotId}&gun=1&shots=${triggerCount}&live=${liveParam}${
                robotZone ? `&rz=${robotZone}` : ""
              }&pz=HIGH`}
              onPlace={() => placePlayerCard("HIGH")}
              playerPlaced={playerZone === "HIGH"}
              playerCard={playerZone === "HIGH" ? tutorialPlayerCard : null}
              placeDisabled={isTutorial}
              spotlight={false}
              onDropCard={() => dropPlayerCard("HIGH")}
              robotPlaced={robotZone === "HIGH"}
              robotCard={robotZone === "HIGH" ? tutorialRobotCard : null}
              tone="high"
            />
            <HighLowZone
              canPlace={canPlaceCard}
              label="LOW"
              placeHref={`/?stage=${stageId}&battle=high-low&robot=${robotId}&gun=1&shots=${triggerCount}&live=${liveParam}${
                robotZone ? `&rz=${robotZone}` : ""
              }&pz=LOW`}
              onPlace={() => placePlayerCard("LOW")}
              playerPlaced={playerZone === "LOW"}
              playerCard={playerZone === "LOW" ? tutorialPlayerCard : null}
              placeDisabled={false}
              spotlight={isTutorial && tutorialStep.target === "player-card"}
              onDropCard={() => dropPlayerCard("LOW")}
              robotPlaced={robotZone === "LOW"}
              robotCard={robotZone === "LOW" ? tutorialRobotCard : null}
              tone="low"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
            <HandPanel cards={robotHand} owner="Robot" side="robot" />
            <HandPanel
              cards={playerHand}
              draggableCardIds={draggableCardIds}
              highlightedCardId={
                isTutorial && tutorialStep.target === "player-card"
                  ? tutorialPlayerCard?.id
                  : null
              }
              onCardDragStart={setDraggingCardId}
              owner="Player"
              side="player"
            />
          </div>

          {isTutorial && tutorialStep.target === "player-card" ? (
            <TutorialBubble className="mt-3">{tutorialStep.text}</TutorialBubble>
          ) : null}
        </section>

        <div className="hidden">
          {getHighLowGuideText({
            battleStarted,
            canPlaceCard,
            isTutorial,
            playerZone,
          })}
        </div>

        <div className="hidden">
          {canPlaceCard
            ? playerZone
              ? `プレイヤーは${playerZone}ゾーンへ配置しました。`
              : "発砲。ロボットが先に配置しました。プレイヤーもHIGHかLOWを選べます。"
            : battleStarted
              ? "引き金を引いて風船を割ると、配置可能になります。"
              : "ゲームスタートで拳銃の合図を開始します。弾は4発、最大6回までです。"}
        </div>
      </div>
    </div>
  );
}

function getCardsById(cardIds: string[]) {
  return cardIds
    .map((cardId) => deck.find((card) => card.id === cardId))
    .filter((card): card is PlayingCard => Boolean(card));
}

function getHighLowGuideText({
  battleStarted,
  canPlaceCard,
  isTutorial,
  playerZone,
}: {
  battleStarted: boolean;
  canPlaceCard: boolean;
  isTutorial: boolean;
  playerZone: HighLowZoneName | null;
}) {
  if (!isTutorial) {
    if (canPlaceCard) {
      return playerZone
        ? `プレイヤーは${playerZone}ゾーンへ配置しました。`
        : "発砲。ロボットが先に配置しました。プレイヤーもHIGHかLOWを選べます。";
    }

    return battleStarted
      ? "引き金を引いて風船を割ると、配置可能になります。"
      : "ゲームスタートで拳銃の合図を開始します。弾は4発、最大6回までです。";
  }

  if (playerZone === "LOW") {
    return "AをLOWゾーンに置きました。今回はロボットがHIGHゾーンにKを置いています。AはK以下なので、HIGH > LOW の関係が成り立たず負けです。";
  }

  if (canPlaceCard) {
    return "発砲されました。チュートリアルではロボットが即座にKをHIGHゾーンへ置きます。プレイヤーは手札のAをLOWゾーンに置いてみましょう。";
  }

  if (battleStarted) {
    return "引き金ボタンを押して風船を割りましょう。風船が割れた瞬間にゾーンへ配置できるようになります。";
  }

  return "まずは実際に1戦やってみましょう。ハイアンドローは、発砲の合図後にHIGHゾーンかLOWゾーンへカードを置くゲームです。ゲームスタートを押してから、自分で引き金を引いて発砲を待ちます。";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getHighLowTutorialStep({
  battleStarted,
  canPlaceCard,
  playerZone,
}: {
  battleStarted: boolean;
  canPlaceCard: boolean;
  playerZone: HighLowZoneName | null;
}): {
  target: "start" | "trigger" | "player-card" | "done";
  text: string;
} {
  if (playerZone === "LOW") {
    return {
      target: "done",
      text: "AをLOWゾーンに置きました。ロボットのKがHIGHゾーンにあり、AはK以下なので条件が成り立たず負けです。",
    };
  }

  if (canPlaceCard) {
    return {
      target: "player-card",
      text: "ロボットが先にKをHIGHゾーンへ置きました。手札のAをLOWゾーンへドラッグして置いてみましょう。",
    };
  }

  if (battleStarted) {
    return {
      target: "trigger",
      text: "引き金を押して風船を割りましょう。風船が割れたらカードを置けるようになります。",
    };
  }

  return {
    target: "start",
    text: "まずは実際に1戦やってみましょう。ゲームスタートを押すと、発砲の合図を待つチュートリアルが始まります。",
  };
}

function TutorialBubble({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto max-w-4xl rounded border border-brass bg-stone-950 px-4 py-3 text-sm font-bold leading-6 text-stone-50 shadow-[0_0_24px_rgba(246,195,92,0.24)] ${className}`}
    >
      <span className="absolute -top-2 left-8 h-4 w-4 rotate-45 border-l border-t border-brass bg-stone-950" />
      {children}
    </div>
  );
}

function getHighLowTutorialStepContent({
  battleStarted,
  canPlaceCard,
  playerZone,
}: {
  battleStarted: boolean;
  canPlaceCard: boolean;
  playerZone: HighLowZoneName | null;
}): {
  target: "start" | "trigger" | "player-card" | "done";
  text: string;
} {
  if (playerZone === "LOW") {
    return {
      target: "done",
      text: "AをLOWゾーンに置きました。ロボットのKがHIGHゾーンにあり、AはK以下なので条件が成り立たず負けです。",
    };
  }

  if (canPlaceCard) {
    return {
      target: "player-card",
      text: "風船を割れたので、プレイヤーも配置できるようになりました。手札のAをLOWゾーンへドラッグして置いてみましょう。",
    };
  }

  if (battleStarted) {
    return {
      target: "trigger",
      text: "あなたは銃で風船を割らないと、どちらのゾーンにもカードを置けません。外れても弾は補充できるので心配はいりません。風船が割れるまで撃ちましょう。",
    };
  }

  return {
    target: "start",
    text: "まずは実際に1戦やってみましょう。ゲームスタート時点でロボットはカードを置けますが、あなたは銃で風船を割るまで配置できません。",
  };
}

function GunStartCue({
  isSpotlight,
  onStart,
  startHref,
}: {
  isSpotlight: boolean;
  onStart: () => void;
  startHref: string;
}) {
  return (
    <section
      className={`mx-auto mb-4 max-w-4xl rounded border bg-black/35 p-3 sm:p-4 ${
        isSpotlight
          ? "animate-pulse border-brass ring-4 ring-brass/50"
          : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
            Start Signal
          </p>
          <p className="mt-1 text-sm text-stone-200">
            ゲームスタートで銃のダイアログを開きます。
          </p>
        </div>
        <a
          className="grid min-h-11 place-items-center rounded bg-brass px-4 text-sm font-black text-stone-950 hover:bg-yellow-300"
          href={startHref}
          onClick={onStart}
        >
          ゲームスタート
        </a>
      </div>
    </section>
  );
}

function GunCue({
  gunResult,
  isSpotlight,
  onPullTrigger,
  triggerHref,
  triggerCount,
}: {
  gunResult: GunResult | null;
  isSpotlight: boolean;
  onPullTrigger: (event?: MouseEvent<HTMLAnchorElement>) => void;
  triggerHref: string;
  triggerCount: number;
}) {
  const isFire = gunResult === "fire";
  const isTriggerDisabled = triggerCount >= GUN_MAX_TRIGGERS;
  const isStarted = true;
  const startHref = triggerHref;

  return (
    <section
      className={`mx-auto mb-4 max-w-4xl overflow-hidden rounded border bg-black/35 p-3 sm:p-4 ${
        isSpotlight
          ? "animate-pulse border-brass ring-4 ring-brass/50"
          : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
            Start Signal
          </p>
          <p className="mt-1 text-sm text-stone-200">
            {isStarted ? `${triggerCount}/${GUN_MAX_TRIGGERS}` : "未開始"} /
            弾丸 {GUN_LIVE_ROUNDS} 発
          </p>
        </div>
        {isTriggerDisabled ? (
          <button
            className="min-h-11 cursor-not-allowed rounded bg-stone-700 px-4 text-sm font-black text-stone-400"
            disabled
            type="button"
          >
            引き金
          </button>
        ) : (
          <a
            className={`grid min-h-11 place-items-center rounded px-4 text-sm font-black ${
            !isStarted
              ? "bg-brass text-stone-950 hover:bg-yellow-300"
              : "bg-casinoRed text-white hover:bg-red-700"
          }`}
            href={isStarted ? triggerHref : startHref}
            onClick={(event) => {
              event.preventDefault();
              onPullTrigger(event);
            }}
          >
            {isStarted ? "引き金" : "ゲームスタート"}
          </a>
        )}
      </div>

      <div className="relative mt-3 h-28 overflow-hidden rounded bg-white sm:h-36">
        <div className="absolute left-[10%] top-1/2 z-10 -translate-y-1/2">
          {isFire ? (
            <div className="relative h-24 w-24 sm:h-32 sm:w-32">
              <div className="absolute inset-1 rounded-full border-4 border-casinoRed/70 opacity-80 shadow-[0_0_28px_rgba(180,31,44,0.8)]" />
              <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brass/80" />
              <div className="absolute left-5 top-3 h-8 w-7 rotate-[-28deg] rounded-full bg-casinoRed shadow-[0_0_12px_rgba(180,31,44,0.75)] [clip-path:polygon(50%_0%,100%_45%,72%_100%,10%_80%,0%_20%)]" />
              <div className="absolute right-4 top-6 h-7 w-8 rotate-[34deg] rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.7)] [clip-path:polygon(0%_20%,80%_0%,100%_72%,42%_100%)]" />
              <div className="absolute bottom-4 left-9 h-7 w-6 rotate-[12deg] rounded-full bg-red-700 shadow-[0_0_12px_rgba(127,29,29,0.75)] [clip-path:polygon(30%_0%,100%_22%,74%_100%,0%_70%)]" />
              <div className="absolute right-10 top-1/2 h-2 w-12 rotate-[-12deg] rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
              <div className="absolute left-2 top-1/2 h-2 w-10 rotate-[22deg] rounded-full bg-brass shadow-[0_0_12px_rgba(246,195,92,0.9)]" />
            </div>
          ) : (
            <div className="relative h-24 w-20 sm:h-32 sm:w-28">
              <div className="absolute inset-x-1 top-0 h-20 rounded-[50%_50%_45%_45%] bg-gradient-to-br from-red-400 via-casinoRed to-red-900 shadow-[inset_-10px_-14px_18px_rgba(0,0,0,0.24),0_0_24px_rgba(180,31,44,0.45)] sm:h-28" />
              <div className="absolute left-6 top-4 h-5 w-3 rotate-[28deg] rounded-full bg-white/75 blur-[1px] sm:left-8 sm:h-7 sm:w-4" />
              <div className="absolute bottom-4 left-1/2 h-4 w-5 -translate-x-1/2 bg-red-900 [clip-path:polygon(50%_0%,100%_100%,0%_100%)]" />
              <div className="absolute bottom-0 left-1/2 h-5 w-px -translate-x-1/2 bg-stone-500" />
            </div>
          )}
        </div>
        <Image
          alt="発砲合図の拳銃"
          className={`absolute bottom-0 h-full w-auto object-contain transition-transform duration-500 ${
            isStarted ? "right-0 translate-x-[42%]" : "-right-full"
          } ${isFire ? "scale-[1.03]" : ""}`}
          height={320}
          priority
          src="/gun.png"
          width={680}
        />
        {isFire ? (
          <>
            <div className="absolute left-[10%] top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 sm:h-32 sm:w-32">
              <div className="absolute inset-0 rounded-full border-4 border-brass/80 opacity-80 shadow-[0_0_28px_rgba(246,195,92,0.95)]" />
              <div className="absolute inset-3 rounded-full border-2 border-white/80 opacity-80" />
              <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-brass shadow-[0_0_34px_rgba(246,195,92,1)] [clip-path:polygon(50%_0%,62%_34%,100%_18%,74%_50%,100%_82%,62%_66%,50%_100%,38%_66%,0%_82%,26%_50%,0%_18%,38%_34%)] sm:h-28 sm:w-28" />
              <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rotate-12 bg-white [clip-path:polygon(50%_0%,65%_35%,100%_45%,68%_62%,80%_100%,50%_76%,20%_100%,32%_62%,0%_45%,35%_35%)] sm:h-16 sm:w-16" />
            </div>
            <div className="absolute left-[10%] top-1/2 h-3 w-[58%] -translate-y-1/2 bg-gradient-to-l from-white via-brass/80 to-transparent opacity-75 blur-[1px]" />
            <div className="absolute left-[21%] top-[28%] h-2 w-10 rotate-[18deg] rounded-full bg-brass shadow-[0_0_14px_rgba(246,195,92,0.9)]" />
            <div className="absolute left-[22%] top-[70%] h-2 w-12 rotate-[-20deg] rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)]" />
            <div className="absolute right-4 top-4 rounded bg-casinoRed px-3 py-2 text-sm font-black text-white shadow-lg">
              発砲
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function HighLowZone({
  canPlace,
  label,
  onDropCard,
  onPlace,
  placeHref,
  placeDisabled,
  playerCard,
  playerPlaced,
  robotCard,
  robotPlaced,
  spotlight,
  tone,
}: {
  canPlace: boolean;
  label: "HIGH" | "LOW";
  onDropCard: () => void;
  onPlace: () => void;
  placeHref: string;
  placeDisabled: boolean;
  playerCard?: PlayingCard | null;
  playerPlaced: boolean;
  robotCard?: PlayingCard | null;
  robotPlaced: boolean;
  spotlight: boolean;
  tone: "high" | "low";
}) {
  const canUsePlace = canPlace && !placeDisabled;
  const placedCard = playerCard ?? robotCard;

  return (
    <div
      className={`relative grid min-h-36 place-items-center rounded border-2 border-dashed p-4 text-center sm:min-h-52 ${
        tone === "high"
          ? "border-casinoRed/80 bg-red-950/20"
          : "border-sky-300/80 bg-sky-950/20"
      } ${spotlight ? "animate-pulse ring-4 ring-brass/70" : ""}`}
      onDragOver={(event) => {
        if (canUsePlace) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        if (!canUsePlace) {
          return;
        }

        event.preventDefault();
        onDropCard();
      }}
    >
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-black text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] sm:left-5 sm:text-4xl">
        {label}
      </span>
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
        {placedCard ? <PlayingCardView card={placedCard} size="zone" /> : null}
      </div>
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        <span
          className={`rounded px-2 py-1 text-xs font-black ${
            robotPlaced ? "bg-brass text-stone-950" : "bg-black/40 text-stone-400"
          }`}
        >
          ROBOT
        </span>
        {canUsePlace ? (
          <a
            className={`rounded px-3 py-2 text-xs font-black ${
            playerPlaced
              ? "bg-emerald-500 text-stone-950"
              : "bg-white/12 text-white hover:bg-white/20"
          }`}
            href={placeHref}
            onClick={onPlace}
          >
            {playerPlaced ? "PLACED" : "PLACE"}
          </a>
        ) : (
          <button
            className="cursor-not-allowed rounded bg-white/6 px-3 py-2 text-xs font-black text-stone-500"
            disabled
            type="button"
          >
            PLACE
          </button>
        )}
      </div>
    </div>
  );
}

function HandPanel({
  cards,
  draggableCardIds = [],
  highlightedCardId = null,
  onCardDragStart,
  owner,
  side,
}: {
  cards: PlayingCard[];
  draggableCardIds?: string[];
  highlightedCardId?: string | null;
  onCardDragStart?: (cardId: string) => void;
  owner: "Player" | "Robot";
  side: "player" | "robot";
}) {
  return (
    <div className="relative rounded border border-white/10 bg-black/30 p-3">
      {side === "robot" ? (
        <div className="absolute -right-4 top-5 h-12 w-24 rotate-[-10deg] rounded-l-full bg-stone-300/85 shadow-lg" />
      ) : null}
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
        {owner} Hand
      </p>
      <div className="mt-3 flex justify-center gap-2 sm:gap-3">
        {cards.map((card) => (
          <PlayingCardView
            card={card}
            draggable={draggableCardIds.includes(card.id)}
            highlighted={highlightedCardId === card.id}
            key={`${owner}-${card.id}`}
            onDragStart={() => onCardDragStart?.(card.id)}
            size="hand"
          />
        ))}
      </div>
    </div>
  );
}

function GameLogo({
  compact = false,
  gameType,
}: {
  compact?: boolean;
  gameType: GameType;
}) {
  const logo = gameLogo[gameType];
  const sizeClass = compact
    ? "h-10 w-36"
    : "h-32 w-[360px] max-w-full sm:h-48 sm:w-[620px]";
  const imageSizes = compact ? "144px" : "(min-width: 640px) 620px, 360px";

  return (
    <div
      className={`overflow-hidden drop-shadow-[0_4px_10px_rgba(0,0,0,0.75)] ${sizeClass}`}
    >
      <Image
        alt={`${logo.alt}のロゴ`}
        className="h-full w-full object-contain"
        height={120}
        sizes={imageSizes}
        src={logo.src}
        width={320}
      />
    </div>
  );
}

function PlayingCardView({
  card,
  draggable = false,
  highlighted = false,
  onDragStart,
  size,
}: {
  card: PlayingCard;
  draggable?: boolean;
  highlighted?: boolean;
  onDragStart?: () => void;
  size: "field" | "hand" | "zone";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const isRed = card.suit === "daia" || card.suit === "heart";
  const suitSymbols = {
    crub: "♣",
    daia: "♦",
    heart: "♥",
    spade: "♠",
  };
  const sizeClass =
    size === "zone"
      ? "h-28 w-20 sm:h-36 sm:w-24"
      : size === "field"
        ? "h-16 w-11 sm:h-20 sm:w-14"
        : "h-20 w-14 sm:h-24 sm:w-16";

  if (!imageFailed) {
    return (
      <div
        className={`relative overflow-hidden rounded border border-brass bg-stone-50 shadow ${sizeClass} ${
          highlighted ? "animate-pulse ring-4 ring-brass/70" : ""
        } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
        draggable={draggable}
        onDragStart={(event) => {
          if (!draggable) {
            return;
          }

          event.dataTransfer.setData("text/plain", card.id);
          onDragStart?.();
        }}
      >
        <Image
          alt={`${card.rank} ${card.suit}`}
          className="object-cover"
          fill
          onError={() => setImageFailed(true)}
          sizes="80px"
          src={card.imageSrc}
        />
      </div>
    );
  }

  return (
    <div
      className={`grid place-items-center rounded border border-brass bg-stone-50 text-center font-black shadow ${sizeClass} ${
        isRed ? "text-casinoRed" : "text-stone-950"
      } ${highlighted ? "animate-pulse ring-4 ring-brass/70" : ""} ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) {
          return;
        }

        event.dataTransfer.setData("text/plain", card.id);
        onDragStart?.();
      }}
    >
      <span className="text-2xl leading-none sm:text-3xl">{card.rank}</span>
      <span className="text-lg leading-none sm:text-xl">{suitSymbols[card.suit]}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StatusPanel({
  allRobotsPlayed,
  chips,
  isStageClear,
  playedCount,
  stage,
  stageStatus,
}: {
  allRobotsPlayed: boolean;
  chips: number;
  isStageClear: boolean;
  playedCount: number;
  stage: Stage;
  stageStatus: string;
}) {
  return (
    <section className="rounded border border-white/12 bg-black/30 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold sm:text-lg">ステータス</h2>
        <span
          className={`rounded px-2 py-1 text-xs font-black ${
            isStageClear ? "bg-emerald-500 text-stone-950" : "bg-brass text-stone-950"
          }`}
        >
          {stageStatus}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
        <Metric icon={<CircleDollarSign size={18} />} label="Player" value={chips} />
        <Metric
          icon={<Trophy size={18} />}
          label="Battles"
          value={`${playedCount}/${stage.robots.length}`}
        />
      </div>
      <div className="mt-3 rounded border border-white/10 bg-white/6 p-3 text-sm leading-6 text-stone-300 sm:mt-4">
        {isStageClear
          ? "必要な対戦をすべて終えました。ステージクリアです。"
          : allRobotsPlayed
            ? "全対戦が完了しています。"
            : stage.clearText}
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded border border-white/10 bg-white/6 p-3">
      <div className="flex items-center gap-2 text-stone-300">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] sm:text-xs sm:tracking-[0.16em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}
