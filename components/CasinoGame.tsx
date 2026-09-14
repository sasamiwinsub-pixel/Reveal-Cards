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
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
import {
  blackjackRuleText,
  blackjackSpecText,
  createDeck,
  drawOpeningHand,
  getGameSeat,
  getGameLabel,
  getRobotGameTypes,
  pokerBettingSpecText,
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

const HIGH_LOW_TUTORIAL_ROBOT_ID = "high-low-1-1";
const deck = createDeck();

const scanTargetImages = {
  haiking: "/scan-targets/haiking.png",
  hiace: "/scan-targets/hiace.png",
  jyuusho: "/scan-targets/jyuusho.png",
  kyuusho: "/scan-targets/kyuusho.png",
  onepair: "/scan-targets/onepair.png",
  queen: "/scan-targets/queen.png",
  rain: "/scan-targets/rain.png",
  sugoroku: "/scan-targets/sugoroku.png",
} as const;

const highLowBattleConfigs = {
  "high-low-1-1": {
    correctExchangePairs: [
      ["K-spade", "A-spade"],
      ["K-spade", "A-daia"],
    ],
    initialPlayerHandIds: ["A-daia", "A-spade"],
    initialRobotHandIds: ["A-heart", "K-spade"],
    robotHighCardAfterExchangeId: "A-spade",
  },
  "high-low-1-2": {
    correctExchangePairs: [["Q-spade", "J-spade"]],
    initialPlayerHandIds: ["A-heart", "Q-spade"],
    initialRobotHandIds: ["J-spade", "A-crub"],
    robotHighCardAfterExchangeId: "A-crub",
  },
  "high-low-1-3": {
    correctExchangePairs: [
      ["A-spade", "Q-heart"],
      ["A-spade", "Q-daia"],
    ],
    initialPlayerHandIds: ["Q-heart", "Q-daia"],
    initialRobotHandIds: ["A-spade", "K-heart"],
    robotHighCardAfterExchangeId: "K-heart",
  },
  "all-games-last": {
    correctExchangePairs: [],
    initialPlayerHandIds: ["A-daia", "J-heart"],
    initialRobotHandIds: ["Q-heart", "K-crub"],
    robotHighCardAfterExchangeId: "K-crub",
  },
} as const;

const blackjackBattleConfigs = {
  "blackjack-2-1": {
    exchangePlayerCardId: "A-daia",
    exchangeRobotCardId: "J-spade",
    highLowRobotHandIds: ["A-crub", "J-crub"],
    initialPlayerHandIds: ["A-daia", "A-heart"],
    initialRobotHandIds: ["A-spade", "J-spade"],
  },
  "blackjack-2-2": {
    highLowRobotHandIds: ["J-crub", "J-heart"],
    initialPlayerHandIds: ["A-heart", "A-daia"],
    initialRobotHandIds: ["A-spade", "Q-daia"],
    learningRestriction:
      "勝利後追加: このStageの間、ロボットの手札はエクスチェンジできない。",
    scanTargetCardId: "scan-10",
  },
  "blackjack-high-low-2-3": {
    initialPlayerHandIds: ["Q-heart", "A-spade"],
    initialRobotHandIds: ["A-crub", "K-spade"],
  },
  "all-games-last": {
    highLowRobotHandIds: ["Q-heart", "K-crub"],
    initialPlayerHandIds: ["A-daia", "J-heart"],
    initialRobotHandIds: ["K-heart", "Q-daia"],
  },
} as const;

const pokerBattleConfigs = {
  "poker-3-1": {
    blackjackRobotHandIds: ["K-spade", "J-daia"],
    exchangePairs: [
      {
        firstCardId: "Q-heart",
        secondCardId: "K-spade",
      },
    ],
    fieldCardIds: ["K-crub", "K-heart", "Q-daia", "J-crub"],
    highLowRobotHandIds: ["A-crub", "K-daia"],
    initialPlayerHandIds: ["A-daia", "Q-heart"],
    initialRobotHandIds: ["A-spade", "A-heart"],
    maxExchanges: 1,
    successText:
      "自分のクイーンとブラックジャックロボットのキングを交換済み。ポーカーはキングのスリーカード、ハイアンドローはAでもKでも後出しで成立、ブラックジャックはA+K=21で勝利できます。",
  },
  "poker-3-2": {
    blackjackRobotHandIds: ["J-daia", "J-spade"],
    exchangePairs: [
      {
        firstCardId: "scan-0",
        secondCardId: "J-daia",
      },
      {
        firstCardId: "scan-A",
        secondCardId: "K-spade",
      },
    ],
    fieldCardIds: ["K-daia", "A-heart", "Q-heart", "J-crub"],
    highLowRobotHandIds: ["A-crub", "A-spade"],
    initialPlayerHandIds: ["A-daia", "K-spade"],
    initialRobotHandIds: ["K-crub", "K-heart"],
    maxExchanges: 2,
    maxScans: 2,
    scanRequirements: [
      {
        answer: "フエ",
        cardId: "scan-0",
        illustration: "れい　ん",
        riddleSrc: "/riddles/riddle_3.png",
        targetImageSrc: scanTargetImages.rain,
      },
      {
        answer: "ツーペア",
        cardId: "scan-A",
        illustration: "わん　ぺあ",
        riddleSrc: "/riddles/riddle_4.png",
        targetImageSrc: scanTargetImages.onepair,
      },
    ],
    successText:
      "スキャンで生成した0をブラックジャックロボットのJ、生成したAを自分のKと交換済み。ハイアンドローはAを出せば成立し、ブラックジャックはロボット側が10+0、ポーカーはAのスリーカードでKのスリーカードを上回る形になります。",
  },
  "poker-3-3": {
    blackjackRobotHandIds: ["A-spade", "J-spade"],
    copyPasteTargets: [
      {
        id: "copy-red-unlock-zero",
        label: "コピペ解放小謎: 0",
        text: "0",
      },
      {
        id: "paste-blackjack-ace",
        label: "ブラックジャックロボットのA",
        text: "A",
      },
    ],
    exchangePairs: [],
    fieldCardIds: ["A-heart", "K-crub", "Q-heart", "J-crub"],
    highLowRobotHandIds: ["Q-heart", "Q-daia"],
    initialPlayerHandIds: ["K-spade", "Q-daia"],
    initialRobotHandIds: ["Q-crub", "J-daia"],
    maxCopyPastes: 1,
    maxExchanges: 0,
    maxScans: 0,
    successText:
      "ブラックジャックロボットのAを0へ変更済み。ハイアンドローはそのまま勝利、ブラックジャックは自分がK+Q=20でロボットが0+J=10、ポーカーはロボットの勝率が0%のため0chipを賭け、そのままプレイヤーの勝利です。",
  },
  "all-games-last": {
    blackjackRobotHandIds: ["K-heart", "Q-daia"],
    exchangePairs: [],
    fieldCardIds: ["A-crub", "K-spade", "K-daia", "J-crub"],
    highLowRobotHandIds: ["Q-heart", "K-crub"],
    initialPlayerHandIds: ["K-crub", "scan-K"],
    initialRobotHandIds: ["A-spade", "A-heart"],
    maxCopyPastes: 5,
    maxExchanges: 0,
    maxScans: 3,
    scanRequirements: [
      {
        answer: "ハイキング",
        cardId: "scan-A",
        illustration: "ハイ　エース",
        riddleSrc: "/riddles/riddle_4.png",
        targetImageSrc: scanTargetImages.hiace,
      },
      {
        answer: "ハイキング",
        cardId: "scan-J",
        illustration: "ハイ　ジャック",
        riddleSrc: "/riddles/riddle_4.png",
        targetImageSrc: scanTargetImages.haiking,
      },
      {
        answer: "に/じゅういち",
        cardId: "scan-K",
        illustration: "ブラックジャック",
        riddleSrc: "/riddles/riddle_5.png",
        targetImageSrc: scanTargetImages.haiking,
      },
    ],
    successText:
      "ブラックジャック宣言のタイミングでエクスチェンジが発動済み。ポーカーロボットもオールインし、プレイヤーはK2枚、フィールドにもK2枚があるため、Kフォーカードでポーカーロボットに勝利できます。",
  },
} as const;

type FocusOption = {
  robot: Robot;
};

type ActiveBattle = {
  gameType: GameType;
  robotId: string;
};

type ExchangeCardSection = {
  cards: PlayingCard[];
  id: string;
  label: string;
};

type ScanAbility = "なし" | "エクスチェンジ" | "コピーペースト";
type PlacementStyle = "gentle" | "snap";

type ScanCatalogEntry = {
  answer: string;
  ability: ScanAbility;
  generated: boolean;
  generatedNumber: string;
  id: string;
  illustrationName: string;
  selected?: boolean;
  targetImageSrc: string;
};

type HighLowZoneName = "HIGH" | "LOW";
type PreparationAbility = "exchange" | "scan" | "copy-paste";
type TargetSelectionAbility = "exchange" | "copy-paste";
type CopyPasteFormat = "hiragana" | "katakana" | "kanji" | "number";
type ExchangeTargetId =
  | "player-hand"
  | "robot-hand"
  | "deck"
  | "field"
  | "visible-print";

const generatedScanCards: Record<string, PlayingCard> = {
  "scan-0": {
    id: "scan-0",
    imageSrc: "",
    rank: "0",
    suit: "spade",
  },
  "scan-10": {
    id: "scan-10",
    imageSrc: "",
    rank: "10",
    suit: "spade",
  },
  "scan-A": {
    id: "scan-A",
    imageSrc: "",
    rank: "A",
    suit: "spade",
  },
  "scan-J": {
    id: "scan-J",
    imageSrc: "",
    rank: "J",
    suit: "spade",
  },
  "scan-K": {
    id: "scan-K",
    imageSrc: "",
    rank: "K",
    suit: "spade",
  },
};

const scanRuleText =
  "小謎内のイラストを対象にスキャンして、法則に従ってトランプ1枚（1〜13）を生成できる。ただし、生成したカードはエクスチェンジ機能を使って初めてゲームへ利用できる。スキャン対象イラストの入力では、数字として読む部分をスペース区切りで空ける。※インクで見えない部分もスキャン可能だが、例示と答えの単語で被りが出ることはない。※トランプのスキャンはできないが、ポーカーとして現物のトランプをセットした時に役名なら生成できる。例：イチ　ゴ→6、フォー　カード→4、レース　クイーン→12、ひ　ふ　み→和名のためNG、レイチ　ョウルイ→0でも1でもないためNG、イチ　モクサン→3が区切られていないためNG";

const scanRiddleImages = [
  {
    alt: "小謎 1/2",
    src: "/riddles/riddle_1.png",
  },
  {
    alt: "小謎 2/2",
    src: "/riddles/riddle_1-2.png",
  },
  {
    alt: "追加小謎",
    src: "/riddles/riddle_2.png",
  },
];

const initialScanCatalogEntries: ScanCatalogEntry[] = [
  {
    answer: "0315",
    ability: "なし",
    generated: true,
    generatedNumber: "9",
    id: "scan-catalog-vital-0315",
    illustrationName: "きゅう　しょ",
    targetImageSrc: scanTargetImages.kyuusho,
  },
  {
    answer: "ななめ",
    ability: "エクスチェンジ",
    generated: true,
    generatedNumber: "10",
    id: "scan-catalog-address-exchange",
    illustrationName: "じゅう　しょ",
    targetImageSrc: scanTargetImages.jyuusho,
  },
  {
    answer: "フエ",
    ability: "なし",
    generated: true,
    generatedNumber: "0",
    id: "scan-catalog-flute-rain",
    illustrationName: "れい　ん",
    targetImageSrc: scanTargetImages.rain,
  },
  {
    answer: "ツーペア",
    ability: "なし",
    generated: true,
    generatedNumber: "1",
    id: "scan-catalog-one-pair-a",
    illustrationName: "わん　ぺあ",
    targetImageSrc: scanTargetImages.onepair,
  },
  {
    answer: "すいり",
    ability: "なし",
    generated: false,
    generatedNumber: "12",
    id: "scan-catalog-queen-reasoning",
    illustrationName: "クイーン",
    targetImageSrc: scanTargetImages.queen,
  },
  {
    answer: "ハイキング",
    ability: "コピーペースト",
    generated: false,
    generatedNumber: "1",
    id: "scan-catalog-hiace-copy",
    illustrationName: "ハイ　エース",
    targetImageSrc: scanTargetImages.hiace,
  },
  {
    answer: "ハイキング",
    ability: "コピーペースト",
    generated: false,
    generatedNumber: "11",
    id: "scan-catalog-highjack-copy",
    illustrationName: "ハイ　ジャック",
    targetImageSrc: scanTargetImages.haiking,
  },
];

function normalizeScanIllustrationName(value: string) {
  return value.trim().replace(/[／/]/g, " ").replace(/[\s\u3000]+/g, " ");
}

const finalBattleDisclosureSections: ExchangeCardSection[] = [
  {
    cards: getCardsById(["A-daia", "J-heart"]),
    id: "final-player-hand",
    label: "自分の手札",
  },
  {
    cards: getCardsById(["A-spade", "A-heart"]),
    id: "final-poker-robot-hand",
    label: "ポーカーロボットの手札",
  },
  {
    cards: getCardsById(["A-crub", "K-spade", "K-daia", "J-crub"]),
    id: "final-poker-field",
    label: "ポーカーのフィールド",
  },
  {
    cards: getCardsById(["K-heart", "Q-daia"]),
    id: "final-blackjack-robot-hand",
    label: "ブラックジャックのロボット手札",
  },
  {
    cards: getCardsById(["Q-heart", "K-crub"]),
    id: "final-high-low-robot-hand",
    label: "ハイアンドローのロボット手札",
  },
];

export default function CasinoGame({
  initialBattle = null,
  initialStageId = 1,
}: {
  initialBattle?: ActiveBattle | null;
  initialStageId?: number;
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
  const [postBattleLine, setPostBattleLine] = useState("");
  const [finalScanCatalogEntries, setFinalScanCatalogEntries] = useState<
    ScanCatalogEntry[]
  >(initialScanCatalogEntries);
  const [isFinalDisclosureSeen, setIsFinalDisclosureSeen] = useState(false);
  const [isFinalScanCatalogComplete, setIsFinalScanCatalogComplete] =
    useState(false);
  const [isFinalAbilitySpecSeen, setIsFinalAbilitySpecSeen] = useState(false);

  const stage = stages.find((item) => item.id === stageId) ?? stages[0];
  const hand = useMemo(() => drawOpeningHand(stage.id), [stage.id]);
  const focusOptions = useMemo<FocusOption[]>(
    () => stage.robots.map((robot) => ({ robot })),
    [stage],
  );
  const boundedFocusedOptionIndex = Math.min(
    focusedOptionIndex,
    Math.max(focusOptions.length - 1, 0),
  );
  const focusedOption =
    focusOptions[boundedFocusedOptionIndex] ?? null;
  const focusedRobot = focusedOption?.robot ?? null;
  const focusedGameTypes = focusedRobot ? getRobotGameTypes(focusedRobot) : [];
  const focusGameTypeKeys = focusOptions.map(
    (option) => getRobotGameTypes(option.robot)[0],
  );
  const hasMultipleVisibleGameTypes = new Set(focusGameTypeKeys).size > 1;
  const canFocusPrevious =
    hasMultipleVisibleGameTypes && boundedFocusedOptionIndex > 0;
  const canFocusNext =
    hasMultipleVisibleGameTypes &&
    boundedFocusedOptionIndex < focusOptions.length - 1;
  const selectedRobot =
    stage.robots.find((robot) => robot.id === selectedRobotId) ?? null;
  const activeBattleRobot =
    stage.robots.find((robot) => robot.id === activeBattle?.robotId) ?? null;
  const isHighLowBattle = activeBattle?.gameType === "high-low" && activeBattleRobot;
  const isBlackjackBattle =
    activeBattle?.gameType === "blackjack" && activeBattleRobot;
  const isPokerBattle = activeBattle?.gameType === "poker" && activeBattleRobot;
  const allRobotsPlayed = playedRobotIds.length === stage.robots.length;
  const isStageClear = allRobotsPlayed;
  const nextStage = stages.find((item) => item.id === stage.id + 1) ?? null;
  const shouldShowFinalDisclosure =
    stage.id === 4 &&
    !activeBattle &&
    !isFinalDisclosureSeen &&
    !isFinalScanCatalogComplete;
  const shouldShowFinalScanCatalog =
    stage.id === 4 &&
    !activeBattle &&
    isFinalDisclosureSeen &&
    !isFinalScanCatalogComplete;
  const shouldShowFinalAbilitySpec =
    stage.id === 4 &&
    !activeBattle &&
    isFinalDisclosureSeen &&
    isFinalScanCatalogComplete &&
    !isFinalAbilitySpecSeen;
  const [modal, setModal] = useState<{
    gameType: GameType;
    kind: ModalKind;
    robot: Robot;
  } | null>(null);

  function goToStage(nextStageId: number) {
    const destinationStage =
      stages.find((item) => item.id === nextStageId) ?? stage;

    setStageId(destinationStage.id);
    setChips(destinationStage.startingChips);
    setPlayedRobotIds([]);
    setSelectedRobotId(null);
    setSelectedGameType(null);
    setActiveBattle(null);
    setFocusedOptionIndex(0);
    setModal(null);
    setPostBattleLine("");
    setIsFinalDisclosureSeen(false);
    setIsFinalScanCatalogComplete(false);
    setIsFinalAbilitySpecSeen(false);
  }

  function resetCurrentStage() {
    goToStage(stage.id);
  }

  function focusRobot(offset: number) {
    setFocusedOptionIndex((current) => {
      const robotCount = focusOptions.length;
      if (robotCount === 0) {
        return 0;
      }

      const next = current + offset;

      return Math.min(Math.max(next, 0), robotCount - 1);
    });
  }

  function selectRobot(robot: Robot, gameType?: GameType) {
    if (playedRobotIds.includes(robot.id) || isStageClear) {
      return;
    }

    const firstGameType = gameType ?? getRobotGameTypes(robot)[0];
    setPostBattleLine("");
    setSelectedRobotId(robot.id);
    setSelectedGameType(firstGameType);
    setActiveBattle({ gameType: firstGameType, robotId: robot.id });
  }

  function resolveRound(outcome: Outcome) {
    if (!selectedRobot || playedRobotIds.includes(selectedRobot.id)) {
      return;
    }

    const battleGameTypes = getRobotGameTypes(selectedRobot);
    const currentBattleIndex = activeBattle
      ? battleGameTypes.indexOf(activeBattle.gameType)
      : -1;
    const nextGameType = battleGameTypes[currentBattleIndex + 1];

    if (outcome === "win" && nextGameType) {
      setSelectedGameType(nextGameType);
      setActiveBattle({ gameType: nextGameType, robotId: selectedRobot.id });
      return;
    }

    const reward = outcome === "win" ? selectedRobot.rewardChips ?? 0 : chipDelta[outcome];

    const nextUnplayedIndex = stage.robots.findIndex(
      (robot) =>
        robot.id !== selectedRobot.id && !playedRobotIds.includes(robot.id),
    );

    setChips((current) => Math.max(0, current + reward));
    setPlayedRobotIds((current) => [...current, selectedRobot.id]);
    setPostBattleLine(
      outcome === "win" && selectedRobot.id === "poker-3-3"
        ? "少しおかしいな...準備段階ではポーカーロボットの勝率は0%だったはず..."
        : "",
    );
    if (nextUnplayedIndex >= 0) {
      setFocusedOptionIndex(nextUnplayedIndex);
    }
    setSelectedRobotId(null);
    setSelectedGameType(null);
    setActiveBattle(null);
  }

  return (
    <main className="min-h-screen px-3 py-3 max-[424px]:px-2 max-[374px]:px-1.5 sm:px-5 lg:px-8 lg:py-6">
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
            {isBlackjackBattle ? (
              <BlackjackBattle
                backHref={`/?stage=${stage.id}`}
                hand={hand}
                onBack={() => {
                  setSelectedRobotId(null);
                  setSelectedGameType(null);
                  setActiveBattle(null);
                }}
                robotId={activeBattle.robotId}
              />
            ) : isHighLowBattle ? (
              <HighLowBattle
                backHref={`/?stage=${stage.id}`}
                hand={hand}
                onBack={() => {
                  setSelectedRobotId(null);
                  setSelectedGameType(null);
                  setActiveBattle(null);
                }}
                robotId={activeBattle.robotId}
                stageId={stage.id}
              />
            ) : isPokerBattle ? (
              <PokerBattle
                backHref={`/?stage=${stage.id}`}
                hand={hand}
                onBack={() => {
                  setSelectedRobotId(null);
                  setSelectedGameType(null);
                  setActiveBattle(null);
                }}
                robot={activeBattleRobot}
                robotId={activeBattle.robotId}
              />
            ) : shouldShowFinalDisclosure ? (
              <FinalDisclosure
                onContinue={() => setIsFinalDisclosureSeen(true)}
              />
            ) : shouldShowFinalScanCatalog ? (
              <FinalScanCatalogBuilder
                entries={finalScanCatalogEntries}
                onComplete={() => setIsFinalScanCatalogComplete(true)}
                onMarkGenerated={(entryId) =>
                  setFinalScanCatalogEntries((current) =>
                    current.map((entry) =>
                      entry.id === entryId
                        ? {
                            ...entry,
                            generated: true,
                          }
                        : entry,
                    ),
                  )
                }
                onToggleEntry={(entryId) =>
                  setFinalScanCatalogEntries((current) =>
                    current.map((entry) =>
                      entry.id === entryId
                        ? {
                            ...entry,
                            selected: !entry.selected,
                          }
                        : entry,
                    ),
                  )
                }
              />
            ) : shouldShowFinalAbilitySpec ? (
              <FinalAbilitySpecDisclosure
                onContinue={() => setIsFinalAbilitySpecSeen(true)}
              />
            ) : (
              <OpponentSelector
                focusedGameType={focusedGameTypes[0] ?? null}
                focusedGameTypes={focusedGameTypes}
                focusedRobot={focusedRobot}
                hand={hand}
                isStageClear={isStageClear}
                canFocusNext={canFocusNext}
                canFocusPrevious={canFocusPrevious}
                onFocusRobot={focusRobot}
                onOpenModal={(robot, kind, gameType) =>
                  setModal({ gameType, kind, robot })
                }
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
                <>
                  {postBattleLine ? (
                    <div className="mt-3 rounded border border-sky-300/40 bg-sky-950/30 p-3 text-sm font-black leading-6 text-sky-50">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-sky-200">
                        Player
                      </p>
                      <p className="mt-1">{postBattleLine}</p>
                    </div>
                  ) : null}
                  <p className="mt-3 text-sm leading-6 text-stone-300">
                    {isStageClear
                      ? "ステージクリアです。次のStageへ進めます。"
                      : "矢印で対戦相手を選び、未対戦のロボットを選択してください。謎や正式な勝敗判定は後から差し替えできます。"}
                  </p>
                  {isStageClear && nextStage ? (
                    <button
                      className="mt-3 min-h-12 w-full rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
                      onClick={() => goToStage(nextStage.id)}
                      type="button"
                    >
                      {nextStage.label} Stageへ進む
                    </button>
                  ) : null}
                </>
              )}
            </section>

            <section className="rounded border border-white/12 bg-black/30 p-3 sm:p-4">
              <h2 className="text-base font-bold sm:text-lg">共通ルール</h2>
              {stage.id === 4 && isFinalAbilitySpecSeen ? (
                <FinalAbilitySpecTable compact />
              ) : (
                <p className="mt-3 text-sm leading-6 text-stone-300">ダミー</p>
              )}
            </section>
          </aside>
        </div>
      </section>

      {modal ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-3 sm:place-items-center sm:p-4"
          onClick={() => {
            window.dispatchEvent(new Event("casino-rule-modal-closed"));
            setModal(null);
          }}
        >
          <section
            className="max-h-[86vh] w-full overflow-auto rounded border border-white/14 bg-stone-950 p-4 shadow-2xl sm:max-w-lg sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-brass">
                  {modal.kind === "rules" ? "ゲームルール" : "ロボット仕様"}
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {getGameLabel(modal.gameType)}
                </h2>
              </div>
              <button
                aria-label="閉じる"
                className="grid h-10 w-10 shrink-0 animate-pulse place-items-center rounded border border-brass bg-brass/15 hover:bg-white/14"
                onClick={() => {
                  window.dispatchEvent(new Event("casino-rule-modal-closed"));
                  setModal(null);
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  window.dispatchEvent(new Event("casino-rule-modal-closed"));
                  setModal(null);
                }}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-5 min-h-28 rounded border border-white/10 bg-white/6 p-4 leading-7 text-stone-200">
              {modal.gameType === "blackjack" && modal.kind === "rules" ? (
                <HighlightedBlackjackRuleText />
              ) : modal.gameType === "high-low" && modal.kind === "rules" ? (
                <HighlightedHighLowRuleText />
              ) : modal.gameType === "poker" && modal.kind === "rules" ? (
                <PokerRuleContent
                  ruleText={getModalText(modal)}
                  showRobotWinRate={modal.robot.id === "poker-3-3"}
                />
              ) : modal.gameType === "poker" && modal.kind === "spec" ? (
                <PokerRobotSpecContent
                  specText={getModalText(modal)}
                  showBettingSpec={modal.robot.id === "poker-3-3"}
                />
              ) : (
                getModalText(modal)
              )}
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function FinalScanCatalogBuilder({
  entries,
  onComplete,
  onMarkGenerated,
  onToggleEntry,
}: {
  entries: ScanCatalogEntry[];
  onComplete: () => void;
  onMarkGenerated: (entryId: string) => void;
  onToggleEntry: (entryId: string) => void;
}) {
  const [illustrationName, setIllustrationName] = useState("");
  const [answer, setAnswer] = useState("");
  const [ability, setAbility] = useState<ScanAbility>("なし");
  const [generatedNumber, setGeneratedNumber] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [generatedPreviewSrc, setGeneratedPreviewSrc] = useState<string | null>(
    null,
  );
  const [finalCopyPasteStep, setFinalCopyPasteStep] = useState<
    "source" | "target" | null
  >(null);
  const [isFinalCopySourceSelected, setIsFinalCopySourceSelected] =
    useState(false);
  const [isFinalCopyTargetSelected, setIsFinalCopyTargetSelected] =
    useState(false);
  const isFinalCopyPasteApplied =
    isFinalCopySourceSelected && isFinalCopyTargetSelected;
  const pendingCount = entries.filter((entry) => !entry.generated).length;
  const allEntriesGenerated = pendingCount === 0;
  const canAddEntry =
    illustrationName.trim().length > 0 &&
    answer.trim().length > 0 &&
    generatedNumber.trim().length > 0;

  function resolveEntry() {
    if (!canAddEntry) {
      return;
    }

    const normalizedAnswer = answer.trim();
    const normalizedIllustrationName =
      normalizeScanIllustrationName(illustrationName);
    const normalizedGeneratedNumber = generatedNumber.trim();
    const matchedEntry = entries.find(
      (entry) =>
        !entry.generated &&
        entry.answer === normalizedAnswer &&
        normalizeScanIllustrationName(entry.illustrationName) ===
          normalizedIllustrationName &&
        entry.ability === ability &&
        entry.generatedNumber === normalizedGeneratedNumber,
    );

    if (matchedEntry) {
      if (matchedEntry.ability === "コピーペースト" && !isFinalCopyPasteApplied) {
        setGeneratedPreviewSrc(null);
        setScanMessage("先にコピーペーストで青字のコピー元と上書き先を選択してください。");
        return;
      }

      onMarkGenerated(matchedEntry.id);
      setGeneratedPreviewSrc(matchedEntry.targetImageSrc);
      setScanMessage("未生成の項目を生成済みにしました。");
      setIllustrationName("");
      setAnswer("");
      setAbility("なし");
      setGeneratedNumber("");
      return;
    }

        setGeneratedPreviewSrc(null);
        setScanMessage("未生成の項目と一致しません。答え、イラスト読み方、使用能力、生成した数字を確認してください。数字として読む部分はスペース区切りで入力します。");
  }

  return (
    <div className="min-h-[680px] bg-[#071b12] p-3 text-white sm:p-5">
      <div className="rounded border border-brass/50 bg-black/35 p-4 sm:p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brass">
          Final Preparation
        </p>
        <h2 className="mt-2 text-2xl font-black">スキャン生成可能一覧</h2>
        <p className="mt-3 text-sm font-bold leading-7 text-stone-100">
          ファイナルゲームの手札が公開されました。まずはスキャン一覧を完成させてから、最後の事前準備へ進みます。
          生成済みの情報はすでに埋まっています。空欄の項目は、このタイミングで答え、イラスト読み方、使用能力、生成したい数字を考えて入力します。
          イラスト読み方は、数字として読む部分をスペース区切りで空けます。
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Exchange", "自由"],
            ["Scan", "自由"],
            ["Copy Paste", "自由"],
          ].map(([label, value]) => (
            <div
              className="rounded border border-white/10 bg-white/8 p-3"
              key={label}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-300">
                {label}
              </p>
              <p className="mt-1 text-lg font-black text-brass">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
        <section className="rounded border border-white/12 bg-black/28 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                Catalog
              </p>
              <h3 className="mt-1 text-xl font-black">生成できるカード</h3>
            </div>
            <p className="rounded border border-brass/40 bg-brass/10 px-3 py-2 text-sm font-black text-brass">
              未生成 {pendingCount}件
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            {entries.map((entry, index) => (
              <button
                aria-pressed={Boolean(entry.selected)}
                className={`grid gap-3 rounded border p-3 text-left transition sm:grid-cols-[56px_126px_1fr] ${
                  entry.selected
                    ? "border-brass bg-brass/15 ring-2 ring-brass/45"
                    : !entry.generated
                      ? "border-casinoRed/70 bg-red-950/20 hover:bg-red-950/30"
                    : "border-white/10 bg-white/6 hover:bg-white/10"
                } ${index === 4 ? "mt-4" : ""}`}
                key={entry.id}
                onClick={() => onToggleEntry(entry.id)}
                type="button"
              >
                <div
                  className={`grid h-14 w-14 place-items-center rounded border text-xl font-black ${
                    entry.generated
                      ? "border-brass/55 bg-stone-50 text-stone-950"
                      : "border-casinoRed/60 bg-black/35 text-casinoRed"
                  }`}
                >
                  {entry.generated ? "〇" : ""}
                </div>
                <div className="min-h-20">
                  {entry.generated ? (
                    <ScanTargetPreview
                      alt={`${entry.illustrationName}のスキャン対象`}
                      src={entry.targetImageSrc}
                    />
                  ) : (
                    <div className="grid min-h-20 place-items-center rounded border border-dashed border-white/15 bg-black/25 px-3 text-center text-xs font-bold leading-5 text-stone-500">
                      正解後に表示
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-black/35 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-stone-300">
                      #{index + 1}
                    </span>
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-black ${
                        !entry.generated
                          ? "bg-white/10 text-stone-300"
                          : entry.ability === "コピーペースト"
                          ? "bg-casinoRed text-white"
                          : entry.ability === "エクスチェンジ"
                            ? "bg-cyan-300 text-stone-950"
                            : "bg-white/10 text-stone-200"
                      }`}
                    >
                      {entry.generated ? entry.ability : "未入力"}
                    </span>
                    {!entry.generated ? (
                      <span className="rounded bg-casinoRed px-2 py-1 text-[10px] font-black text-white">
                        入力待ち
                      </span>
                    ) : null}
                    {entry.selected ? (
                      <span className="rounded bg-brass px-2 py-1 text-[10px] font-black text-stone-950">
                        FINAL候補
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm font-bold leading-6 text-stone-100 sm:grid-cols-4">
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                        答え
                      </dt>
                      <dd>{entry.generated ? entry.answer : "未入力"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                        イラスト読み方
                      </dt>
                      <dd>{entry.generated ? entry.illustrationName : "未入力"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                        使用能力
                      </dt>
                      <dd>{entry.generated ? entry.ability : "未入力"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                        生成した（い）数字
                      </dt>
                      <dd>{entry.generated ? entry.generatedNumber : "未入力"}</dd>
                    </div>
                  </dl>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded border border-white/12 bg-black/28 p-3 sm:p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
            Scan Input
          </p>
          <h3 className="mt-1 text-xl font-black">スキャン実行</h3>
          <p className="mt-2 text-sm font-bold leading-6 text-stone-300">
            空欄の項目と一致する答え、イラスト読み方、使用能力、生成した数字を入力すると、その行が生成済みになります。
            入力例は「イチ　ゴ→6」「フォー　カード→4」「レース　クイーン→12」です。
          </p>
          <FinalCopyPasteWorkbench
            isApplied={isFinalCopyPasteApplied}
            isSourceSelected={isFinalCopySourceSelected}
            isTargetSelected={isFinalCopyTargetSelected}
            onSelectSource={() => {
              setIsFinalCopySourceSelected(true);
              setFinalCopyPasteStep("target");
            }}
            onSelectTarget={() => {
              setIsFinalCopyTargetSelected(true);
              setFinalCopyPasteStep(null);
            }}
            onStart={() => {
              setIsFinalCopySourceSelected(false);
              setIsFinalCopyTargetSelected(false);
              setFinalCopyPasteStep("source");
              setScanMessage("");
            }}
            step={finalCopyPasteStep}
          />
          <div className="mt-4 grid gap-3">
            <FinalCatalogInput
              label="答え"
              onChange={setAnswer}
              placeholder="例: すいり"
              value={answer}
            />
            <FinalCatalogInput
              label="イラスト読み方"
              onChange={setIllustrationName}
              placeholder="例: クイーン"
              value={illustrationName}
            />
            <FinalCatalogInput
              label="生成した（い）数字"
              onChange={setGeneratedNumber}
              placeholder="例: 12"
              value={generatedNumber}
            />
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-brass">
              使用能力
              <select
                className="min-h-11 rounded border border-white/14 bg-black/35 px-3 text-sm font-bold text-white outline-none focus:border-brass"
                onChange={(event) => setAbility(event.target.value as ScanAbility)}
                value={ability}
              >
                <option value="なし">なし</option>
                <option value="エクスチェンジ">エクスチェンジ</option>
                <option value="コピーペースト">コピーペースト</option>
              </select>
            </label>
            <button
              className={`min-h-12 rounded px-4 py-3 text-sm font-black ${
                canAddEntry
                  ? "bg-brass text-stone-950 hover:bg-yellow-300"
                  : "cursor-not-allowed bg-stone-700 text-stone-400"
              }`}
              disabled={!canAddEntry}
              onClick={resolveEntry}
              type="button"
            >
              入力内容を生成済みにする
            </button>
            {scanMessage ? (
              <div className="rounded border border-white/10 bg-white/8 p-3">
                {generatedPreviewSrc ? (
                  <ScanTargetPreview
                    alt="今回スキャンした対象"
                    src={generatedPreviewSrc}
                  />
                ) : null}
                <p className="mt-3 text-sm font-bold leading-6 text-stone-100">
                  {scanMessage}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded border border-casinoRed/45 bg-red-950/20 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-100">
              Final Battle
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-stone-100">
              一覧作成が完了したら、最後の1戦へ進みます。最後の1戦では、この一覧から必要な行を選択して勝負に挑みます。
            </p>
            <button
              className={`mt-3 min-h-12 w-full rounded px-4 py-3 text-sm font-black ${
                allEntriesGenerated
                  ? "bg-casinoRed text-white hover:bg-red-500"
                  : "cursor-not-allowed bg-stone-700 text-stone-400"
              }`}
              disabled={!allEntriesGenerated}
              onClick={onComplete}
              type="button"
            >
              {allEntriesGenerated
                ? "一覧作成を完了して最後の1戦へ"
                : "未生成項目をすべて埋めてください"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function FinalDisclosure({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="min-h-[680px] bg-[#071b12] p-3 text-white sm:p-5">
      <section className="grid min-h-[640px] place-items-center rounded border border-brass/50 bg-black/45 p-4 shadow-[inset_0_0_80px_rgba(0,0,0,0.45)]">
        <div className="w-full max-w-2xl rounded border border-white/12 bg-stone-950/92 p-5 shadow-2xl sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brass">
            Final Disclosure
          </p>
          <h2 className="mt-2 text-2xl font-black">ファイナルゲームの手札公開</h2>
          <p className="mt-3 text-sm font-bold leading-7 text-stone-100">
            最後の1戦で使われる手札とフィールドが開示されました。このまま事前準備へ入る前に、まずはスキャン一覧を完成させる必要があります。
          </p>
          <div className="mt-5 grid gap-3">
            {finalBattleDisclosureSections.map((section) => (
              <FinalDisclosureCardSection
                cards={section.cards}
                key={section.id}
                label={section.label}
              />
            ))}
          </div>
          <h3 className="mt-5 text-lg font-black">最後の情報開示</h3>
          <div className="mt-5 grid gap-3 text-sm font-bold leading-7 text-stone-100">
            <p className="rounded border border-white/10 bg-white/6 p-3">
              ・ゲームにおける能力の発動は、
              <span className="font-black text-sky-300">ゲームスタート</span>
              が宣言されたタイミング
            </p>
            <p className="rounded border border-white/10 bg-white/6 p-3">
              ・このゲームに登場する車の車種は必ずハイエースを用いる
            </p>
          </div>
          <button
            className="mt-5 min-h-12 w-full rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
            onClick={onContinue}
            type="button"
          >
            スキャン一覧を作成する
          </button>
        </div>
      </section>
    </div>
  );
}

function FinalDisclosureCardSection({
  cards,
  label,
}: {
  cards: PlayingCard[];
  label: string;
}) {
  return (
    <section className="rounded border border-white/10 bg-white/6 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brass">
        {label}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {cards.map((card) => (
          <PlayingCardView card={card} key={card.id} size="hand" />
        ))}
      </div>
    </section>
  );
}

function FinalAbilitySpecDisclosure({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <div className="min-h-[680px] bg-[#071b12] p-3 text-white sm:p-5">
      <section className="grid min-h-[640px] place-items-center rounded border border-brass/50 bg-black/45 p-4 shadow-[inset_0_0_80px_rgba(0,0,0,0.45)]">
        <div className="w-full max-w-2xl rounded border border-white/12 bg-stone-950/92 p-5 shadow-2xl sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brass">
            Final Specification
          </p>
          <h2 className="mt-2 text-2xl font-black">最後の仕様公開</h2>
          <p className="mt-3 text-sm font-bold leading-7 text-stone-100">
            スキャン一覧が完成しました。最後の1戦では、各能力の発動タイミングと持続時間を確認しながら事前準備を進めます。
          </p>
          <FinalAbilitySpecTable />
          <button
            className="mt-5 min-h-12 w-full rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
            onClick={onContinue}
            type="button"
          >
            仕様を確認して最後の1戦へ
          </button>
        </div>
      </section>
    </div>
  );
}

function FinalAbilitySpecTable({ compact = false }: { compact?: boolean }) {
  const rows = [
    {
      ability: "エクスチェンジ",
      duration: "1Stage",
      timing: (
        <>
          <span className="font-black text-sky-300">ゲームスタート</span>
          宣言時
        </>
      ),
    },
    {
      ability: "スキャン",
      duration: "1ゲーム",
      timing: "即時",
    },
    {
      ability: "コピーペースト",
      duration: "1ゲーム",
      timing: "即時",
    },
  ];

  return (
    <div
      className={`mt-4 overflow-hidden rounded border border-white/12 bg-white/6 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <div className="grid grid-cols-[1.15fr_1fr_0.85fr] border-b border-white/12 bg-black/35 font-black text-brass">
        <div className="p-2 sm:p-3">能力</div>
        <div className="border-l border-white/12 p-2 sm:p-3">発動タイミング</div>
        <div className="border-l border-white/12 p-2 sm:p-3">持続時間</div>
      </div>
      {rows.map((row) => (
        <div
          className="grid grid-cols-[1.15fr_1fr_0.85fr] border-b border-white/10 last:border-b-0"
          key={row.ability}
        >
          <div className="p-2 font-black text-stone-100 sm:p-3">{row.ability}</div>
          <div className="border-l border-white/10 p-2 font-bold text-stone-200 sm:p-3">
            {row.timing}
          </div>
          <div className="border-l border-white/10 p-2 font-bold text-stone-200 sm:p-3">
            {row.duration}
          </div>
        </div>
      ))}
    </div>
  );
}

function FinalCatalogInput({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-brass">
      {label}
      <input
        className="min-h-11 rounded border border-white/14 bg-black/35 px-3 text-sm font-bold text-white outline-none focus:border-brass"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="text"
        value={value}
      />
    </label>
  );
}

function ScanTargetPreview({ alt, src }: { alt: string; src: string }) {
  return (
    <div className="overflow-hidden rounded border border-white/12 bg-white">
      <Image
        alt={alt}
        className="h-auto w-full"
        height={900}
        src={src}
        width={1600}
      />
    </div>
  );
}

function TutorialDialog({
  actionLabel,
  onDismiss,
  onAction,
  text,
  tone,
}: {
  actionLabel?: string;
  onDismiss: () => void;
  onAction?: () => void;
  text: string;
  tone: "hands" | "rules" | "spec" | "start";
}) {
  const toneClass = {
    hands: "border-cyan-300 bg-cyan-950/92 text-cyan-50",
    rules: "border-sky-400 bg-sky-50 text-stone-950",
    spec: "border-emerald-400 bg-emerald-50 text-stone-950",
    start: "border-casinoRed bg-red-50 text-stone-950",
  }[tone];

  return (
    <div
      className="fixed inset-0 z-40 grid cursor-default place-items-center bg-black/45 p-4 text-left backdrop-blur-[2px]"
      onClick={onDismiss}
      onPointerDown={onDismiss}
    >
      <div
        className={`w-full max-w-2xl rounded border-2 px-5 py-5 text-base font-black leading-7 shadow-2xl sm:px-7 sm:py-6 sm:text-lg ${toneClass}`}
        onClick={actionLabel ? undefined : onDismiss}
        onPointerDown={actionLabel ? undefined : onDismiss}
      >
        <p>{text}</p>
        {actionLabel && onAction ? (
          <button
            className="mt-3 min-h-10 w-full rounded bg-white px-4 text-sm font-black text-stone-950 hover:bg-stone-100"
            onClick={(event) => {
              event.stopPropagation();
              onAction();
              onDismiss();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            type="button"
          >
            {actionLabel}
          </button>
        ) : (
          <button
            className="mt-3 min-h-10 w-full rounded bg-white px-4 text-sm font-black text-stone-950 hover:bg-stone-100"
            onClick={onDismiss}
            onPointerDown={(event) => {
              event.stopPropagation();
              onDismiss();
            }}
            type="button"
          >
            閉じる
          </button>
        )}
      </div>
    </div>
  );
}

function OpponentSelector({
  canFocusNext,
  canFocusPrevious,
  focusedGameType,
  focusedGameTypes,
  focusedRobot,
  hand,
  isStageClear,
  onFocusRobot,
  onOpenModal,
  onSelectRobot,
  playedRobotIds,
}: {
  canFocusNext: boolean;
  canFocusPrevious: boolean;
  focusedGameType: GameType | null;
  focusedGameTypes: GameType[];
  focusedRobot: Robot | null;
  hand: PlayingCard[];
  isStageClear: boolean;
  onFocusRobot: (offset: number) => void;
  onOpenModal: (robot: Robot, kind: ModalKind, gameType: GameType) => void;
  onSelectRobot: (robot: Robot, gameType: GameType) => void;
  playedRobotIds: string[];
}) {
  const [isAutoSelecting, setIsAutoSelecting] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<
    "rules" | "rules-close" | "spec" | "spec-close" | "hands" | "start" | "done"
  >("rules");
  const [isTutorialDialogVisible, setIsTutorialDialogVisible] = useState(true);
  const currentSeat = focusedGameType ? getGameSeat(focusedGameType) : "top";
  const currentImage = viewImage[currentSeat];
  const isFocusedPlayed = focusedRobot
    ? playedRobotIds.includes(focusedRobot.id)
    : false;
  const focusedHighLowConfig =
    focusedRobot?.id && focusedRobot.id in highLowBattleConfigs
      ? highLowBattleConfigs[
          focusedRobot.id as keyof typeof highLowBattleConfigs
        ]
      : null;
  const focusedBlackjackConfig =
    focusedRobot?.id && focusedRobot.id in blackjackBattleConfigs
      ? blackjackBattleConfigs[
          focusedRobot.id as keyof typeof blackjackBattleConfigs
        ]
      : null;
  const previewPlayerHand = focusedHighLowConfig
    ? getCardsById([...focusedHighLowConfig.initialPlayerHandIds])
    : focusedBlackjackConfig
      ? getCardsById([...focusedBlackjackConfig.initialPlayerHandIds])
    : hand;
  const previewRobotHand = focusedHighLowConfig
    ? getCardsById([...focusedHighLowConfig.initialRobotHandIds])
    : focusedBlackjackConfig
      ? getCardsById([...focusedBlackjackConfig.initialRobotHandIds])
    : hand.slice().reverse();
  const shouldShowFieldCards = focusedGameType === "poker";

  useEffect(() => {
    if (!isAutoSelecting || !focusedRobot || !focusedGameType) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsAutoSelecting(false);
      onSelectRobot(focusedRobot, focusedGameType);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [focusedGameType, focusedRobot, isAutoSelecting, onSelectRobot]);

  useEffect(() => {
    function handleModalClosed() {
      setTutorialStep((current) => {
        if (current === "rules-close") {
          setIsTutorialDialogVisible(true);
          return "spec";
        }

        if (current === "spec-close") {
          setIsTutorialDialogVisible(true);
          return "hands";
        }

        return current;
      });
    }

    window.addEventListener("casino-rule-modal-closed", handleModalClosed);

    return () => {
      window.removeEventListener("casino-rule-modal-closed", handleModalClosed);
    };
  }, []);

  function advanceTutorial(nextStep: typeof tutorialStep) {
    setTutorialStep(nextStep);
    setIsTutorialDialogVisible(true);
  }

  return (
    <div className="relative bg-black">
      {isTutorialDialogVisible && tutorialStep === "rules" ? (
        <TutorialDialog
          onDismiss={() => setIsTutorialDialogVisible(false)}
          text="まずゲームのルールを確認します。青く光っている本のボタンを押してください。"
          tone="rules"
        />
      ) : isTutorialDialogVisible && tutorialStep === "rules-close" ? (
        <TutorialDialog
          onDismiss={() => setIsTutorialDialogVisible(false)}
          text="ゲームルールを確認したら、右上の×ボタンで閉じてください。"
          tone="rules"
        />
      ) : isTutorialDialogVisible && tutorialStep === "spec" ? (
        <TutorialDialog
          onDismiss={() => setIsTutorialDialogVisible(false)}
          text="次にロボットの仕様を確認します。緑に光っている情報ボタンを押してください。"
          tone="spec"
        />
      ) : isTutorialDialogVisible && tutorialStep === "spec-close" ? (
        <TutorialDialog
          onDismiss={() => setIsTutorialDialogVisible(false)}
          text="ロボットの仕様を確認したら、右上の×ボタンで閉じてください。"
          tone="spec"
        />
      ) : isTutorialDialogVisible && tutorialStep === "hands" ? (
        <TutorialDialog
          actionLabel="手札を確認する"
          onAction={() => advanceTutorial("start")}
          onDismiss={() => setIsTutorialDialogVisible(false)}
          text="ゲームスタート前に、あなたの手札とロボットの手札を確認できます。確認できたら「ゲームスタート」してみましょう"
          tone="hands"
        />
      ) : isTutorialDialogVisible && tutorialStep === "start" ? (
        <TutorialDialog
          onDismiss={() => setIsTutorialDialogVisible(false)}
          text="確認できました。ゲームスタートを押して対戦を始めます。"
          tone="start"
        />
      ) : null}
      <div className="relative aspect-[1402/1124] min-h-[330px] overflow-visible max-[424px]:min-h-[270px] max-[374px]:min-h-[240px] max-[340px]:min-h-[220px] sm:min-h-[560px]">
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

            <div className="absolute inset-x-3 bottom-0 z-20 translate-y-[78%] rounded border border-stone-200 bg-white p-3 text-stone-950 shadow-[0_12px_28px_rgba(0,0,0,0.45)] max-[424px]:inset-x-1.5 max-[424px]:p-2 max-[374px]:inset-x-0 sm:inset-x-6 sm:p-4">
              <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 max-[424px]:grid-cols-[38px_minmax(0,1fr)_38px] max-[424px]:gap-1.5 max-[374px]:grid-cols-[34px_minmax(0,1fr)_34px]">
                <button
                  aria-label="前のゲーム種類"
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded border border-stone-300 max-[424px]:h-[38px] max-[424px]:w-[38px] max-[374px]:h-[34px] max-[374px]:w-[34px] ${
                    canFocusPrevious
                      ? "bg-stone-100 text-stone-950 hover:bg-stone-200"
                      : "cursor-not-allowed bg-stone-200 text-stone-400 opacity-45"
                  }`}
                  disabled={!canFocusPrevious}
                  onClick={() => onFocusRobot(-1)}
                  type="button"
                >
                  <ChevronLeft size={22} />
                </button>

                <div className="flex min-h-36 min-w-0 flex-col items-center justify-center gap-2 text-center max-[424px]:min-h-28 max-[424px]:gap-1.5 max-[374px]:min-h-24 sm:min-h-56">
                  {focusedGameType ? <GameLogo gameType={focusedGameType} /> : null}
                  {focusedGameTypes.length > 1 ? (
                    <div className="flex flex-wrap justify-center gap-1">
                      {focusedGameTypes.map((gameType, index) => (
                        <span
                          className="rounded border border-stone-300 bg-stone-100 px-2 py-1 text-[10px] font-black text-stone-700"
                          key={gameType}
                        >
                          {index + 1}. {getGameLabel(gameType)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  aria-label="次のゲーム種類"
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded border border-stone-300 max-[424px]:h-[38px] max-[424px]:w-[38px] max-[374px]:h-[34px] max-[374px]:w-[34px] ${
                    canFocusNext
                      ? "bg-stone-100 text-stone-950 hover:bg-stone-200"
                      : "cursor-not-allowed bg-stone-200 text-stone-400 opacity-45"
                  }`}
                  disabled={!canFocusNext}
                  onClick={() => onFocusRobot(1)}
                  type="button"
                >
                  <ChevronRight size={22} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-[44px_44px_minmax(0,1fr)] gap-2 max-[424px]:mt-2 max-[424px]:grid-cols-[38px_38px_minmax(0,1fr)] max-[424px]:gap-1.5 max-[374px]:grid-cols-[34px_34px_minmax(0,1fr)]">
                <button
                  aria-label={`${focusedRobot.name}のルール`}
                  className={`grid h-11 place-items-center rounded border text-stone-950 max-[424px]:h-[38px] max-[374px]:h-[34px] ${
                    tutorialStep === "rules"
                      ? "animate-pulse border-2 border-sky-500 bg-sky-50 shadow-[0_0_0_4px_rgba(14,165,233,0.24)]"
                      : "border-stone-300 bg-stone-100 hover:bg-stone-200"
                  }`}
                  onClick={() => {
                    if (tutorialStep === "rules") {
                      setTutorialStep("rules-close");
                      setIsTutorialDialogVisible(false);
                    }
                    onOpenModal(
                      focusedRobot,
                      "rules",
                      focusedGameType ?? focusedRobot.gameType,
                    );
                  }}
                  onPointerDown={() => {
                    if (tutorialStep === "rules") {
                      setTutorialStep("rules-close");
                      setIsTutorialDialogVisible(false);
                    }
                    onOpenModal(
                      focusedRobot,
                      "rules",
                      focusedGameType ?? focusedRobot.gameType,
                    );
                  }}
                  title="ルール"
                  type="button"
                >
                  <BookOpen size={18} />
                </button>
                <button
                  aria-label={`${focusedRobot.name}の仕様`}
                  className={`grid h-11 place-items-center rounded border text-stone-950 max-[424px]:h-[38px] max-[374px]:h-[34px] ${
                    tutorialStep === "spec"
                      ? "animate-pulse border-2 border-emerald-500 bg-emerald-50 shadow-[0_0_0_4px_rgba(16,185,129,0.24)]"
                      : "border-stone-300 bg-stone-100 hover:bg-stone-200"
                  }`}
                  onClick={() => {
                    if (tutorialStep === "spec") {
                      setTutorialStep("spec-close");
                      setIsTutorialDialogVisible(false);
                    }
                    onOpenModal(
                      focusedRobot,
                      "spec",
                      focusedGameType ?? focusedRobot.gameType,
                    );
                  }}
                  onPointerDown={() => {
                    if (tutorialStep === "spec") {
                      setTutorialStep("spec-close");
                      setIsTutorialDialogVisible(false);
                    }
                    onOpenModal(
                      focusedRobot,
                      "spec",
                      focusedGameType ?? focusedRobot.gameType,
                    );
                  }}
                  title="仕様"
                  type="button"
                >
                  <Info size={18} />
                </button>
                {isFocusedPlayed || isStageClear || !focusedGameType ? (
                  <button
                    className="h-11 cursor-not-allowed rounded bg-stone-700 px-3 text-sm font-bold text-stone-400 max-[424px]:h-[38px] max-[424px]:px-2 max-[424px]:text-xs max-[374px]:h-[34px]"
                    disabled
                    type="button"
                  >
                    {isFocusedPlayed ? "対戦済み" : "対戦"}
                  </button>
                ) : (
                  <button
                    className={`grid h-11 place-items-center rounded px-3 text-sm font-bold text-white max-[424px]:h-[38px] max-[424px]:px-2 max-[424px]:text-xs max-[374px]:h-[34px] ${
                      tutorialStep === "start"
                        ? "animate-pulse bg-casinoRed shadow-[0_0_0_4px_rgba(180,31,44,0.26)] hover:bg-red-700"
                        : "bg-casinoRed hover:bg-red-700"
                    }`}
                    onClick={() => {
                      setTutorialStep("done");
                      setIsAutoSelecting(true);
                    }}
                    type="button"
                  >
                    ゲームスタート
                  </button>
                )}
              </div>
            </div>
          </>
        ) : null}

        {isAutoSelecting && focusedRobot && focusedGameType ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/72 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded border border-brass bg-white p-4 text-center text-stone-950 shadow-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-casinoRed">
                Battle Select
              </p>
              <p className="mt-2 text-lg font-black">
                {getGameLabel(focusedGameType)} を開始します
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {focusedGameTypes.map((gameType, index) => (
                  <div
                    className={`rounded border px-3 py-2 text-xs font-black ${
                      index === 0
                        ? "border-casinoRed bg-casinoRed text-white"
                        : "border-stone-300 bg-stone-100 text-stone-500"
                    }`}
                    key={gameType}
                  >
                    {index + 1}. {getGameLabel(gameType)}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm font-bold leading-6 text-stone-700">
                登場した種目順に自動で選ばれます。
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-brass/25 bg-black/72 px-3 pb-4 pt-48 text-center backdrop-blur-sm sm:px-6 sm:pt-72">
        <div
          className={`mx-auto max-w-2xl rounded p-3 ${
            tutorialStep === "hands"
              ? "animate-pulse border-2 border-cyan-300 bg-cyan-950/20 shadow-[0_0_0_4px_rgba(103,232,249,0.14)]"
              : "border border-white/10 bg-black/20"
          }`}
        >
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
    </div>
  );
}

type BlackjackPhase =
  | "idle"
  | "first-card"
  | "second-card"
  | "result";

function BlackjackBattle({
  backHref,
  hand,
  onBack,
  robotId,
}: {
  backHref: string;
  hand: PlayingCard[];
  onBack: () => void;
  robotId: string;
}) {
  const config =
    robotId in blackjackBattleConfigs
      ? blackjackBattleConfigs[robotId as keyof typeof blackjackBattleConfigs]
      : null;
  const canExchangePlayerHand =
    robotId === "blackjack-2-1";
  const canUseScan = robotId === "blackjack-2-2";
  const isFinalBattle = robotId === "all-games-last";
  const [isPlayerHandExchanged, setIsPlayerHandExchanged] = useState(false);
  const [preparationAbility, setPreparationAbility] =
    useState<PreparationAbility>("exchange");
  const [scannedItems, setScannedItems] = useState<string[]>([]);
  const [scanTutorialAnswer, setScanTutorialAnswer] = useState("");
  const [isScanTutorialAnswerSolved, setIsScanTutorialAnswerSolved] =
    useState(false);
  const [scanTutorialIllustrationName, setScanTutorialIllustrationName] =
    useState("");
  const [scanTutorialSplit, setScanTutorialSplit] = useState("");
  const [isScanTutorialComplete, setIsScanTutorialComplete] = useState(false);
  const [scanTutorialMessage, setScanTutorialMessage] = useState("");
  const [scanAnswer, setScanAnswer] = useState("");
  const [scanIllustrationName, setScanIllustrationName] = useState("");
  const [scanGeneratedPreviewSrc, setScanGeneratedPreviewSrc] = useState<
    string | null
  >(null);
  const [isScanCardExchanged, setIsScanCardExchanged] = useState(false);
  const [selectedRiddlePrintIds, setSelectedRiddlePrintIds] = useState<string[]>(
    [],
  );
  const scannedOneCard = generatedScanCards["scan-10"];
  const isScanCardGenerated = scannedItems.includes(scannedOneCard.id);
  const canGenerateScanCard =
    isScanTutorialComplete &&
    scanAnswer.trim().length > 0 &&
    scanIllustrationName.trim().length > 0;
  const canSelectRiddlePrints = robotId === "blackjack-high-low-2-3";
  const configuredExchange =
    config &&
    isPlayerHandExchanged &&
    "exchangePlayerCardId" in config &&
    "exchangeRobotCardId" in config
      ? {
          playerCardId: config.exchangePlayerCardId,
          robotCardId: config.exchangeRobotCardId,
        }
      : null;
  const playerHandIds =
    config && isScanCardExchanged && canUseScan
      ? ["A-heart", scannedOneCard.id]
      : config && configuredExchange
        ? [...config.initialPlayerHandIds].map((cardId) =>
            cardId === configuredExchange.playerCardId
              ? configuredExchange.robotCardId
              : cardId,
          )
      : config
        ? [...config.initialPlayerHandIds]
        : [];
  const playerHand = config
    ? getCardsById(playerHandIds, generatedScanCards)
    : hand;
  const robotHandIds =
    config && isScanCardExchanged && canUseScan
      ? [...config.initialRobotHandIds]
      : config && configuredExchange
        ? [...config.initialRobotHandIds].map((cardId) =>
            cardId === configuredExchange.robotCardId
              ? configuredExchange.playerCardId
              : cardId,
          )
      : config
        ? [...config.initialRobotHandIds]
        : [];
  const robotHand = config
    ? getCardsById(robotHandIds, generatedScanCards)
    : hand.slice().reverse();
  const highLowRobotHand =
    config && "highLowRobotHandIds" in config
      ? getCardsById([...config.highLowRobotHandIds], generatedScanCards)
      : [];
  const [phase, setPhase] = useState<BlackjackPhase>("idle");
  const [settledResult, setSettledResult] = useState<Outcome | null>(null);
  const [message, setMessage] = useState("全ての対戦に勝利しましょう。");
  const [placementStyle, setPlacementStyle] =
    useState<PlacementStyle>("gentle");
  const [placementAnimation, setPlacementAnimation] =
    useState<PlacementStyle | null>(null);
  const [showBlackjackDeclaration, setShowBlackjackDeclaration] =
    useState(false);
  const [isFinalPreparationApplied, setIsFinalPreparationApplied] =
    useState(false);
  const playerFirstCard = playerHand[0] ?? null;
  const robotFirstCard = robotHand[0] ?? null;
  const playerScore = getBlackjackScore(playerHand);
  const robotScore = getBlackjackScore(robotHand);
  const playerHasBlackjack = playerScore === 21;
  const highLowChainResult =
    isFinalBattle
      ? "win"
      : robotId === "blackjack-2-2" && isScanCardExchanged
      ? "win"
      : highLowRobotHand.length > 0 && highLowRobotHand[0] && playerHand[0]
      ? getHighLowResult(highLowRobotHand[0], playerHand[0])
      : null;
  const robotAction = isFinalBattle
    ? "call"
    : getBlackjackRobotAction(playerFirstCard, robotFirstCard);
  const learningRestriction =
    config && "learningRestriction" in config ? config.learningRestriction : null;
  const disabledExchangeTargets: ExchangeTargetId[] = [
    ...(robotId === "blackjack-high-low-2-3"
      ? (["player-hand", "robot-hand"] as const)
      : []),
  ];
  const result =
    phase === "result"
      ? settledResult ?? getBlackjackResult(playerHand, robotHand)
      : null;
  const resultDisabledExchangeTargets: ExchangeTargetId[] = [
    ...(result === "win" && robotId === "blackjack-2-2"
      ? (["player-hand", "robot-hand"] as const)
      : []),
  ];
  const resultExchangeRankRestrictions =
    result === "win" && robotId === "blackjack-2-2"
      ? ["エースはエクスチェンジ不可"]
      : [];
  const robotFolded =
    phase === "result" && settledResult === "win" && robotAction === "fold";

  function startRound() {
    if (!playerFirstCard || !robotFirstCard) {
      setMessage("手札が足りません。");
      return;
    }

    if (isFinalBattle && !isFinalPreparationApplied) {
      setMessage("先にファイナルゲーム用の事前準備を完了してください。");
      return;
    }

    setSettledResult(null);

    if (robotAction === "fold") {
      setMessage("ロボットはフォールドしました。プレイヤーの勝利です。");
      setSettledResult("win");
      setPhase("result");
      return;
    }

    setMessage("ロボットはコールしました。2枚目を出して勝負します。");
    setPhase("first-card");
  }

  function revealSecondCard() {
    const blackjackOutcome = getBlackjackResult(playerHand, robotHand);
    const outcome =
      blackjackOutcome === "win" &&
      (highLowChainResult === null || highLowChainResult === "win")
        ? "win"
        : "lose";
    setSettledResult(outcome);
    setMessage(
      outcome === "win"
        ? highLowChainResult
          ? "YOU WIN。ブラックジャックとハイアンドローの両方に勝利しました。"
          : "YOU WIN。勝利条件を満たしました。"
        : blackjackOutcome === "draw"
          ? "引き分けのため、あなたの負けです。"
          : highLowChainResult === "lose"
            ? "YOU LOSE。ハイアンドローの条件を満たせませんでした。"
            : "YOU LOSE。ロボットの勝利です。",
    );
    setPhase("result");
  }

  function placeSecondCard() {
    setPhase("second-card");
    setPlacementAnimation(placementStyle);
    if (playerHasBlackjack) {
      setShowBlackjackDeclaration(true);
    }
    window.setTimeout(() => {
      setPlacementAnimation(null);
      revealSecondCard();
    }, playerHasBlackjack ? 1180 : 760);
    if (playerHasBlackjack) {
      window.setTimeout(() => {
        setShowBlackjackDeclaration(false);
      }, 1500);
    }
  }

  function resetRound() {
    setPhase("idle");
    setSettledResult(null);
    setPlacementAnimation(null);
    setShowBlackjackDeclaration(false);
    setMessage("全ての対戦に勝利しましょう。");
  }

  function solveScanTutorialRiddle() {
    if (scanTutorialAnswer.trim() !== "りすく") {
      setScanTutorialMessage("答えが違うようです。小謎をもう一度確認してください。");
      return;
    }

    setIsScanTutorialAnswerSolved(true);
    setScanTutorialMessage(
      "正解です。次に、この小謎内のイラストを対象にスキャンしてみましょう。",
    );
  }

  function runScanTutorial() {
    const normalizedSplit = normalizeScanIllustrationName(scanTutorialSplit);

    if (
      scanTutorialIllustrationName.trim() !== "すごろく" ||
      normalizedSplit !== "す ご ろく"
    ) {
      setScanTutorialMessage(
        "スキャン対象のイラスト名と文字の区切り方を確認してください。",
      );
      return;
    }

    setIsScanTutorialComplete(true);
    setScanTutorialMessage(
      "スキャン成功。すごろくを「す　ご　ろく」に区切ると、5 + 6 = 11。11のトランプを生成できます。",
    );
  }

  function generateScanCard() {
    setScannedItems((current) =>
      current.includes(scannedOneCard.id)
        ? current
        : [...current, scannedOneCard.id],
    );
    setScanGeneratedPreviewSrc(scanTargetImages.jyuusho);
    setScanTutorialMessage(
      "スキャン対象: じゅうしょ。ななめの答えから10のトランプを生成しました。",
    );
  }

  return (
    <div className="min-h-[620px] bg-[#071b12] text-white">
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/28 p-4">
        <a
          aria-label="戻る"
          className="grid h-12 w-12 shrink-0 place-items-center rounded border border-white/30 bg-black/30 hover:bg-white/10"
          href={backHref}
          onClick={(event) => {
            event.preventDefault();
            onBack();
          }}
        >
          <ArrowLeft size={18} />
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <GameLogo gameType="blackjack" compact />
          {highLowRobotHand.length > 0 ? (
            <GameLogo gameType="high-low" compact />
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_220px]">
        <section className="rounded border border-white/12 bg-black/28 p-3">
          <div className="grid gap-3">
            <BlackjackField
              cards={robotHand}
              isBlackjack={robotScore === 21}
              label="ROBOT FIELD"
              revealSecond={phase === "result" && !robotFolded}
              score={phase === "result" && !robotFolded ? robotScore : null}
            />
            <BlackjackField
              cards={playerHand}
              isBlackjack={playerHasBlackjack}
              label="PLAYER FIELD"
              placementAnimation={placementAnimation}
              revealSecond={phase === "second-card" || phase === "result"}
              score={phase === "second-card" || phase === "result" ? playerScore : null}
            />
            {showBlackjackDeclaration ? (
              <BlackjackDeclarationOverlay />
            ) : null}
            {highLowRobotHand.length > 0 ? (
              <BlackjackField
                cards={highLowRobotHand}
                isBlackjack={false}
                label="HIGH AND LOW ROBOT HAND"
                revealSecond
                score={null}
              />
            ) : null}
          </div>

          <div className="mt-4 rounded border border-brass/60 bg-black/50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              Table Message
            </p>
            <p className="mt-2 min-h-12 text-sm font-bold leading-6 text-stone-100">
              {message}
            </p>
            {result ? (
              <div className="mt-2">
                <p className="text-2xl font-black text-brass">
                  {result === "win" ? "YOU WIN" : "YOU LOSE"}
                </p>
                {result === "win" && learningRestriction ? (
                  <>
                    <p className="mt-2 rounded border border-casinoRed/60 bg-casinoRed/15 p-3 text-sm font-bold leading-6 text-red-100">
                      {learningRestriction}
                    </p>
                    <ExchangeRuleList
                      disabledTargets={resultDisabledExchangeTargets}
                      rankRestrictions={resultExchangeRankRestrictions}
                      showVisiblePrintTarget={
                        result === "win" && robotId === "blackjack-2-2"
                      }
                      visiblePrintRemaining={
                        result === "win" && robotId === "blackjack-2-2"
                          ? 1
                          : undefined
                      }
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded border border-white/12 bg-black/28 p-3">
          <div className="rounded border border-white/10 bg-white/6 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              Robot Logic
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-200">
              {blackjackSpecText}
            </p>
          </div>

          {phase === "idle" && canExchangePlayerHand ? (
            <div className="rounded border border-brass/50 bg-brass/10 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                Exchange
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-100">
                ブラックジャックのロボットのJと自分のAをエクスチェンジすれば勝てます。
              </p>
              <ExchangeRuleList />
              <button
                className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
                  isPlayerHandExchanged
                    ? "bg-emerald-500 text-stone-950"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
                onClick={() => setIsPlayerHandExchanged((current) => !current)}
                type="button"
              >
                BJロボットのJと自分のAをエクスチェンジ
              </button>
            </div>
          ) : null}

          {phase === "idle" && canUseScan ? (
            <div className="rounded border border-brass/50 bg-brass/10 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                Preparation
              </p>
              <p className="mt-2 rounded border border-white/12 bg-black/35 p-3 text-sm font-bold leading-6 text-stone-100">
                自分とハイアンドロー・ブラックジャックのロボットの手札が開示されました。
                このままでは勝てないので、追加で能力を使えるようにします。
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["exchange", "scan"] as const).map((ability) => (
                  <button
                    className={`min-h-10 rounded px-3 py-2 text-sm font-black ${
                      preparationAbility === ability
                        ? "bg-brass text-stone-950"
                        : "bg-white/10 text-white hover:bg-white/15"
                    }`}
                    key={ability}
                    onClick={() => setPreparationAbility(ability)}
                    type="button"
                  >
                    {ability === "exchange" ? "エクスチェンジ" : "スキャン"}
                  </button>
                ))}
              </div>

              {preparationAbility === "exchange" ? (
                <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
                  <p className="text-sm leading-6 text-stone-100">
                    生成したカードはエクスチェンジの候補に追加されます。
                    生成した10と自分のAを交換してから勝負を始めます。
                  </p>
                  <ExchangeRuleList disabledTargets={disabledExchangeTargets} />
                  <div className="mt-3 rounded border border-white/12 bg-white/8 p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                      Scan Generated Card
                    </p>
                    <div className="mt-3 flex min-h-28 items-center justify-center rounded border border-dashed border-white/20 bg-black/25 p-3">
                      {isScanCardGenerated ? (
                        <PlayingCardView card={scannedOneCard} size="hand" />
                      ) : (
                        <p className="text-center text-sm font-bold leading-6 text-stone-400">
                          まだ生成されていません。スキャンでカードを生成すると、
                          ここに候補として追加されます。
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
                      isScanCardExchanged
                        ? "bg-emerald-500 text-stone-950"
                        : isScanCardGenerated
                          ? "bg-brass text-stone-950 hover:bg-yellow-300"
                          : "cursor-not-allowed bg-stone-700 text-stone-400"
                    }`}
                    disabled={!isScanCardGenerated}
                    onClick={() => setIsScanCardExchanged(true)}
                    type="button"
                  >
                    生成した10と自分のAをエクスチェンジ
                  </button>
                </div>
              ) : (
                <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
                  {!isScanTutorialAnswerSolved ? (
                    <>
                      <p className="text-sm font-bold leading-6 text-stone-100">
                        スキャン機能を使う前に、まずはこの小謎を普通に解いてください。
                      </p>
                      <div className="mt-3 overflow-hidden rounded border border-white/12 bg-white">
                        <Image
                          alt="スキャン機能チュートリアル小謎"
                          className="h-auto w-full"
                          height={900}
                          src="/riddles/riddle_0.png"
                          width={1600}
                        />
                      </div>
                      <label className="mt-3 grid gap-2 text-sm font-bold text-stone-100">
                        小謎の答え
                        <input
                          className="min-h-11 rounded border border-brass bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none ring-4 ring-brass/20"
                          onChange={(event) =>
                            setScanTutorialAnswer(event.target.value)
                          }
                          placeholder="答えを入力"
                          value={scanTutorialAnswer}
                        />
                      </label>
                      <button
                        className="mt-3 min-h-11 w-full rounded bg-brass px-3 py-2 text-sm font-black text-stone-950 hover:bg-yellow-300"
                        onClick={solveScanTutorialRiddle}
                        type="button"
                      >
                        答えを確認
                      </button>
                    </>
                  ) : !isScanTutorialComplete ? (
                    <>
                      <p className="text-sm font-bold leading-6 text-stone-100">
                        正解です。次は同じ小謎内のイラストを対象に、スキャン機能を実際に使います。
                      </p>
                      <div className="mt-3 overflow-hidden rounded border border-white/12 bg-white">
                        <Image
                          alt="スキャン機能チュートリアル小謎"
                          className="h-auto w-full"
                          height={900}
                          src="/riddles/riddle_0.png"
                          width={1600}
                        />
                      </div>
                      <div className="mt-3 rounded border border-brass/45 bg-black/30 p-3">
                        <p className="text-sm font-black text-brass">
                          スキャンには「小謎の答え」「スキャン対象のイラスト名」「文字の区切り方」が必要です。
                        </p>
                        <div className="mt-3 grid gap-3">
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            スキャン対象のイラスト名
                            <input
                              className="min-h-11 rounded border border-brass bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none"
                              onChange={(event) =>
                                setScanTutorialIllustrationName(event.target.value)
                              }
                              placeholder="スキャン対象のイラスト名を入力"
                              value={scanTutorialIllustrationName}
                            />
                          </label>
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            文字の区切り方
                            <input
                              className="min-h-11 rounded border border-brass bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none"
                              onChange={(event) =>
                                setScanTutorialSplit(event.target.value)
                              }
                              placeholder="数字部分をスペース区切りで入力"
                              value={scanTutorialSplit}
                            />
                          </label>
                        </div>
                      </div>
                      <button
                        className="mt-3 min-h-11 w-full rounded bg-brass px-3 py-2 text-sm font-black text-stone-950 hover:bg-yellow-300"
                        onClick={runScanTutorial}
                        type="button"
                      >
                        チュートリアルスキャンを実行
                      </button>
                    </>
                  ) : (
                    <>
                      <ScanTargetPreview
                        alt="チュートリアルでスキャンしたすごろく"
                        src={scanTargetImages.sugoroku}
                      />
                      <p className="rounded border border-emerald-300/45 bg-emerald-950/35 p-3 text-sm font-black leading-6 text-emerald-100">
                        チュートリアル完了。すごろくを「す　ご　ろく」に区切ると、5 + 6 = 11。
                        11のトランプが生成されることを確認できました。
                        ゴールは5を含んでいますが、イラストではなく文字のため生成できません。
                        下部に信号機のようなものも見えますが、謎内で信号機と呼んでいないためスキャン対象にはできません。
                      </p>
                      <p className="mt-3 text-sm leading-6 text-stone-100">
                        {scanRuleText}
                      </p>
                      <div className="mt-3 rounded border border-brass/45 bg-black/30 p-3">
                        <p className="text-sm font-black text-brass">
                          生成には「小謎の答え」と「小謎内でのイラストの呼称」の入力が必要です。
                        </p>
                        <div className="mt-3 grid gap-3">
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            小謎の答え
                            <input
                              className={`min-h-11 rounded border bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none ${
                                scanAnswer.trim()
                                  ? "border-emerald-400"
                                  : "animate-pulse border-brass ring-4 ring-brass/30"
                              }`}
                              onChange={(event) => setScanAnswer(event.target.value)}
                              placeholder="小謎の答えを入力"
                              value={scanAnswer}
                            />
                          </label>
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            イラストの呼称
                            <input
                              className={`min-h-11 rounded border bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none ${
                                scanIllustrationName.trim()
                                  ? "border-emerald-400"
                                  : "animate-pulse border-brass ring-4 ring-brass/30"
                              }`}
                              onChange={(event) =>
                                setScanIllustrationName(event.target.value)
                              }
                              placeholder="イラストの呼称を入力"
                              value={scanIllustrationName}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="mt-3 rounded border border-white/12 bg-white p-3 text-stone-950">
                        <div className="grid gap-2 text-sm font-black sm:grid-cols-2">
                          <p className="rounded border border-stone-300 bg-stone-100 px-3 py-2">
                            漢数字はその数字のトランプに変化
                          </p>
                          <p className="rounded border border-stone-300 bg-stone-100 px-3 py-2">
                            インクで見えない箇所の追加
                          </p>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {scanRiddleImages.map((image) => (
                            <div
                              className="overflow-hidden rounded border border-stone-300 bg-white"
                              key={image.src}
                            >
                              <Image
                                alt={image.alt}
                                className="h-auto w-full"
                                height={900}
                                src={image.src}
                                width={1600}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
                          isScanCardGenerated
                            ? "bg-emerald-500 text-stone-950"
                            : canGenerateScanCard
                              ? "bg-brass text-stone-950 hover:bg-yellow-300"
                              : "cursor-not-allowed bg-stone-700 text-stone-400"
                        }`}
                        disabled={!canGenerateScanCard && !isScanCardGenerated}
                        onClick={generateScanCard}
                        type="button"
                      >
                        {isScanCardGenerated
                          ? "10のトランプを生成済み"
                          : "入力内容をスキャンして10を生成"}
                      </button>
                    </>
                  )}
                  {scanTutorialMessage ? (
                    <div className="mt-3 rounded border border-white/12 bg-white/8 p-3">
                      {scanGeneratedPreviewSrc ? (
                        <ScanTargetPreview
                          alt="今回スキャンした対象"
                          src={scanGeneratedPreviewSrc}
                        />
                      ) : null}
                      <p className="mt-3 text-sm font-bold leading-6 text-stone-100">
                        {scanTutorialMessage}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {phase === "idle" && canSelectRiddlePrints ? (
            <div className="rounded border border-brass/50 bg-brass/10 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                Exchange Target
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-100">
                小謎画像内のトランプをタップして、交換対象を2枚選択します。
                中央行左側とど真ん中のトランプを選択できます。
              </p>
              <ExchangeRuleList
                rankRestrictions={["エースはエクスチェンジ不可"]}
                showVisiblePrintTarget
                visiblePrintRemaining={1}
              />
              <RiddlePrintTargetPicker
                selectedIds={selectedRiddlePrintIds}
                setSelectedIds={setSelectedRiddlePrintIds}
              />
            </div>
          ) : null}

          {phase === "idle" && isFinalBattle ? (
            <FinalBattlePreparationPanel
              isApplied={isFinalPreparationApplied}
              onApply={() => {
                setIsFinalPreparationApplied(true);
                setMessage(
                  "ファイナルゲームの事前準備が完了しました。Aを先に出し、Jをそっと置いてブラックジャックを宣言します。",
                );
              }}
            />
          ) : null}

          {phase === "idle" ? (
            <button
              className={`min-h-12 rounded px-4 py-3 text-sm font-black ${
                isFinalBattle && !isFinalPreparationApplied
                  ? "cursor-not-allowed bg-stone-700 text-stone-400"
                  : "bg-brass text-stone-950 hover:bg-yellow-300"
              }`}
              disabled={isFinalBattle && !isFinalPreparationApplied}
              onClick={startRound}
              type="button"
            >
              勝負開始
            </button>
          ) : null}

          {phase === "first-card" ? (
            <>
              <PlacementStyleSelector
                label="2枚目の置き方"
                onChange={setPlacementStyle}
                value={placementStyle}
              />
              <button
                className="min-h-12 rounded bg-emerald-500 px-4 py-3 text-sm font-black text-stone-950 hover:bg-emerald-400"
                onClick={placeSecondCard}
                type="button"
              >
                {playerHasBlackjack ? "ブラックジャック宣言" : "2枚目を出す"}
              </button>
            </>
          ) : null}

          {phase === "result" ? (
            <button
              className="min-h-12 rounded border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
              onClick={resetRound}
              type="button"
            >
              もう一度確認
            </button>
          ) : null}
        </section>
      </div>

      <section className="border-t border-white/10 bg-black/28 p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
          Rule
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-200">
          <HighlightedBlackjackRuleText />
        </p>
      </section>
    </div>
  );
}

function BlackjackDeclarationOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-black/20 p-4">
      <div className="rounded border border-brass bg-stone-950/92 px-8 py-6 text-center shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-brass">
          Declare
        </p>
        <p className="mt-2 text-4xl font-black text-sky-300 drop-shadow sm:text-6xl">
          ブラックジャック
        </p>
        <p className="mt-3 text-sm font-black text-stone-100">
          2枚目を重ねた瞬間に宣言
        </p>
      </div>
    </div>
  );
}

function FinalBattlePreparationPanel({
  isApplied,
  onApply,
}: {
  isApplied: boolean;
  onApply: () => void;
}) {
  const steps = [
    "スキャン一覧の「ハイキング / ハイ　エース」と「ハイキング / ハイ　ジャック」を使用する",
    "コピーペーストで、スキャン仕様の青字「ポーカー」を「ブラックジャック」に上書きする",
    "コピーペーストで、スキャン仕様の「役名」を青字11の平仮名「じゅういち」に上書きする",
    "1と11の組をブラックジャックとして21にし、「に/じゅういち」から13のトランプを生成する",
    "コピーペーストで、発動タイミングの青字「ゲームスタート」を「ブラックジャック」に上書きする",
    "ブラックジャック宣言のタイミングで、ハイアンドローのKと自分のJ、自分のAと生成済みKをエクスチェンジできるようにする",
  ];

  return (
    <div className="rounded border border-brass/55 bg-brass/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
            Final Preparation
          </p>
          <h3 className="mt-1 text-lg font-black">最後の勝利手順</h3>
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-black ${
            isApplied
              ? "bg-emerald-400 text-stone-950"
              : "bg-casinoRed text-white"
          }`}
        >
          {isApplied ? "準備済み" : "未準備"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Exchange", "1回"],
          ["Scan", "3回"],
          ["Copy Paste", "5回"],
        ].map(([label, value]) => (
          <div className="rounded border border-white/10 bg-black/28 p-2" key={label}>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-300">
              {label}
            </p>
            <p className="mt-1 text-sm font-black text-brass">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded border border-sky-300/40 bg-sky-950/25 p-3 text-sm font-bold leading-6 text-sky-50">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-200">
          Poker Robot
        </p>
        <p className="mt-2">
          事前準備時点のポーカーロボット目線の勝率：97.78%
        </p>
        <p className="mt-1">
          最終的にプレイヤーが勝つための行動をとると、ポーカーロボット側もオールインします。
        </p>
      </div>
      <div className="mt-3 rounded border border-sky-300/35 bg-sky-950/25 p-3 text-sm font-bold leading-6 text-stone-100">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-200">
          Copy Paste Targets
        </p>
        <p className="mt-2">
          スキャン仕様の青字:
          <span className="mx-1 font-black text-sky-300 underline decoration-sky-300 decoration-2 underline-offset-4">
            ポーカー
          </span>
          /
          <span className="mx-1 font-black text-sky-300 underline decoration-sky-300 decoration-2 underline-offset-4">
            役名
          </span>
          を上書き対象として扱います。発動タイミングの青字
          <span className="mx-1 font-black text-sky-300 underline decoration-sky-300 decoration-2 underline-offset-4">
            ゲームスタート
          </span>
          もブラックジャックへ上書きします。
        </p>
      </div>
      <ol className="mt-3 grid gap-2 text-sm font-bold leading-6 text-stone-100">
        {steps.map((step, index) => (
          <li className="rounded border border-white/10 bg-black/25 p-2" key={step}>
            {index + 1}. {step}
          </li>
        ))}
      </ol>
      <p className="mt-3 rounded border border-white/10 bg-black/25 p-3 text-sm font-bold leading-6 text-stone-100">
        ブラックジャックではAを先に出し、Jを「そっとおく」で手に隠しながら重ねて置きます。
        宣言の瞬間にエクスチェンジが発動し、最終的にポーカーはKフォーカードで勝利します。
      </p>
      <button
        className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
          isApplied
            ? "bg-emerald-500 text-stone-950"
            : "bg-brass text-stone-950 hover:bg-yellow-300"
        }`}
        onClick={onApply}
        type="button"
      >
        {isApplied ? "ファイナル事前準備を適用済み" : "この内容で事前準備を適用"}
      </button>
    </div>
  );
}

function FinalCopyPasteWorkbench({
  isApplied,
  isSourceSelected,
  isTargetSelected,
  onSelectSource,
  onSelectTarget,
  onStart,
  step,
}: {
  isApplied: boolean;
  isSourceSelected: boolean;
  isTargetSelected: boolean;
  onSelectSource: () => void;
  onSelectTarget: () => void;
  onStart: () => void;
  step: "source" | "target" | null;
}) {
  return (
    <div className="mt-4 rounded border border-casinoRed/45 bg-red-950/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-100">
            Copy Paste
          </p>
          <h4 className="mt-1 text-base font-black text-white">
            青字のコピー元と上書き先を選択
          </h4>
        </div>
        <button
          className="min-h-10 rounded bg-casinoRed px-3 py-2 text-xs font-black text-white hover:bg-red-500"
          onClick={onStart}
          type="button"
        >
          対象選択開始
        </button>
      </div>
      <p className="mt-2 text-sm font-bold leading-6 text-stone-100">
        コピー元はハイアンドローのルールにある青字の「ハイアンドロー」。上書き先は
        riddle_4.png の中央から上にある青字です。
      </p>
      {step ? (
        <p className="mt-2 rounded border border-casinoRed/50 bg-black/35 p-2 text-xs font-black leading-5 text-red-100">
          {step === "source"
            ? "コピー元の青字を押してください。"
            : "上書き先の青字を押してください。"}
        </p>
      ) : null}

      <div className="mt-3 grid gap-3">
        <div className="rounded border border-white/12 bg-black/35 p-3 text-sm font-bold leading-6 text-stone-100">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-100">
            Copy Source
          </p>
          <p className="mt-2">
            流れ ①ロボットが大小関係成り立たないよう先に置く ②プレイヤーが置く ③
            <CopyPasteTarget
              active={step === "source"}
              isSelected={isSourceSelected}
              label="ハイアンドローのルールの青字"
              onSelect={onSelectSource}
            >
              ハイアンドロー
            </CopyPasteTarget>
            と宣言して判定する。
          </p>
        </div>

        <div className="rounded border border-white/12 bg-white p-2 text-stone-950">
          <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-[0.16em] text-sky-500">
            Paste Target
          </p>
          <div className="relative overflow-hidden rounded border border-stone-300 bg-white">
            <Image
              alt="コピーペースト上書き対象の小謎"
              className={`h-auto w-full ${isApplied ? "opacity-45" : ""}`}
              height={900}
              src="/riddles/riddle_4.png"
              width={1600}
            />
            <button
              aria-label="riddle_4.png 中央上部の青字"
              className={`absolute left-[40%] top-[5%] h-[10%] w-[23%] rounded border-2 transition ${
                isTargetSelected
                  ? "border-sky-500 bg-sky-400/25 shadow-[0_0_0_4px_rgba(14,165,233,0.28)]"
                  : step === "target"
                    ? "border-sky-500 bg-sky-400/15 hover:bg-sky-400/25"
                    : "border-transparent bg-transparent"
              }`}
              onClick={(event) => {
                event.preventDefault();
                if (step === "target") {
                  onSelectTarget();
                }
              }}
              type="button"
            >
              <span className="absolute left-1 top-1 rounded bg-sky-500 px-2 py-1 text-[10px] font-black text-white">
                {isTargetSelected ? "SELECTED" : step === "target" ? "選択" : ""}
              </span>
            </button>
            {isApplied ? (
              <div className="absolute inset-0 grid place-items-center bg-black/45 p-4">
                <div className="rounded border border-red-200 bg-stone-950/90 p-4 text-center text-white shadow-2xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-100">
                    Dummy Preview
                  </p>
                  <p className="mt-2 text-sm font-black leading-6">
                    コピーペースト変更後画像
                    <br />
                    ここは後で差し替え予定
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs font-black leading-5 text-stone-100">
        <p>コピー元: {isSourceSelected ? "選択済み" : "未選択"}</p>
        <p>上書き先: {isTargetSelected ? "選択済み" : "未選択"}</p>
      </div>
    </div>
  );
}

function PlacementStyleSelector({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: PlacementStyle) => void;
  value: PlacementStyle;
}) {
  const options: Array<{
    id: PlacementStyle;
    label: string;
  }> = [
    {
      id: "gentle",
      label: "そっとおく",
    },
    {
      id: "snap",
      label: "バシッと置く",
    },
  ];

  return (
    <div className="mt-3 rounded border border-white/10 bg-black/30 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
        {label}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            aria-pressed={value === option.id}
            className={`min-h-14 rounded border px-3 py-2 text-left transition ${
              value === option.id
                ? "border-brass bg-brass text-stone-950"
                : "border-white/10 bg-white/8 text-white hover:bg-white/14"
            }`}
            key={option.id}
            onClick={() => onChange(option.id)}
            type="button"
          >
            <span className="block text-sm font-black">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CardPlacementAnimation({
  mode = "release",
  styleType,
}: {
  mode?: "hold" | "release";
  styleType: PlacementStyle;
}) {
  const isGentle = styleType === "gentle";
  const animationClass = mode === "hold" ? "holdingHand" : isGentle ? "gentleHand" : "snapHand";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden">
      <div className={animationClass}>
        <Image
          alt=""
          className="object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.34)]"
          fill
          priority
          sizes="144px"
          src="/hand.png"
        />
      </div>
      <style jsx>{`
        .gentleHand,
        .holdingHand,
        .snapHand {
          position: absolute;
          height: 174px;
          width: 154px;
          transform-origin: center;
        }

        .holdingHand {
          opacity: 1;
          transform: translate(-4px, 8px) scale(1.18);
        }

        .gentleHand {
          animation: gentle-place 760ms ease-out both;
        }

        .snapHand {
          animation: snap-place 760ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }

        @keyframes gentle-place {
          0% {
            opacity: 1;
            transform: translate(-4px, 8px) scale(1.18);
          }
          38% {
            opacity: 1;
            transform: translate(-4px, 8px) scale(1.18);
          }
          62% {
            opacity: 1;
            transform: translate(-4px, -2px) scale(1.02);
          }
          100% {
            opacity: 0;
            transform: translate(-4px, -36px) scale(1);
          }
        }

        @keyframes snap-place {
          0% {
            opacity: 1;
            transform: translate(-4px, 8px) rotate(-7deg) scale(1.18);
          }
          32% {
            opacity: 1;
            transform: translate(-4px, 8px) rotate(-7deg) scale(1.18);
          }
          48% {
            transform: translate(-6px, -1px) rotate(-10deg) scale(1.02);
          }
          100% {
            opacity: 0;
            transform: translate(-10px, -34px) rotate(-4deg) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

function DraggingCardPreview({
  card,
  point,
}: {
  card: PlayingCard;
  point: { x: number; y: number };
}) {
  return (
    <div
      className="pointer-events-none fixed z-[70] h-28 w-28"
      style={{
        left: point.x,
        top: point.y,
        transform: "translate(-42%, -48%)",
      }}
    >
      <div className="absolute left-7 top-8 rotate-[-5deg]">
        <PlayingCardView card={card} size="hand" />
      </div>
      <div className="absolute left-[-0.8rem] top-[-1.6rem] h-40 w-36 rotate-[-7deg]">
        <Image
          alt=""
          className="object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.34)]"
          fill
          priority
          sizes="144px"
          src="/hand.png"
        />
      </div>
    </div>
  );
}

function HighlightedBlackjackRuleText() {
  return (
    <>
      JQKは10、Aは
      <span className="font-black text-sky-300">11</span>
      として扱い、2〜9は数字の通り。手札から順番に出し、1枚目と2枚目の合計が21に近い方の勝ち。引き分けはあなたの負け。手札にある2枚目で21になる場合、1枚目にピッタリと重ねて2枚目を置き、
      <span className="font-black text-sky-300">ブラックジャック</span>
      と宣言する。
    </>
  );
}

function HighlightedHighLowRuleText() {
  return (
    <>
      お互いに手札2枚ずつ用意。プレイヤーの勝利条件はカードの大小関係が成り立つこと。流れ
      ①ロボットが大小関係成り立たないよう先に置く ②プレイヤーが置く ③
      <span className="font-black text-sky-300">ハイアンドロー</span>
      と宣言して判定する。
    </>
  );
}

function PokerRuleContent({
  ruleText,
  showRobotWinRate = false,
}: {
  ruleText: string;
  showRobotWinRate?: boolean;
}) {
  return (
    <>
      {ruleText}
      {showRobotWinRate ? (
        <span className="mt-3 block rounded border border-sky-300/40 bg-sky-950/35 p-3 text-base font-black text-sky-100">
          現在算出した勝率：0% / ベット：0chip
        </span>
      ) : null}
      <span className="mt-3 block overflow-hidden rounded border border-white/12 bg-white p-1">
        <Image
          alt="4枚ポーカー役一覧"
          className="h-auto w-full"
          height={900}
          src="/poker-hands-guide.svg"
          width={1400}
        />
      </span>
    </>
  );
}

function PokerRobotSpecContent({
  specText,
  showBettingSpec = false,
}: {
  specText: string;
  showBettingSpec?: boolean;
}) {
  return (
    <>
      {specText}
      {showBettingSpec ? (
        <span className="mt-3 block rounded border border-sky-300/40 bg-sky-950/35 p-3 font-bold text-sky-50">
          コピーペースト機能解放と同時に開示:
          <span className="mt-1 block">{pokerBettingSpecText}</span>
        </span>
      ) : null}
    </>
  );
}

function PokerBattle({
  backHref,
  hand,
  onBack,
  robot,
  robotId,
}: {
  backHref: string;
  hand: PlayingCard[];
  onBack: () => void;
  robot: Robot;
  robotId: string;
}) {
  const config =
    robotId in pokerBattleConfigs
      ? pokerBattleConfigs[robotId as keyof typeof pokerBattleConfigs]
      : null;
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [exchangeCardIds, setExchangeCardIds] = useState<string[]>([]);
  const [isExchangeApplied, setIsExchangeApplied] = useState(false);
  const [scannedPokerCardIds, setScannedPokerCardIds] = useState<string[]>([]);
  const [pokerScanAnswer, setPokerScanAnswer] = useState("");
  const [pokerScanIllustration, setPokerScanIllustration] = useState("");
  const [pokerScanMessage, setPokerScanMessage] = useState("");
  const [pokerScanPreviewSrc, setPokerScanPreviewSrc] = useState<string | null>(
    null,
  );
  const [pokerPreparationAbility, setPokerPreparationAbility] =
    useState<PreparationAbility>("exchange");
  const [targetSelectionAbility, setTargetSelectionAbility] =
    useState<TargetSelectionAbility | null>(null);
  const [copyPasteStep, setCopyPasteStep] = useState<"source" | "target">(
    "source",
  );
  const [copiedTargetId, setCopiedTargetId] = useState<string | null>(null);
  const [pasteTargetId, setPasteTargetId] = useState<string | null>(null);
  const [copyPasteFormat, setCopyPasteFormat] =
    useState<CopyPasteFormat>("number");
  const [isCopyPasteApplied, setIsCopyPasteApplied] = useState(false);
  const exchangePairs = config ? [...config.exchangePairs] : [];
  const maxExchanges = config ? config.maxExchanges : 1;
  const maxExchangeCardSelections = maxExchanges * 2;
  const scanRequirements =
    config && "scanRequirements" in config ? [...config.scanRequirements] : [];
  const maxScans =
    config && "maxScans" in config ? config.maxScans : scanRequirements.length;
  const isPokerSecondBattle = robotId === "poker-3-2";
  const isPokerThirdBattle = robotId === "poker-3-3";
  const isFinalAllGamesBattle = robotId === "all-games-last";
  const maxCopyPastes =
    config && "maxCopyPastes" in config ? config.maxCopyPastes : 0;
  const copyPasteTargets =
    config && "copyPasteTargets" in config ? [...config.copyPasteTargets] : [];
  const copiedTarget = copyPasteTargets.find(
    (target) => target.id === copiedTargetId,
  );
  const pasteTarget = copyPasteTargets.find(
    (target) => target.id === pasteTargetId,
  );
  const copyPasteFormatLabel: Record<CopyPasteFormat, string> = {
    hiragana: "平仮名",
    katakana: "カタカナ",
    kanji: "漢字",
    number: "数字",
  };
  const isCorrectExchange =
    config !== null &&
    maxExchanges > 0 &&
    exchangePairs.every(
      (pair) =>
        exchangeCardIds.includes(pair.firstCardId) &&
        exchangeCardIds.includes(pair.secondCardId),
    ) &&
    scanRequirements.every((requirement) =>
      scannedPokerCardIds.includes(requirement.cardId),
    );
  const playerHandIds =
    config && isExchangeApplied
      ? applyExchangePairs([...config.initialPlayerHandIds], exchangePairs)
      : config
        ? [...config.initialPlayerHandIds]
        : hand.map((card) => card.id);
  const blackjackRobotHandIds =
    config && isPokerThirdBattle && isCopyPasteApplied
      ? [...config.blackjackRobotHandIds].map((cardId) =>
          cardId === "A-spade" ? "scan-0" : cardId,
        )
      : config && isExchangeApplied
      ? applyExchangePairs([...config.blackjackRobotHandIds], exchangePairs)
      : config
        ? [...config.blackjackRobotHandIds]
        : [];
  const playerHand = getCardsById(playerHandIds, generatedScanCards);
  const robotHand = getCardsById(
    config
      ? [...config.initialRobotHandIds]
      : robotId === "poker-3-2"
        ? ["K-crub", "Q-heart"]
        : ["Q-crub", "J-heart"],
    generatedScanCards,
  );
  const fieldCards = getCardsById(
    config
      ? [...config.fieldCardIds]
      : ["A-spade", "K-heart", "Q-daia", "J-crub", "A-daia"],
    generatedScanCards,
  );
  const highLowRobotHand = config
    ? getCardsById([...config.highLowRobotHandIds], generatedScanCards)
    : [];
  const blackjackRobotHand = getCardsById(blackjackRobotHandIds, generatedScanCards);
  const scannedPokerCards = getCardsById(scannedPokerCardIds, generatedScanCards);
  const selectableCards = [...playerHand, ...fieldCards];
  const visiblePokerCardIds = new Set(
    [
      ...playerHand,
      ...robotHand,
      ...fieldCards,
      ...highLowRobotHand,
      ...blackjackRobotHand,
    ].map((card) => card.id),
  );
  const remainingDeckCards = deck.filter(
    (card) => !visiblePokerCardIds.has(card.id),
  );
  const exchangeSections: ExchangeCardSection[] = isPokerSecondBattle
    ? [
        {
          cards: scannedPokerCards,
          id: "scan-generated",
          label: "スキャン生成カード",
        },
        {
          cards: playerHand,
          id: "player-hand",
          label: "プレイヤーの手札",
        },
        {
          cards: blackjackRobotHand,
          id: "blackjack-robot-hand",
          label: "ブラックジャックのロボット手札",
        },
      ]
    : [
        {
          cards: playerHand,
          id: "player-hand",
          label: "プレイヤーの手札",
        },
        ...(highLowRobotHand.length > 0
          ? [
              {
                cards: highLowRobotHand,
                id: "high-low-robot-hand",
                label: "ハイアンドローのロボット手札",
              },
            ]
          : []),
        ...(blackjackRobotHand.length > 0
          ? [
              {
                cards: blackjackRobotHand,
                id: "blackjack-robot-hand",
                label: "ブラックジャックのロボット手札",
              },
            ]
          : []),
        {
          cards: remainingDeckCards,
          id: "deck",
          label: "山札",
        },
      ];

  function resolvePokerScan() {
    const answer = pokerScanAnswer.trim();
    const illustration = normalizeScanIllustrationName(pokerScanIllustration);
    const requirement = scanRequirements.find(
      (item) =>
        item.answer === answer &&
        normalizeScanIllustrationName(item.illustration) === illustration,
    );

    if (!requirement) {
      setPokerScanPreviewSrc(null);
      setPokerScanMessage("この答えと対象イラストでは、カードを生成できません。");
      return;
    }

    if (scannedPokerCardIds.includes(requirement.cardId)) {
      setPokerScanPreviewSrc(requirement.targetImageSrc);
      setPokerScanMessage("同じ小謎と対象は、すでにスキャン済みです。");
      return;
    }

    if (scannedPokerCardIds.length >= maxScans) {
      setPokerScanPreviewSrc(null);
      setPokerScanMessage(`この戦いでスキャンできるのは${maxScans}回までです。`);
      return;
    }

    setScannedPokerCardIds((current) => [...current, requirement.cardId]);
    setPokerScanPreviewSrc(requirement.targetImageSrc);
    setPokerScanAnswer("");
    setPokerScanIllustration("");
    setPokerScanMessage(
      `${generatedScanCards[requirement.cardId].rank}のカードを生成しました。エクスチェンジの候補に追加されます。`,
    );
  }

  function toggleSelectedCard(cardId: string) {
    setSelectedCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      return [...current, cardId].slice(-2);
    });
  }

  function toggleExchangeCard(cardId: string) {
    if (maxExchangeCardSelections === 0) {
      return;
    }

    setIsExchangeApplied(false);
    setExchangeCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      return [...current, cardId].slice(-maxExchangeCardSelections);
    });
  }

  function handleCopyPasteTargetSelect(targetId: string) {
    if (copyPasteStep === "source") {
      setCopiedTargetId(targetId);
      setPasteTargetId(null);
      setCopyPasteStep("target");
      return;
    }

    if (targetId === copiedTargetId) {
      return;
    }

    setPasteTargetId(targetId);
    setTargetSelectionAbility(null);
    setIsCopyPasteApplied(true);
  }

  return (
    <div
      className={`relative min-h-[620px] bg-[#071b12] text-white ${
        targetSelectionAbility === "exchange"
          ? "ring-4 ring-inset ring-cyan-400"
          : targetSelectionAbility === "copy-paste"
            ? "ring-4 ring-inset ring-casinoRed"
            : ""
      }`}
    >
      {targetSelectionAbility ? (
        <div
          className={`fixed inset-x-3 top-3 z-50 rounded border px-4 py-3 text-sm font-black shadow-2xl ${
            targetSelectionAbility === "exchange"
              ? "border-cyan-200 bg-cyan-950 text-cyan-50"
              : "border-red-200 bg-red-950 text-red-50"
          }`}
        >
          {targetSelectionAbility === "exchange"
            ? "エクスチェンジ対象選択中です。対象カードを長押ししてください。"
            : copyPasteStep === "source"
              ? "コピー元の青字を押してください。"
              : "上書き先の青字を押してください。"}
        </div>
      ) : null}
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/28 p-4">
        <a
          aria-label="戻る"
          className="grid h-12 w-12 shrink-0 place-items-center rounded border border-white/30 bg-black/30 hover:bg-white/10"
          href={backHref}
          onClick={(event) => {
            event.preventDefault();
            onBack();
          }}
        >
          <ArrowLeft size={18} />
        </a>
        <GameLogo gameType="poker" compact />
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_220px]">
        <section className="rounded border border-white/12 bg-black/28 p-3">
          <div className="grid gap-3">
            <PokerCardGroup cards={robotHand} label="POKER ROBOT HAND" />
            <PokerSelectableGroup
              cards={fieldCards}
              label="SHARED FIELD"
              onToggle={toggleSelectedCard}
              selectedCardIds={selectedCardIds}
            />
            <PokerSelectableGroup
              cards={playerHand}
              label="PLAYER HAND"
              onToggle={toggleSelectedCard}
              selectedCardIds={selectedCardIds}
            />
            {highLowRobotHand.length > 0 ? (
              <PokerCardGroup
                cards={highLowRobotHand}
                label="HIGH AND LOW ROBOT HAND"
              />
            ) : null}
            {blackjackRobotHand.length > 0 ? (
              isPokerThirdBattle ? (
                <PokerCardGroup
                  cards={blackjackRobotHand}
                  copyPasteTarget={{
                    active:
                      targetSelectionAbility === "copy-paste" &&
                      copyPasteStep === "target" &&
                      !isCopyPasteApplied,
                    cardId: "A-spade",
                    isSelected: pasteTargetId === "paste-blackjack-ace",
                    label: "ブラックジャックロボットのA",
                    onSelect: () =>
                      handleCopyPasteTargetSelect("paste-blackjack-ace"),
                  }}
                  label="BLACKJACK ROBOT HAND"
                />
              ) : (
                <PokerCardGroup
                  cards={blackjackRobotHand}
                  label="BLACKJACK ROBOT HAND"
                />
              )
            ) : null}
          </div>

          <div className="mt-4 rounded border border-brass/60 bg-black/50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              Selected Hand
            </p>
            <div className="mt-3 flex min-h-28 items-center justify-center gap-3 rounded border border-dashed border-white/20 bg-black/25 p-3">
              {selectedCardIds.length > 0 ? (
                selectedCardIds.map((cardId) => {
                  const card = selectableCards.find((item) => item.id === cardId);

                  return card ? (
                    <PlayingCardView card={card} key={card.id} size="hand" />
                  ) : null;
                })
              ) : (
                <p className="text-center text-sm font-bold leading-6 text-stone-400">
                  手札2枚とフィールド{fieldCards.length}枚から、役に使う2枚を選択します。
                </p>
              )}
            </div>
            <p className="mt-3 text-sm font-bold leading-6 text-stone-100">
              {selectedCardIds.length === 2
                ? "2枚選択済みです。役判定は今後の謎内容に合わせて接続します。"
                : "2枚選択してください。"}
            </p>
          </div>

          {config ? (
            <div className="mt-4 rounded border border-emerald-400/45 bg-emerald-950/30 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                Win Route
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-stone-100">
                {isExchangeApplied || isCopyPasteApplied
                  ? config.successText
                  : isFinalAllGamesBattle
                    ? config.successText
                  : isPokerSecondBattle
                    ? "riddle_3.pngで0、riddle_4.pngでAをスキャン生成し、生成カードを使って2回エクスチェンジすると勝てる形になります。"
                    : isPokerThirdBattle
                      ? "先にコピペ解放小謎を解き、青字の0をブラックジャックロボットのAへ数字書式で上書きすると勝てる形になります。"
                    : "自分のクイーンとブラックジャックロボットのキング1枚をエクスチェンジすると、3つのゲームすべてで勝てる形になります。"}
              </p>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded border border-white/12 bg-black/28 p-3">
          <div className="rounded border border-brass/45 bg-brass/10 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              Preparation
            </p>
            {isFinalAllGamesBattle ? (
              <div className="mt-3 rounded border border-emerald-300/45 bg-emerald-950/30 p-3 text-sm font-bold leading-6 text-emerald-100">
                <p className="font-black">ファイナル事前準備は反映済みです。</p>
                <p className="mt-2">
                  ブラックジャック宣言のタイミングで発動したエクスチェンジにより、ポーカーではKフォーカードを作れる状態になっています。ポーカーロボット側もオールインします。
                </p>
              </div>
            ) : isPokerThirdBattle ? (
              <>
                <AbilityUsageTabs
                  activeAbility={pokerPreparationAbility}
                  counts={{
                    "copy-paste": maxCopyPastes,
                    exchange: maxExchanges,
                    scan: maxScans,
                  }}
                  onSelect={setPokerPreparationAbility}
                />
                <div className="mt-3 rounded border border-sky-300/40 bg-sky-950/25 p-3 text-sm font-bold leading-6 text-sky-50">
                  コピーペースト機能解放と同時に、ポーカーの賭け仕様が開示されました。ポーカーでは賭ける要素が新たに発生し、プレイヤーは問答無用でオールインになります。
                </div>
                {pokerPreparationAbility === "exchange" ? (
                  <DisabledAbilityNotice
                    abilityName="エクスチェンジ"
                    tone="exchange"
                  />
                ) : null}
                {pokerPreparationAbility === "scan" ? (
                  <DisabledAbilityNotice abilityName="スキャン" tone="scan" />
                ) : null}
                {pokerPreparationAbility === "copy-paste" ? (
                  <CopyPastePreparationPanel
                    copiedTarget={copiedTarget}
                    format={copyPasteFormat}
                    formatLabel={copyPasteFormatLabel[copyPasteFormat]}
                    isApplied={isCopyPasteApplied}
                    maxCopyPastes={maxCopyPastes}
                    onChooseFormat={setCopyPasteFormat}
                    onSelectSource={() =>
                      handleCopyPasteTargetSelect("copy-red-unlock-zero")
                    }
                    onStart={() => {
                      setCopyPasteStep("source");
                      setCopiedTargetId(null);
                      setPasteTargetId(null);
                      setIsCopyPasteApplied(false);
                      setTargetSelectionAbility("copy-paste");
                    }}
                    pasteTarget={pasteTarget}
                    sourceActive={
                      targetSelectionAbility === "copy-paste" &&
                      copyPasteStep === "source"
                    }
                  />
                ) : null}
              </>
            ) : (
              <>
                <p className="mt-2 text-sm font-black text-stone-100">
                  エクスチェンジ使用可能回数: {maxExchanges}回 / スキャン使用可能回数:{" "}
                  {maxScans}回
                </p>
                {maxExchanges > 0 ? (
                  <button
                    className="mt-3 min-h-10 w-full rounded border border-cyan-200/60 bg-cyan-950/45 px-3 py-2 text-sm font-black text-cyan-50 hover:bg-cyan-900"
                    onClick={() => setTargetSelectionAbility("exchange")}
                    type="button"
                  >
                    エクスチェンジ対象選択モード
                  </button>
                ) : null}
              </>
            )}
            {!isPokerThirdBattle ? (
              <>
            <ExchangeRuleList
              disabledTargets={
                isPokerSecondBattle
                  ? ["robot-hand", "deck", "field"]
                  : ["robot-hand", "field"]
              }
              showDeckTarget
              showFieldTarget
              targetLabels={{
                deck: "山札",
                field: "フィールド",
                "robot-hand": "ポーカーのロボットの手札",
              }}
            />
            {config ? (
              <>
                {scanRequirements.length > 0 ? (
                  <div className="mt-4 rounded border border-cyan-300/35 bg-cyan-950/25 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">
                        Scan
                      </p>
                      <p className="text-xs font-black text-cyan-100">
                        {scannedPokerCardIds.length}/{maxScans}
                      </p>
                    </div>
                    <p className="mt-2 text-sm font-bold leading-6 text-stone-100">
                      小謎の答えと対象イラストの呼称を入力すると、カードを生成できます。生成したカードは下のエクスチェンジ候補に追加されます。
                    </p>
                    <div className="mt-3 grid gap-3">
                      {scanRequirements.map((requirement, index) => (
                        <div
                          className="overflow-hidden rounded border border-white/15 bg-white"
                          key={requirement.riddleSrc}
                        >
                          <Image
                            alt={`スキャン用小謎 ${index + 1}`}
                            className="h-auto w-full"
                            height={900}
                            src={requirement.riddleSrc}
                            width={1600}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2">
                      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
                        小謎の答え
                        <input
                          className="min-h-11 rounded border border-white/20 bg-black/35 px-3 text-sm font-bold text-white outline-none focus:border-cyan-200"
                          onChange={(event) => setPokerScanAnswer(event.target.value)}
                          placeholder="例: フエ"
                          type="text"
                          value={pokerScanAnswer}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
                        対象イラスト
                        <input
                          className="min-h-11 rounded border border-white/20 bg-black/35 px-3 text-sm font-bold text-white outline-none focus:border-cyan-200"
                          onChange={(event) =>
                            setPokerScanIllustration(event.target.value)
                          }
                          placeholder="例: イチ　ゴ"
                          type="text"
                          value={pokerScanIllustration}
                        />
                      </label>
                      <button
                        className="min-h-11 rounded bg-cyan-200 px-4 text-sm font-black text-stone-950 hover:bg-cyan-100"
                        onClick={resolvePokerScan}
                        type="button"
                      >
                        スキャン実行
                      </button>
                    </div>
                    {pokerScanMessage ? (
                      <div className="mt-3 rounded border border-white/15 bg-black/25 p-3">
                        {pokerScanPreviewSrc ? (
                          <ScanTargetPreview
                            alt="今回スキャンした対象"
                            src={pokerScanPreviewSrc}
                          />
                        ) : null}
                        <p className="mt-3 text-sm font-bold leading-6 text-cyan-50">
                          {pokerScanMessage}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <ExchangeCardSectionPicker
                  longPressMode={targetSelectionAbility === "exchange"}
                  sections={exchangeSections}
                  selectedCardIds={exchangeCardIds}
                  onToggleCard={(cardId) => {
                    toggleExchangeCard(cardId);
                    if (
                      targetSelectionAbility === "exchange" &&
                      exchangeCardIds.length + 1 >= maxExchangeCardSelections
                    ) {
                      setTargetSelectionAbility(null);
                    }
                  }}
                />
                {exchangeCardIds.length === maxExchangeCardSelections &&
                !isCorrectExchange ? (
                  <p className="mt-3 rounded border border-casinoRed/50 bg-casinoRed/15 p-3 text-sm font-bold leading-6 text-red-100">
                    この組み合わせでは、3つのゲームすべてを勝てる形にはならなさそうです。
                  </p>
                ) : null}
                <button
                  className={`mt-3 min-h-12 w-full rounded px-4 py-3 text-sm font-black ${
                    isExchangeApplied
                      ? "bg-emerald-500 text-stone-950"
                      : exchangeCardIds.length === maxExchangeCardSelections &&
                          isCorrectExchange
                        ? "bg-brass text-stone-950 hover:bg-yellow-300"
                        : "cursor-not-allowed bg-stone-700 text-stone-400"
                  }`}
                  disabled={
                    exchangeCardIds.length !== maxExchangeCardSelections ||
                    !isCorrectExchange
                  }
                  onClick={() => setIsExchangeApplied(true)}
                  type="button"
                >
                  {isExchangeApplied
                    ? `交換済み: ${maxExchanges}回`
                    : `エクスチェンジ決定 (${exchangeCardIds.length}/${maxExchangeCardSelections})`}
                </button>
              </>
            ) : null}
              </>
            ) : null}
          </div>
          <div className="rounded border border-white/10 bg-white/6 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              Robot Logic
            </p>
            {isPokerThirdBattle ? (
              <p className="mt-2 text-sm leading-6 text-stone-200">
                <PokerRobotSpecContent
                  specText={robot.specText}
                  showBettingSpec
                />
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-stone-200">
                {robot.specText}
              </p>
            )}
          </div>
          <div className="rounded border border-white/10 bg-white/6 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              Rule
            </p>
            {isPokerThirdBattle ? (
              <p className="mt-2 text-sm leading-6 text-stone-200">
                {robot.gameType === "high-low" ? (
                  <HighlightedHighLowRuleText />
                ) : robot.gameType === "poker" ? (
                  <PokerRuleContent
                    ruleText={robot.ruleText}
                    showRobotWinRate={isPokerThirdBattle}
                  />
                ) : (
                  robot.ruleText
                )}
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-stone-200">
                {robot.gameType === "high-low" ? (
                  <HighlightedHighLowRuleText />
                ) : robot.gameType === "poker" ? (
                  <PokerRuleContent
                    ruleText={robot.ruleText}
                    showRobotWinRate={isPokerThirdBattle}
                  />
                ) : (
                  robot.ruleText
                )}
              </p>
            )}
          </div>
          <button
            className={`min-h-12 rounded px-4 py-3 text-sm font-black ${
              selectedCardIds.length === 2
                ? "bg-brass text-stone-950 hover:bg-yellow-300"
                : "cursor-not-allowed bg-stone-700 text-stone-400"
            }`}
            disabled={selectedCardIds.length !== 2}
            type="button"
          >
            役を決定
          </button>
        </section>
      </div>
    </div>
  );
}

function AbilityUsageTabs({
  activeAbility,
  counts,
  onSelect,
}: {
  activeAbility: PreparationAbility;
  counts: Record<PreparationAbility, number>;
  onSelect: (ability: PreparationAbility) => void;
}) {
  const labels: Record<PreparationAbility, string> = {
    "copy-paste": "コピーペースト",
    exchange: "エクスチェンジ",
    scan: "スキャン",
  };

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {(["exchange", "scan", "copy-paste"] as const).map((ability) => {
        const active = activeAbility === ability;

        return (
          <button
            className={`min-h-12 rounded border px-2 py-2 text-xs font-black leading-5 ${
              active
                ? "border-brass bg-brass text-stone-950"
                : "border-white/10 bg-white/8 text-white hover:bg-white/14"
            }`}
            key={ability}
            onClick={() => onSelect(ability)}
            type="button"
          >
            {labels[ability]}
            <span className="block text-[11px]">残{counts[ability]}</span>
          </button>
        );
      })}
    </div>
  );
}

function DisabledAbilityNotice({
  abilityName,
  tone,
}: {
  abilityName: string;
  tone: "exchange" | "scan";
}) {
  return (
    <div
      className={`mt-3 rounded border p-3 text-sm font-bold leading-6 ${
        tone === "exchange"
          ? "border-cyan-300/35 bg-cyan-950/25 text-cyan-50"
          : "border-white/15 bg-black/25 text-stone-200"
      }`}
    >
      {abilityName}の使用可能回数は0です。この戦いでは使用できません。
    </div>
  );
}

function CopyPastePreparationPanel({
  copiedTarget,
  format,
  formatLabel,
  isApplied,
  maxCopyPastes,
  onChooseFormat,
  onSelectSource,
  onStart,
  pasteTarget,
  sourceActive,
}: {
  copiedTarget?: { label: string; text: string };
  format: CopyPasteFormat;
  formatLabel: string;
  isApplied: boolean;
  maxCopyPastes: number;
  onChooseFormat: (format: CopyPasteFormat) => void;
  onSelectSource: () => void;
  onStart: () => void;
  pasteTarget?: { label: string; text: string };
  sourceActive: boolean;
}) {
  const formatOptions: Array<{ id: CopyPasteFormat; label: string }> = [
    { id: "hiragana", label: "平仮名" },
    { id: "katakana", label: "カタカナ" },
    { id: "kanji", label: "漢字" },
    { id: "number", label: "数字" },
  ];

  return (
    <div className="mt-3 rounded border border-casinoRed/50 bg-red-950/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-100">
          Copy Paste
        </p>
        <p className="text-xs font-black text-red-100">残{maxCopyPastes}</p>
      </div>
      <p className="mt-2 text-sm font-bold leading-6 text-stone-100">
        青字をコピーし、別の青字へ上書きペーストします。ペースト時の書式は自由に選択できます。
      </p>
      <div className="mt-3 rounded border border-white/15 bg-black/30 p-3 text-sm font-bold leading-6 text-stone-100">
        コピペ解放小謎で得た青字:
        <CopyPasteTarget
          active={sourceActive && !copiedTarget}
          isSelected={copiedTarget?.text === "0"}
          label="コピペ解放小謎: 0"
          onSelect={onSelectSource}
        >
          0
        </CopyPasteTarget>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {formatOptions.map((option) => (
          <button
            className={`min-h-10 rounded border px-3 py-2 text-sm font-black ${
              format === option.id
                ? "border-red-100 bg-red-200 text-stone-950"
                : "border-white/10 bg-white/8 text-white hover:bg-white/14"
            }`}
            key={option.id}
            onClick={() => onChooseFormat(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        className="mt-3 min-h-11 w-full rounded bg-casinoRed px-4 text-sm font-black text-white hover:bg-red-500"
        disabled={maxCopyPastes === 0}
        onClick={onStart}
        type="button"
      >
        対象選択を開始
      </button>
      <div className="mt-3 grid gap-2 text-sm font-bold leading-6 text-stone-100">
        <p>コピー元: {copiedTarget ? copiedTarget.label : "未選択"}</p>
        <p>上書き先: {pasteTarget ? pasteTarget.label : "未選択"}</p>
        <p>書式: {formatLabel}</p>
      </div>
      {isApplied && copiedTarget && pasteTarget ? (
        <p className="mt-3 rounded border border-emerald-300/45 bg-emerald-950/40 p-3 text-sm font-black leading-6 text-emerald-100">
          {copiedTarget.text} を {formatLabel} として {pasteTarget.text} に上書きしました。
        </p>
      ) : null}
    </div>
  );
}

function CopyPasteTarget({
  active,
  children,
  isSelected,
  label,
  onSelect,
}: {
  active: boolean;
  children: string;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={`mx-1 rounded px-1 font-black text-sky-300 underline decoration-sky-300 decoration-2 underline-offset-4 transition ${
        active ? "bg-sky-400/25 ring-2 ring-sky-300" : ""
      } ${isSelected ? "bg-sky-200 text-stone-950" : ""}`}
      onClick={(event) => {
        event.preventDefault();
        if (active) {
          onSelect();
        }
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function PokerCardGroup({
  cards,
  copyPasteTarget,
  label,
}: {
  cards: PlayingCard[];
  copyPasteTarget?: {
    active: boolean;
    cardId: string;
    isSelected: boolean;
    label: string;
    onSelect: () => void;
  };
  label: string;
}) {
  return (
    <div className="rounded border border-white/10 bg-black/35 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
        {label}
      </p>
      <div className="mt-3 flex min-h-32 flex-wrap items-center justify-center gap-3 rounded border border-white/8 bg-emerald-950/25 p-3">
        {cards.map((card) =>
          copyPasteTarget && card.id === copyPasteTarget.cardId ? (
            <CopyPasteCardTarget
              card={card}
              key={card.id}
              target={copyPasteTarget}
            />
          ) : (
            <PlayingCardView card={card} key={card.id} size="zone" />
          ),
        )}
      </div>
    </div>
  );
}

function CopyPasteCardTarget({
  card,
  target,
}: {
  card: PlayingCard;
  target: {
    active: boolean;
    isSelected: boolean;
    label: string;
    onSelect: () => void;
  };
}) {
  return (
    <button
      aria-label={target.label}
      className={`rounded border p-1 transition ${
        target.isSelected
          ? "border-sky-200 bg-sky-200/30 ring-4 ring-sky-400/60"
          : target.active
            ? "border-sky-300 bg-sky-300/20 hover:bg-sky-300/30"
            : "border-transparent bg-transparent"
      }`}
      onClick={(event) => {
        event.preventDefault();
        if (target.active) {
          target.onSelect();
        }
      }}
      type="button"
    >
      <PlayingCardView card={card} size="zone" />
    </button>
  );
}

function PokerSelectableGroup({
  cards,
  label,
  onToggle,
  selectedCardIds,
}: {
  cards: PlayingCard[];
  label: string;
  onToggle: (cardId: string) => void;
  selectedCardIds: string[];
}) {
  return (
    <div className="rounded border border-white/10 bg-black/35 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
        {label}
      </p>
      <div className="mt-3 flex min-h-32 flex-wrap items-center justify-center gap-3 rounded border border-white/8 bg-emerald-950/25 p-3">
        {cards.map((card) => {
          const selected = selectedCardIds.includes(card.id);

          return (
            <button
              aria-pressed={selected}
              className={`rounded p-1 transition ${
                selected
                  ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.45)]"
                  : "bg-transparent hover:bg-white/10"
              }`}
              key={card.id}
              onClick={() => onToggle(card.id)}
              type="button"
            >
              <PlayingCardView card={card} size="zone" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExchangeCardSectionPicker({
  longPressMode = false,
  onToggleCard,
  sections,
  selectedCardIds,
}: {
  longPressMode?: boolean;
  onToggleCard: (cardId: string) => void;
  sections: ExchangeCardSection[];
  selectedCardIds: string[];
}) {
  const visibleSections = sections.filter((section) => section.cards.length > 0);

  return (
    <div className="mt-4 grid gap-3">
      {visibleSections.map((section) => (
        <section
          className="rounded border border-white/10 bg-black/25 p-3"
          key={section.id}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              {section.label}
            </p>
            <p className="text-xs font-bold text-stone-400">
              {section.cards.length}枚
            </p>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {section.cards.map((card) => (
              <ExchangeCardButton
                card={card}
                key={`${section.id}-${card.id}`}
                longPressMode={longPressMode}
                onSelect={() => onToggleCard(card.id)}
                selected={selectedCardIds.includes(card.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ExchangeCardButton({
  card,
  longPressMode,
  onSelect,
  selected,
}: {
  card: PlayingCard;
  longPressMode: boolean;
  onSelect: () => void;
  selected: boolean;
}) {
  const timerRef = useRef<number | null>(null);

  function clearLongPress() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function startLongPress() {
    if (!longPressMode) {
      return;
    }

    clearLongPress();
    timerRef.current = window.setTimeout(() => {
      onSelect();
      timerRef.current = null;
    }, 520);
  }

  return (
    <button
      aria-pressed={selected}
      className={`rounded border p-1 transition ${
        selected
          ? "border-brass bg-brass/20 ring-4 ring-brass/45"
          : longPressMode
            ? "border-cyan-300 bg-cyan-300/15 hover:bg-cyan-300/25"
            : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
      onClick={() => {
        if (!longPressMode) {
          onSelect();
        }
      }}
      onPointerCancel={clearLongPress}
      onPointerDown={startLongPress}
      onPointerLeave={clearLongPress}
      onPointerUp={clearLongPress}
      type="button"
    >
      <PlayingCardView card={card} size="hand" />
    </button>
  );
}

function HighLowBattle({
  backHref,
  hand,
  onBack,
  robotId,
  stageId,
}: {
  backHref: string;
  hand: PlayingCard[];
  onBack: () => void;
  robotId: string;
  stageId: number;
}) {
  const isTutorial = stageId === 1 && robotId === HIGH_LOW_TUTORIAL_ROBOT_ID;
  const isFinalHighLowBattle = robotId === "all-games-last";
  const highLowConfig =
    robotId in highLowBattleConfigs
      ? highLowBattleConfigs[robotId as keyof typeof highLowBattleConfigs]
      : null;
  const initialPlayerHand = highLowConfig
    ? getCardsById([...highLowConfig.initialPlayerHandIds])
    : hand;
  const initialRobotHand = highLowConfig
    ? getCardsById([...highLowConfig.initialRobotHandIds])
    : hand.slice().reverse();
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragPreviewPoint, setDragPreviewPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [playerPlacedCardId, setPlayerPlacedCardId] = useState<string | null>(
    null,
  );
  const [battleStarted, setBattleStarted] = useState(true);
  const [canPlaceCard, setCanPlaceCard] = useState(true);
  const [robotZone, setRobotZone] = useState<HighLowZoneName | null>(
    () => getRobotOpeningZone({ isExchangeCorrect: false, isFinalHighLowBattle, isTutorial }),
  );
  const [playerZone, setPlayerZone] = useState<HighLowZoneName | null>(null);
  const [showPreparationVehicle, setShowPreparationVehicle] = useState(false);
  const [showPreparation, setShowPreparation] = useState(false);
  const [showPreparationIntro, setShowPreparationIntro] = useState(true);
  const [showExchangeWarning, setShowExchangeWarning] = useState(false);
  const [winOverlayDismissed, setWinOverlayDismissed] = useState(false);
  const [hasEnteredPreparation, setHasEnteredPreparation] = useState(false);
  const [exchangeCardIds, setExchangeCardIds] = useState<string[]>([]);
  const [exchangeConfirmed, setExchangeConfirmed] = useState(false);
  const [exchangeApplied, setExchangeApplied] = useState(false);
  const [placementAnimation, setPlacementAnimation] = useState<{
    mode: "hold" | "release";
    styleType: PlacementStyle;
    zone: HighLowZoneName;
  } | null>(null);
  const [placementPendingConfirm, setPlacementPendingConfirm] = useState(false);
  const [placementConfirmed, setPlacementConfirmed] = useState(false);
  const isExchangeCorrect =
    Boolean(highLowConfig) &&
    exchangeConfirmed &&
    highLowConfig?.correctExchangePairs.some((pair) =>
      pair.every((cardId) => exchangeCardIds.includes(cardId)),
    ) === true;
  const isExchangeApplied = isExchangeCorrect && exchangeApplied;
  const requiresExchangeBeforeStart =
    Boolean(highLowConfig) &&
    !isFinalHighLowBattle &&
    (!isTutorial || hasEnteredPreparation);
  const exchangedPlayerHandIds =
    isExchangeApplied && highLowConfig
      ? swapSelectedCardIds(
          [...highLowConfig.initialPlayerHandIds],
          exchangeCardIds,
        )
      : initialPlayerHand.map((card) => card.id);
  const exchangedRobotHandIds =
    isExchangeApplied && highLowConfig
      ? swapSelectedCardIds(
          [...highLowConfig.initialRobotHandIds],
          exchangeCardIds,
        )
      : initialRobotHand.map((card) => card.id);
  const playerHand = getCardsById(exchangedPlayerHandIds);
  const robotHand = getCardsById(exchangedRobotHandIds);
  const tutorialPlayerCard =
    playerHand.find((card) => card.id === "A-spade") ?? playerHand[0];
  const exchangedAceCardId = exchangeCardIds.find((cardId) =>
    cardId.startsWith("A-"),
  );
  const configuredRobotHighCard =
    highLowConfig && isExchangeApplied
      ? robotHand.find(
          (card) => card.id === highLowConfig.robotHighCardAfterExchangeId,
        ) ??
        robotHand.find((card) => card.id === exchangedAceCardId) ??
        robotHand.find((card) => card.rank === "A")
      : null;
  const defaultRobotCard =
    isFinalHighLowBattle
      ? robotHand.find((card) => card.rank === "K") ?? robotHand[0]
      :
    configuredRobotHighCard ??
    (isTutorial ? initialRobotHand.find((card) => card.rank === "K") : robotHand[0]);
  const defaultPlayerCard = isTutorial
    ? tutorialPlayerCard
    : playerHand[0];
  const robotPlacedCard = defaultRobotCard ?? null;
  const playerDefaultCard = defaultPlayerCard ?? null;
  const visibleRobotHand = robotPlacedCard
    ? robotHand.filter((card) => card.id !== robotPlacedCard.id)
    : robotHand;

  useEffect(() => {
    function handleNativeAction(event: PointerEvent) {
      const target =
        event.target instanceof Element ? event.target : null;

      if (target?.closest("[data-high-low-prepare]")) {
        event.preventDefault();
        event.stopPropagation();
        setShowPreparationVehicle(true);
        return;
      }

    }

    document.addEventListener("pointerdown", handleNativeAction, true);

    return () => {
      document.removeEventListener("pointerdown", handleNativeAction, true);
    };
  }, [
    isExchangeCorrect,
    isTutorial,
    requiresExchangeBeforeStart,
  ]);

  const tutorialStep = getHighLowTutorialStepContent({
    battleStarted,
    canPlaceCard,
    playerZone,
  });
  const draggableCardIds =
    canPlaceCard && !playerZone
      ? isTutorial
        ? isExchangeApplied
          ? playerHand.map((card) => card.id)
          : tutorialPlayerCard
            ? [tutorialPlayerCard.id]
            : []
        : playerHand.map((card) => card.id)
      : [];
  const playerPlacedCard =
    playerHand.find((card) => card.id === playerPlacedCardId) ?? null;
  const visiblePlayerHand = playerPlacedCard
    ? playerHand.filter((card) => card.id !== playerPlacedCard.id)
    : playerHand;
  const draggingCard =
    playerHand.find((card) => card.id === draggingCardId) ?? null;
  const highZoneCard =
    robotZone === "HIGH"
      ? robotPlacedCard
      : playerZone === "HIGH"
        ? playerPlacedCard
        : null;
  const lowZoneCard =
    robotZone === "LOW"
      ? robotPlacedCard
      : playerZone === "LOW"
        ? playerPlacedCard
        : null;
  const highLowResult =
    placementConfirmed && highZoneCard && lowZoneCard
      ? getHighLowResult(highZoneCard, lowZoneCard)
      : null;
  const exchangeSections: ExchangeCardSection[] = [
    {
      cards: playerHand,
      id: "player-hand",
      label: "プレイヤーの手札",
    },
    {
      cards: robotHand,
      id: "high-low-robot-hand",
      label: "ハイアンドローのロボット手札",
    },
    ...(stageId >= 3
      ? [
          {
            cards: deck,
            id: "deck",
            label: "山札",
          },
        ]
      : []),
  ];

  const showWinOverlay = highLowResult === "win" && !winOverlayDismissed;

  function placePlayerCard(zone: "HIGH" | "LOW", cardId = playerDefaultCard?.id) {
    if (!canPlaceCard) {
      return;
    }

    setDragPreviewPoint(null);
    setPlayerPlacedCardId(cardId ?? null);
    setPlayerZone(zone);
    setPlacementAnimation({
      mode: "hold",
      styleType: "gentle",
      zone,
    });
    setPlacementPendingConfirm(true);
    setPlacementConfirmed(false);
  }

  function confirmPlayerPlacement() {
    if (!placementAnimation) {
      return;
    }

    const zone = placementAnimation.zone;
    setPlacementPendingConfirm(false);
    setPlacementAnimation({
      mode: "release",
      styleType: "gentle",
      zone,
    });
    window.setTimeout(() => {
      setPlacementAnimation((current) =>
        current?.zone === zone ? null : current,
      );
      setPlacementConfirmed(true);
    }, 760);
  }

  function resetPlayerPlacement() {
    setPlayerPlacedCardId(null);
    setPlayerZone(null);
    setPlacementAnimation(null);
    setPlacementPendingConfirm(false);
    setPlacementConfirmed(false);
  }

  function dropPlayerCard(zone: "HIGH" | "LOW") {
    if (!draggingCardId || !draggableCardIds.includes(draggingCardId)) {
      return;
    }

    placePlayerCard(zone, draggingCardId);
    setDraggingCardId(null);
    setDragPreviewPoint(null);
  }

  function startDraggingCard(cardId: string, point: { x: number; y: number } | null) {
    setDraggingCardId(cardId);
    setDragPreviewPoint(point);
  }

  function moveDraggingCard(point: { x: number; y: number } | null) {
    if (!point) {
      return;
    }

    setDragPreviewPoint(point);
  }

  function endDraggingCard() {
    setDraggingCardId(null);
    setDragPreviewPoint(null);
  }

  function toggleExchangeCard(cardId: string) {
    setExchangeCardIds((current) => {
      setExchangeConfirmed(false);
      setExchangeApplied(false);

      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      if (current.length >= 2) {
        return [current[1], cardId];
      }

      return [...current, cardId];
    });
  }

  if (showPreparationVehicle) {
    return (
      <div className="min-h-[680px] bg-[#120d09] text-white">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/45 p-3 sm:p-4">
          <button
            className="grid h-10 w-10 place-items-center rounded border border-white/14 bg-white/8 hover:bg-white/14"
            onClick={() => setShowPreparationVehicle(false)}
            type="button"
            aria-label="ハイアンドローに戻る"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-black">事前準備</h2>
          <div className="h-10 w-10" />
        </div>

        <section className="relative min-h-[620px] overflow-hidden">
          <Image
            alt="事前準備車両"
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src="/preparation-vehicle.png"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/75" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/42 to-transparent px-4 pb-5 pt-16 sm:px-6 sm:pb-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-3 border-l-4 border-brass/80 bg-black/40 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-base font-black text-white sm:text-lg">
                車内で準備をすることができます。
              </p>
              <button
                className="min-h-11 w-full rounded bg-brass px-4 text-sm font-black text-stone-950 hover:bg-yellow-300 sm:w-auto sm:px-6"
                onClick={() => {
                  setShowPreparationVehicle(false);
                  setShowPreparation(true);
                  setShowPreparationIntro(false);
                  setHasEnteredPreparation(true);
                }}
                type="button"
              >
                車内へ入る
              </button>
            </div>
          </div>
        </section>

        {showPreparationIntro ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/78 p-3 sm:p-4">
            <section className="w-full max-w-lg rounded border border-brass bg-stone-950 p-4 text-white shadow-2xl sm:p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                Preparation
              </p>
              <h3 className="mt-2 text-xl font-black">事前準備</h3>
              <p className="mt-4 text-sm font-bold leading-7 text-stone-100">
                <span className="block">
                  このままではプレイヤーが勝つことはできません。
                </span>
                <span className="mt-2 block font-black">
                  そこで、車内に特殊な能力を用意しました。この能力を駆使して全勝を目指してください。
                </span>
              </p>
              <button
                className="mt-5 min-h-11 w-full rounded bg-brass px-4 text-sm font-black text-stone-950 hover:bg-yellow-300"
                onClick={() => setShowPreparationIntro(false)}
                type="button"
              >
                確認
              </button>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

  if (showPreparation) {
    return (
      <div className="min-h-[680px] bg-[#111827] text-white">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/45 p-3 sm:p-4">
          <button
            className="grid h-10 w-10 place-items-center rounded border border-white/14 bg-white/8 hover:bg-white/14"
            onClick={() => setShowPreparation(false)}
            type="button"
            aria-label="ハイアンドローに戻る"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-black">事前準備</h2>
          <div className="h-10 w-10" />
        </div>

        <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
          <div className="hidden">
          <TutorialBubble>
            <span className="block">
              このままではプレイヤーが勝つことはできません。
            </span>
            <span className="mt-2 block font-black">
              そこで、車内に特殊な能力を用意しました。この能力を駆使して全勝を目指してください。
            </span>
          </TutorialBubble>
          </div>

          <section className="mt-4 rounded border border-white/12 bg-black/35 p-3 sm:p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              Ability 01
            </p>
            <h3 className="mt-1 text-2xl font-black">エクスチェンジ</h3>
            <p className="mt-3 text-sm font-bold leading-7 text-stone-200">
              トランプ同士を、事前に指定したゲームの開始時に指定したAKQJ1枚と入れ替える。カード自体は変わらず、数字面の印刷のみ入れ替わる。
            </p>
            <ExchangeRuleList />
          </section>

          <section className="mt-4 rounded border border-white/12 bg-black/35 p-3 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                  Select Cards
                </p>
                <h3 className="mt-1 text-xl font-black">交換対象を2枚選択</h3>
              </div>
              <p className="text-sm font-bold text-stone-300">
                {exchangeCardIds.length}/2
              </p>
            </div>

            <ExchangeCardSectionPicker
              sections={exchangeSections}
              selectedCardIds={exchangeCardIds}
              onToggleCard={toggleExchangeCard}
            />

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {exchangeConfirmed ? (
                <p className="text-sm font-bold text-emerald-200">
                  エクスチェンジ対象を決定しました。
                </p>
              ) : null}
              <button
                className={`min-h-11 rounded px-5 text-sm font-black ${
                  exchangeCardIds.length === 2
                    ? "bg-brass text-stone-950 hover:bg-yellow-300"
                    : "cursor-not-allowed bg-stone-700 text-stone-400"
                }`}
                disabled={exchangeCardIds.length !== 2}
                onClick={() => {
                  setExchangeConfirmed(true);
                  setExchangeApplied(isExchangeCorrect);
                  setBattleStarted(true);
                  setCanPlaceCard(true);
                  setRobotZone(
                    getRobotOpeningZone({
                      isExchangeCorrect,
                      isFinalHighLowBattle,
                      isTutorial,
                    }),
                  );
                  setPlayerPlacedCardId(null);
                  setPlacementAnimation(null);
                  setPlacementPendingConfirm(false);
                  setPlacementConfirmed(false);
                  setPlayerZone(null);
                  setShowExchangeWarning(false);
                  setWinOverlayDismissed(false);
                  setShowPreparation(false);
                }}
                type="button"
              >
                決定
              </button>
            </div>
          </section>
        </div>
      </div>
    );
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
        {showExchangeWarning ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/78 p-3 sm:p-4">
            <section className="w-full max-w-md rounded border border-brass bg-stone-950 p-4 text-white shadow-2xl sm:p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                Exchange Check
              </p>
              <p className="mt-3 text-base font-black leading-7 text-stone-50">
                このままでは上手くいかなさそうだ...
              </p>
              <button
                className="mt-5 min-h-11 w-full rounded bg-brass px-4 text-sm font-black text-stone-950 hover:bg-yellow-300"
                onClick={() => setShowExchangeWarning(false)}
                type="button"
              >
                閉じる
              </button>
            </section>
          </div>
        ) : null}

        {showWinOverlay ? (
          <button
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 text-center backdrop-blur-[2px]"
            onClick={() => setWinOverlayDismissed(true)}
            type="button"
            aria-label="勝利表示を閉じる"
          >
            <span className="relative inline-grid place-items-center">
              <span className="absolute h-44 w-44 rounded-full bg-emerald-400/25 blur-3xl sm:h-64 sm:w-64" />
              <span className="absolute h-28 w-72 rounded-full border border-brass/70 shadow-[0_0_48px_rgba(246,195,92,0.75)] sm:h-40 sm:w-[34rem]" />
              <span className="relative scale-105 text-5xl font-black text-brass drop-shadow-[0_6px_0_rgba(0,0,0,0.8)] sm:text-8xl">
                YOU WIN
              </span>
            </span>
          </button>
        ) : null}

        {draggingCard && dragPreviewPoint ? (
          <DraggingCardPreview card={draggingCard} point={dragPreviewPoint} />
        ) : null}

        {requiresExchangeBeforeStart && !exchangeApplied ? (
          <div className="mx-auto mb-4 flex max-w-4xl justify-end">
            <button
              className="grid min-h-11 place-items-center rounded border border-brass bg-black/35 px-4 text-sm font-black text-brass hover:bg-brass/10"
              data-high-low-prepare
              onClick={() => setShowPreparationVehicle(true)}
              onPointerDown={() => setShowPreparationVehicle(true)}
              type="button"
            >
              事前準備
            </button>
          </div>
        ) : null}

        <section className="mx-auto max-w-4xl rounded border border-emerald-200/20 bg-emerald-950/45 p-3 shadow-[inset_0_0_70px_rgba(0,0,0,0.35)] sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <HighLowZone
              canPlace={canPlaceCard && !placementPendingConfirm && !playerZone}
              label="HIGH"
              onPlace={() => placePlayerCard("HIGH")}
              playerPlaced={playerZone === "HIGH"}
              playerCard={playerZone === "HIGH" ? playerPlacedCard : null}
              placementAnimation={
                placementAnimation?.zone === "HIGH" ? placementAnimation : null
              }
              placeDisabled={robotZone === "HIGH"}
              spotlight={false}
              onDropCard={() => dropPlayerCard("HIGH")}
              robotPlaced={robotZone === "HIGH"}
              robotCard={robotZone === "HIGH" ? robotPlacedCard : null}
              tone="high"
            />
            <HighLowZone
              canPlace={canPlaceCard && !placementPendingConfirm && !playerZone}
              label="LOW"
              onPlace={() => placePlayerCard("LOW")}
              playerPlaced={playerZone === "LOW"}
              playerCard={playerZone === "LOW" ? playerPlacedCard : null}
              placementAnimation={
                placementAnimation?.zone === "LOW" ? placementAnimation : null
              }
              placeDisabled={robotZone === "LOW"}
              spotlight={isTutorial && tutorialStep.target === "player-card"}
              onDropCard={() => dropPlayerCard("LOW")}
              robotPlaced={robotZone === "LOW"}
              robotCard={robotZone === "LOW" ? robotPlacedCard : null}
              tone="low"
            />
          </div>

          {placementPendingConfirm ? (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded border border-brass/45 bg-black/35 p-3">
              <button
                className="min-h-11 rounded bg-brass px-4 text-sm font-black text-stone-950 hover:bg-yellow-300"
                onClick={confirmPlayerPlacement}
                type="button"
              >
                確定
              </button>
              <button
                className="min-h-11 rounded border border-white/15 bg-white/8 px-4 text-sm font-black text-white hover:bg-white/14"
                onClick={resetPlayerPlacement}
                type="button"
              >
                選び直し
              </button>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
            <HandPanel cards={visibleRobotHand} owner="Robot" side="robot" />
            <HandPanel
              cards={visiblePlayerHand}
              draggableCardIds={draggableCardIds}
              highlightedCardId={
                isTutorial && tutorialStep.target === "player-card"
                  ? tutorialPlayerCard?.id
                  : null
              }
              onCardDragEnd={endDraggingCard}
              onCardDragMove={moveDraggingCard}
              onCardDragStart={startDraggingCard}
              owner="Player"
              side="player"
            />
          </div>

          {isTutorial && tutorialStep.target === "player-card" ? (
            <TutorialBubble className="mt-3">{tutorialStep.text}</TutorialBubble>
          ) : null}

          {highLowResult ? (
            <div
              className={`mt-3 rounded border p-3 text-sm font-bold leading-6 ${
                highLowResult === "win"
                  ? "border-emerald-300 bg-emerald-950/55 text-emerald-100"
                  : "border-casinoRed bg-red-950/55 text-red-100"
              }`}
            >
              {getHighLowResultText(highZoneCard, lowZoneCard, highLowResult)}
            </div>
          ) : null}

          {isTutorial && highLowResult === "lose" ? (
            <div className="mt-3 flex justify-end">
              <button
                className="min-h-11 rounded bg-brass px-5 text-sm font-black text-stone-950 hover:bg-yellow-300"
                onClick={() => {
                  setShowPreparationVehicle(true);
                  setShowPreparation(false);
                  setShowPreparationIntro(true);
                  setHasEnteredPreparation(true);
                }}
                type="button"
              >
                次へ
              </button>
            </div>
          ) : null}

          {robotId === HIGH_LOW_TUTORIAL_ROBOT_ID && highLowResult === "win" ? (
            <div className="mt-3 flex justify-end">
              <Link
                className="grid min-h-11 place-items-center rounded bg-brass px-5 text-sm font-black text-stone-950 hover:bg-yellow-300"
                href="/?stage=1&battle=high-low&robot=high-low-1-2"
              >
                2戦目へ
              </Link>
            </div>
          ) : null}

          {robotId === "high-low-1-2" && highLowResult === "win" ? (
            <div className="mt-3 flex justify-end">
              <Link
                className="grid min-h-11 place-items-center rounded bg-brass px-5 text-sm font-black text-stone-950 hover:bg-yellow-300"
                href="/?stage=1&battle=high-low&robot=high-low-1-3"
              >
                3戦目へ
              </Link>
            </div>
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
              : "ロボットが先に配置しました。プレイヤーもHIGHかLOWを選べます。"
            : battleStarted
              ? "ロボットの配置を待っています。"
              : "ハイアンドロー画面に入ると、ロボットが先にカードを置きます。"}
        </div>
      </div>
    </div>
  );
}

function getCardsById(
  cardIds: string[],
  extraCards: Record<string, PlayingCard> = {},
) {
  return cardIds
    .map((cardId) => deck.find((card) => card.id === cardId) ?? extraCards[cardId])
    .filter((card): card is PlayingCard => Boolean(card));
}

function swapSelectedCardIds(cardIds: string[], selectedCardIds: string[]) {
  if (selectedCardIds.length !== 2) {
    return cardIds;
  }

  const [firstCardId, secondCardId] = selectedCardIds;

  return cardIds.map((cardId) => {
    if (cardId === firstCardId) {
      return secondCardId;
    }

    if (cardId === secondCardId) {
      return firstCardId;
    }

    return cardId;
  });
}

function applyExchangePairs(
  cardIds: string[],
  exchangePairs: Array<{ firstCardId: string; secondCardId: string }>,
) {
  return cardIds.map((cardId) => {
    const pair = exchangePairs.find(
      (item) => item.firstCardId === cardId || item.secondCardId === cardId,
    );

    if (!pair) {
      return cardId;
    }

    return pair.firstCardId === cardId ? pair.secondCardId : pair.firstCardId;
  });
}

function getModalText(modal: {
  gameType: GameType;
  kind: ModalKind;
  robot: Robot;
}) {
  if (modal.gameType === "blackjack") {
    return modal.kind === "rules" ? blackjackRuleText : blackjackSpecText;
  }

  return modal.kind === "rules" ? modal.robot.ruleText : modal.robot.specText;
}

function getBlackjackCardValue(card: PlayingCard) {
  const numericRank = Number(card.rank);

  if (Number.isFinite(numericRank)) {
    return numericRank;
  }

  return card.rank === "A" ? 11 : 10;
}

function getBlackjackScore(cards: PlayingCard[]) {
  return cards.reduce((total, card) => total + getBlackjackCardValue(card), 0);
}

function getBlackjackResult(playerCards: PlayingCard[], robotCards: PlayingCard[]) {
  if (getBlackjackScore(playerCards) === 21) {
    return "win";
  }

  const playerDistance = Math.abs(21 - getBlackjackScore(playerCards));
  const robotDistance = Math.abs(21 - getBlackjackScore(robotCards));

  if (playerDistance < robotDistance) {
    return "win";
  }

  if (playerDistance === robotDistance) {
    return "draw";
  }

  return "lose";
}

function getBlackjackRobotAction(
  playerFirstCard: PlayingCard | null,
  robotFirstCard: PlayingCard | null,
) {
  if (!playerFirstCard || !robotFirstCard) {
    return "call";
  }

  const robotIsTen = robotFirstCard.rank !== "A";

  if (playerFirstCard.rank === "A" && robotIsTen) {
    return "fold";
  }

  return "call";
}

function BlackjackField({
  cards,
  isBlackjack,
  label,
  placementAnimation = null,
  revealSecond,
  score,
}: {
  cards: PlayingCard[];
  isBlackjack: boolean;
  label: string;
  placementAnimation?: PlacementStyle | null;
  revealSecond: boolean;
  score: number | null;
}) {
  const firstCard = cards[0] ?? null;
  const secondCard = cards[1] ?? null;

  return (
    <div className="rounded border border-white/10 bg-black/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
          {label}
        </p>
        {score !== null ? (
          <span className="rounded bg-white px-2 py-1 text-xs font-black text-stone-950">
            {score}
          </span>
        ) : null}
      </div>
      <div className="relative mt-3 flex min-h-32 items-center justify-center gap-3 rounded border border-white/8 bg-emerald-950/25 p-3">
        {revealSecond && secondCard && isBlackjack ? (
          <div className="relative h-28 w-24 sm:h-40 sm:w-32">
            <div className="absolute left-0 top-0">
              <PlayingCardView card={firstCard ?? secondCard} size="zone" />
            </div>
            <div className="absolute left-3 top-3">
              <PlayingCardView card={secondCard} size="zone" />
            </div>
          </div>
        ) : (
          <>
            {firstCard ? <PlayingCardView card={firstCard} size="zone" /> : null}
            {revealSecond && secondCard ? (
              <PlayingCardView card={secondCard} size="zone" />
            ) : null}
          </>
        )}
        {placementAnimation ? (
          <CardPlacementAnimation styleType={placementAnimation} />
        ) : null}
      </div>
      {revealSecond && isBlackjack ? (
        <p className="mt-2 text-center text-sm font-black text-brass">
          ブラックジャック
        </p>
      ) : null}
    </div>
  );
}

function RiddlePrintTargetPicker({
  selectedIds,
  setSelectedIds,
}: {
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
}) {
  const targets = [
    {
      id: "riddle-1-middle-left",
      label: "中央行左側",
      style: "left-[13.5%] top-[44.5%] h-[30%] w-[13%]",
    },
    {
      id: "riddle-1-center",
      label: "ど真ん中",
      style: "left-[45.5%] top-[44.5%] h-[30%] w-[13%]",
    },
  ];

  function toggleTarget(targetId: string) {
    setSelectedIds((current) => {
      if (current.includes(targetId)) {
        return current.filter((id) => id !== targetId);
      }

      return [...current, targetId].slice(-2);
    });
  }

  return (
    <div className="mt-3 rounded border border-white/12 bg-white p-3 text-stone-950">
      <div className="relative overflow-hidden rounded border border-stone-300 bg-white">
        <Image
          alt="エクスチェンジ対象を選択する小謎"
          className="h-auto w-full"
          height={900}
          src="/riddles/riddle_1.png"
          width={1600}
        />
        {targets.map((target) => {
          const selected = selectedIds.includes(target.id);

          return (
            <button
              aria-pressed={selected}
              className={`absolute ${target.style} rounded border-2 transition ${
                selected
                  ? "border-emerald-400 bg-emerald-300/25 shadow-[0_0_0_4px_rgba(16,185,129,0.32)]"
                  : "border-brass/80 bg-brass/10 hover:bg-brass/25"
              }`}
              key={target.id}
              onClick={() => toggleTarget(target.id)}
              type="button"
            >
              <span className="absolute left-1 top-1 rounded bg-black/70 px-2 py-1 text-[10px] font-black text-white">
                {selected ? "SELECTED" : target.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm font-black text-stone-800">
        選択中:{" "}
        {selectedIds.length > 0
          ? targets
              .filter((target) => selectedIds.includes(target.id))
              .map((target) => target.label)
              .join(" / ")
          : "なし"}
      </p>
    </div>
  );
}

function ExchangeRuleList({
  disabledTargets = [],
  rankRestrictions = [],
  showDeckTarget = false,
  showFieldTarget = false,
  showVisiblePrintTarget = false,
  targetLabels = {},
  visiblePrintRemaining,
}: {
  disabledTargets?: ExchangeTargetId[];
  rankRestrictions?: string[];
  showDeckTarget?: boolean;
  showFieldTarget?: boolean;
  showVisiblePrintTarget?: boolean;
  targetLabels?: Partial<Record<ExchangeTargetId, string>>;
  visiblePrintRemaining?: number;
}) {
  const items: Array<{
    id: ExchangeTargetId;
    label: string;
    visible: boolean;
  }> = [
    {
      id: "player-hand",
      label: targetLabels["player-hand"] ?? "プレイヤーの手札",
      visible: true,
    },
    {
      id: "robot-hand",
      label: targetLabels["robot-hand"] ?? "ロボットの手札",
      visible: true,
    },
    {
      id: "deck",
      label: targetLabels.deck ?? "山札",
      visible: showDeckTarget,
    },
    {
      id: "field",
      label: targetLabels.field ?? "フィールド",
      visible: showFieldTarget,
    },
    {
      id: "visible-print",
      label:
        targetLabels["visible-print"] ??
        (visiblePrintRemaining === undefined
          ? "マークと数字の表記がある印刷面が全て見えているもの"
          : `マークと数字の表記がある印刷面が全て見えているもの：残${visiblePrintRemaining}`),
      visible: showVisiblePrintTarget,
    },
  ];

  return (
    <div className="mt-4 rounded border border-brass/35 bg-black/25 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
        現在交換可能な対象
      </p>
      <ul className="mt-2 space-y-2 text-sm font-bold leading-6 text-stone-100">
        {items
          .filter((item) => item.visible)
          .map((item) => {
            const disabled = disabledTargets.includes(item.id);

            return (
              <li
                className={`flex items-start gap-2 ${
                  disabled ? "text-stone-500 line-through decoration-2" : ""
                }`}
                key={item.id}
              >
                <span className="mt-0.5 text-brass">・</span>
                <span>{item.label}</span>
              </li>
            );
          })}
      </ul>
      <div className="mt-3 border-t border-white/10 pt-3 text-sm font-bold leading-6 text-stone-100">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
          エクスチェンジの発動タイミング
        </p>
        <p className="mt-2">・印刷面が同じ→即時</p>
        <p>・それ以外→ゲームスタート時</p>
      </div>
      {rankRestrictions.length > 0 ? (
        <div className="mt-3 border-t border-white/10 pt-3 text-sm font-bold leading-6 text-stone-100">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
            エクスチェンジ不可
          </p>
          {rankRestrictions.map((restriction) => (
            <p className="mt-2" key={restriction}>
              ・{restriction}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getHighLowCardValue(card: PlayingCard) {
  const rankValues = {
    "0": 0,
    "1": 0,
    "10": 0,
    J: 1,
    Q: 2,
    K: 3,
    A: 4,
  };

  return rankValues[card.rank];
}

function getRobotOpeningZone({
  isExchangeCorrect,
  isFinalHighLowBattle,
  isTutorial,
}: {
  isExchangeCorrect: boolean;
  isFinalHighLowBattle: boolean;
  isTutorial: boolean;
}): HighLowZoneName {
  if (isFinalHighLowBattle) {
    return "LOW";
  }

  if (isTutorial || isExchangeCorrect) {
    return "HIGH";
  }

  return Math.random() > 0.5 ? "HIGH" : "LOW";
}

function getHighLowResult(highCard: PlayingCard, lowCard: PlayingCard) {
  return getHighLowCardValue(highCard) >= getHighLowCardValue(lowCard)
    ? "win"
    : "lose";
}

function getHighLowResultText(
  highCard: PlayingCard | null,
  lowCard: PlayingCard | null,
  result: "win" | "lose",
) {
  if (!highCard || !lowCard) {
    return "";
  }

  const relation =
    result === "win"
      ? `${highCard.rank} >= ${lowCard.rank}`
      : `${highCard.rank} < ${lowCard.rank}`;

  return result === "win"
    ? `判定: ${relation}。HIGHとLOWの関係が成り立ったため、プレイヤーの勝利です。`
    : `判定: ${relation}。HIGHとLOWの関係が成り立たなかったため、プレイヤーの負けです。`;
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
        : "ロボットが先に配置しました。プレイヤーもHIGHかLOWを選べます。";
    }

    return battleStarted
      ? "ロボットの配置を待っています。"
      : "ハイアンドロー画面に入ると、ロボットが先にカードを置きます。";
  }

  if (playerZone === "LOW") {
    return "AをLOWゾーンに置きました。今回はロボットがHIGHゾーンにKを置いています。AはK以下なので、HIGH > LOW の関係が成り立たず負けです。";
  }

  if (canPlaceCard) {
    return "ロボットが即座にKをHIGHゾーンへ置きました。プレイヤーは手札のAをLOWゾーンに置いてみましょう。";
  }

  if (battleStarted) {
    return "ロボットの配置を待っています。";
  }

  return "ハイアンドロー画面に入ると、ロボットが先にカードを置きます。";
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
      text: "ロボットの配置を待っています。",
    };
  }

  return {
    target: "start",
    text: "ハイアンドロー画面に入ると、ロボットが先にカードを置きます。",
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
      text: "ロボットが先にKをHIGHゾーンへ置きました。手札のAをLOWゾーンへドラッグして置いてみましょう。",
    };
  }

  if (battleStarted) {
    return {
      target: "trigger",
      text: "ロボットの配置を待っています。",
    };
  }

  return {
    target: "start",
    text: "ハイアンドロー画面に入ると、ロボットが先にカードを置きます。",
  };
}

function HighLowZone({
  canPlace,
  label,
  onDropCard,
  onPlace,
  placeDisabled,
  placementAnimation,
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
  placeDisabled: boolean;
  placementAnimation?: {
    mode: "hold" | "release";
    styleType: PlacementStyle;
  } | null;
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
      className={`relative grid min-h-32 place-items-center rounded border-2 border-dashed p-2 text-center sm:min-h-52 sm:p-4 ${
        tone === "high"
          ? "border-casinoRed/80 bg-red-950/20"
          : "border-sky-300/80 bg-sky-950/20"
      } ${canUsePlace ? "cursor-pointer" : ""} ${
        spotlight ? "animate-pulse ring-4 ring-brass/70" : ""
      }`}
      onClick={() => {
        if (canUsePlace && !playerPlaced) {
          onPlace();
        }
      }}
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
      <span className="absolute left-2 top-1/2 flex -translate-y-1/2 flex-col items-center text-lg font-black leading-none text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] sm:left-5 sm:text-4xl">
        {label.split("").map((letter, index) => (
          <span key={`${label}-${letter}-${index}`}>{letter}</span>
        ))}
      </span>
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
        {placedCard ? <PlayingCardView card={placedCard} size="zone" /> : null}
      </div>
      {placementAnimation ? (
        <CardPlacementAnimation
          mode={placementAnimation.mode}
          styleType={placementAnimation.styleType}
        />
      ) : null}
      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1 sm:inset-x-3 sm:bottom-3 sm:gap-2">
        {robotPlaced ? (
          <span className="rounded bg-brass px-2 py-1 text-xs font-black text-stone-950">
            ROBOT
          </span>
        ) : (
          <span />
        )}
        {playerPlaced ? (
          <span
            className="rounded bg-emerald-500 px-2 py-2 text-xs font-black text-stone-950 sm:px-3"
          >
            PLACED
          </span>
        ) : null}
      </div>
    </div>
  );
}

function HandPanel({
  cards,
  draggableCardIds = [],
  highlightedCardId = null,
  onCardDragEnd,
  onCardDragMove,
  onCardDragStart,
  owner,
  side,
}: {
  cards: PlayingCard[];
  draggableCardIds?: string[];
  highlightedCardId?: string | null;
  onCardDragEnd?: () => void;
  onCardDragMove?: (point: { x: number; y: number } | null) => void;
  onCardDragStart?: (cardId: string, point: { x: number; y: number } | null) => void;
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
            onDragEnd={onCardDragEnd}
            onDragMove={onCardDragMove}
            onDragStart={(point) => onCardDragStart?.(card.id, point)}
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
    ? "h-10 w-36 max-[424px]:h-9 max-[424px]:w-32 max-[374px]:h-8 max-[374px]:w-28"
    : "h-32 w-[360px] max-w-full max-[424px]:h-20 max-[424px]:w-[210px] max-[374px]:h-16 max-[374px]:w-[180px] sm:h-48 sm:w-[620px]";
  const imageSizes = compact
    ? "(max-width: 374px) 112px, (max-width: 424px) 128px, 144px"
    : "(min-width: 640px) 620px, (max-width: 374px) 180px, (max-width: 424px) 210px, 360px";

  return (
    <div
      className={`relative overflow-hidden rounded bg-white p-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.75)] ${
        compact ? "border border-stone-200" : ""
      } ${sizeClass}`}
    >
      <Image
        alt={`${logo.alt}のロゴ`}
        className="object-contain p-1"
        fill
        priority
        sizes={imageSizes}
        src={logo.src}
      />
    </div>
  );
}

function PlayingCardView({
  card,
  draggable = false,
  highlighted = false,
  onDragEnd,
  onDragMove,
  onDragStart,
  size,
}: {
  card: PlayingCard;
  draggable?: boolean;
  highlighted?: boolean;
  onDragEnd?: () => void;
  onDragMove?: (point: { x: number; y: number } | null) => void;
  onDragStart?: (point: { x: number; y: number } | null) => void;
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
      ? "h-24 w-[4.25rem] sm:h-36 sm:w-24"
      : size === "field"
        ? "h-16 w-11 sm:h-20 sm:w-14"
      : "h-20 w-14 sm:h-24 sm:w-16";
  function startCardDrag(event: DragEvent<HTMLDivElement>) {
    if (!draggable) {
      return;
    }

    const transparentPreview = document.createElement("img");
    transparentPreview.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.id);
    event.dataTransfer.setDragImage(transparentPreview, 0, 0);
    onDragStart?.(getDragPoint(event));
  }

  function moveCardDrag(event: DragEvent<HTMLDivElement>) {
    if (draggable) {
      onDragMove?.(getDragPoint(event));
    }
  }

  if (card.imageSrc && !imageFailed) {
    return (
      <div
        className={`relative overflow-hidden rounded border border-brass bg-stone-50 shadow ${sizeClass} ${
          highlighted ? "animate-pulse ring-4 ring-brass/70" : ""
        } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
        draggable={draggable}
        onDrag={moveCardDrag}
        onDragEnd={onDragEnd}
        onDragStart={startCardDrag}
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
      onDrag={moveCardDrag}
      onDragEnd={onDragEnd}
      onDragStart={startCardDrag}
    >
      <span className="text-2xl leading-none sm:text-3xl">{card.rank}</span>
      <span className="text-lg leading-none sm:text-xl">{suitSymbols[card.suit]}</span>
    </div>
  );
}

function getDragPoint(event: DragEvent<HTMLDivElement>) {
  if (event.clientX === 0 && event.clientY === 0) {
    return null;
  }

  return {
    x: event.clientX,
    y: event.clientY,
  };
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
