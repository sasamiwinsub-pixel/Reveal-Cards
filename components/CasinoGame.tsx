"use client";

import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Info,
  Lightbulb,
  Map as MapIcon,
  Menu,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import Image from "next/image";
import FinalSituationReview from "./FinalSituationReview";
import { resolvePaste } from "@/lib/copy-paste";
import { normalizeScanIllustrationName } from "@/lib/scan-input";
import { getFinalPhysicalScanReading, resolveFinalPhysicalScanSplit, isPhysicalScanSelectionValid } from "@/lib/physical-scan";
import { getGuaranteedWinOpening } from "@/lib/high-low-opening";
import { shouldShowReservedExchange } from "@/lib/exchange-timing";
import { getBlackjackOrderValue, isLargestBlackjackCard } from "@/lib/blackjack-order";
import { applyExchangePairs } from "@/lib/card-exchange";
import { clearStageSession, useSessionState } from "@/lib/session-state";
import { isFinalGameClear } from "@/lib/final-clear";
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  blackjackRuleText,
  blackjackSpecText,
  createDeck,
  drawOpeningHand,
  getGameSeat,
  getGameLabel,
  getStageTableGameType,
  getRobotGameTypes,
  highLowRuleText,
  highLowSpecText,
  pokerBettingSpecText,
  pokerRuleText,
  pokerSpecText,
  stages,
  type GameType,
  type PlayingCard,
  type Robot,
  type Seat,
  type Stage,
} from "@/lib/game-data";

type Outcome = "win" | "draw" | "lose";
type ModalKind = "rules" | "spec";
type GlobalNavAction = "battle" | "preparation";
type PokerHandCategory = "none" | "one-pair" | "two-pair" | "three-card" | "four-card";
type PokerHandEvaluation = {
  category: PokerHandCategory;
  label: string;
  score: number;
  tiebreakers: number[];
};

const GLOBAL_NAV_EVENT = "cacacasino-global-nav-action";

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
    alt: "ハイ＆ロー",
    src: "/game-logos/high-low.png",
  },
};

const HIGH_LOW_TUTORIAL_ROBOT_ID = "high-low-1-1";
const GAME_SELECT_TUTORIAL_STORAGE_KEY =
  "cacacasino.gameSelectTutorialSeen";
const GAME_SELECT_TUTORIAL_STORAGE_EVENT =
  "cacacasino-game-select-tutorial-seen";
const deck = createDeck();
let gameSelectTutorialSeenMemory = false;

function subscribeGameSelectTutorialSeen(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(GAME_SELECT_TUTORIAL_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(
      GAME_SELECT_TUTORIAL_STORAGE_EVENT,
      onStoreChange,
    );
  };
}

function getGameSelectTutorialSeenSnapshot() {
  try {
    if (
      window.localStorage?.getItem(GAME_SELECT_TUTORIAL_STORAGE_KEY) === "true"
    ) {
      gameSelectTutorialSeenMemory = true;
    }
  } catch {
    // Some embedded browser contexts do not expose storage.
  }

  return gameSelectTutorialSeenMemory;
}

function getGameSelectTutorialSeenServerSnapshot() {
  return false;
}

function markGameSelectTutorialSeen() {
  gameSelectTutorialSeenMemory = true;

  try {
    window.localStorage?.setItem(GAME_SELECT_TUTORIAL_STORAGE_KEY, "true");
  } catch {
    // Some embedded browser contexts do not expose storage.
  }

  window.dispatchEvent(new Event(GAME_SELECT_TUTORIAL_STORAGE_EVENT));
}

const scanTargetImages = {
  hijack: "/scan-targets/hijack.png",
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
    robotOpeningCardId: "J-spade",
    robotOpeningZone: "HIGH",
  },
  "high-low-1-3": {
    correctExchangePairs: [
      ["A-spade", "Q-heart"],
      ["A-spade", "Q-daia"],
    ],
    initialPlayerHandIds: ["Q-heart", "Q-daia"],
    initialRobotHandIds: ["A-spade", "K-heart"],
    robotHighCardAfterExchangeId: "K-heart",
    robotOpeningCardId: "A-spade",
    robotOpeningZone: "LOW",
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
    scanTargetCardId: "scan-10",
  },
  "blackjack-2-3": {
    highLowRobotHandIds: ["K-crub", "Q-crub"],
    initialPlayerHandIds: ["K-spade", "Q-heart"],
    initialRobotHandIds: ["Q-daia", "scan-10"],
    learningRestriction:
      "勝利後条件変更：自分の手札はエクスチェンジできない",
    scanTargetCardId: "scan-A",
  },
  "blackjack-high-low-2-3": {
    highLowRobotHandIds: ["K-crub", "Q-crub"],
    initialPlayerHandIds: ["K-spade", "Q-heart"],
    initialRobotHandIds: ["Q-daia", "scan-10"],
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
      "自分のクイーンとブラックジャックロボットのキングを交換済み。ポーカーはキングのスリーカード、ハイ＆ローはAでもKでも後出しで成立、ブラックジャックはA+K=21で勝利できます。",
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
      "スキャンで生成した0をブラックジャックロボットのJ、生成したAを自分のKと交換済み。ハイ＆ローはAを出せば成立し、ブラックジャックはロボット側が10+0、ポーカーはAのスリーカードでKのスリーカードを上回る形になります。",
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
      "ブラックジャックロボットのAを0へ変更済み。ハイ＆ローはそのまま勝利、ブラックジャックは自分がK+Q=20でロボットが0+J=10、ポーカーはロボットの勝率が0%のため0chipを賭け、そのままプレイヤーの勝利です。",
  },
  "all-games-last": {
    blackjackRobotHandIds: ["K-heart", "Q-daia"],
    exchangePairs: [],
    fieldCardIds: ["A-crub", "K-spade", "K-daia", "J-crub"],
    highLowRobotHandIds: ["Q-heart", "K-crub"],
    initialPlayerHandIds: ["A-daia", "J-heart"],
    initialRobotHandIds: ["A-spade", "A-heart"],
    maxCopyPastes: 4,
    maxExchanges: 2,
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
        targetImageSrc: scanTargetImages.hijack,
      },
    ],
    successText:
      "ブラックジャック宣言のタイミングでエクスチェンジが発動済み。ポーカーロボットもオールインし、プレイヤーはK2枚、フィールドにもK2枚があるため、Kフォーカードでポーカーロボットに勝利できます。",
  },
} as const;

type ActiveBattle = {
  gameType: GameType;
  robotId: string;
};

type HighLowExchangePreparation = {
  applied: boolean;
  cardIds: string[];
  confirmed: boolean;
};

type ExchangeCardSection = {
  cards: PlayingCard[];
  disabled?: boolean;
  displayOnly?: boolean;
  id: string;
  interactionDisabled?: boolean;
  label: string;
};

function GlobalGameHeader({
  activeBattle,
  currentObjective,
  isMenuOpen,
  onCloseMenu,
  onGoToBattle,
  onGoToPreparation,
  onGoToSelect,
  onResetStage,
  onToggleMenu,
  onOpenVenueMap,
  highlightVenueMap,
  stageId,
}: {
  activeBattle: ActiveBattle | null;
  currentObjective: string;
  isMenuOpen: boolean;
  onCloseMenu: () => void;
  onGoToBattle: () => void;
  onGoToPreparation: () => void;
  onGoToSelect: () => void;
  onResetStage: () => void;
  onToggleMenu: () => void;
  onOpenVenueMap: () => void;
  highlightVenueMap: boolean;
  stageId: number;
}) {
  const hasBattle = activeBattle !== null;
  const objectiveTaps = useRef({ count: 0, lastTap: 0 });
  const [showDevelopmentStory, setShowDevelopmentStory] = useState(false);
  useEffect(() => {
    function resetTaps(event: PointerEvent) {
      if (!(event.target instanceof Element) || !event.target.closest("[data-objective-tap]")) {
        objectiveTaps.current = { count: 0, lastTap: 0 };
      }
    }
    document.addEventListener("pointerdown", resetTaps);
    return () => document.removeEventListener("pointerdown", resetTaps);
  }, []);

  function tapObjective() {
    if (stageId !== 4) {
      objectiveTaps.current = { count: 0, lastTap: 0 };
      return;
    }
    const now = Date.now();
    const count = now - objectiveTaps.current.lastTap <= 1500 ? objectiveTaps.current.count + 1 : 1;
    objectiveTaps.current = { count, lastTap: now };
    if (count === 5) {
      objectiveTaps.current = { count: 0, lastTap: 0 };
      setShowDevelopmentStory(true);
    }
  }

  return (
    <>
      {stageId === 4 && showDevelopmentStory ? (
        <TutorialDialog
          onDismiss={() => setShowDevelopmentStory(false)}
          tone="spec"
          text={<><span className="mb-3 block text-lg font-black">ゲームの開発秘話</span><DevelopmentStoryText /></>}
        />
      ) : null}
    <header className="sticky top-0 z-40 -mx-3 mb-3 border-b border-white/12 bg-stone-950/95 px-3 py-2 shadow-2xl backdrop-blur max-[424px]:-mx-2 max-[374px]:-mx-1.5 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <button className="min-w-0 flex-1 text-left" data-objective-tap onClick={tapObjective} type="button" aria-label="やること">
          <p className="text-[10px] font-black tracking-[0.18em] text-brass">
            やること
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-black leading-6 text-red-300 sm:text-base">
            {currentObjective}
          </p>
        </button>
        <div className="relative shrink-0">
          <button
            aria-expanded={isMenuOpen}
            aria-label="ナビゲーションメニューを開く"
            className="grid h-11 w-11 place-items-center rounded border border-sky-200/55 bg-sky-950/90 text-sky-100 shadow-[0_0_18px_rgba(125,211,252,0.32)] hover:bg-sky-900"
            onClick={onToggleMenu}
            type="button"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {isMenuOpen ? (
            <div className="absolute right-0 top-12 w-64 rounded border border-white/14 bg-stone-950 p-3 text-white shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brass">
                ショートカット
              </p>
              <div className="mt-3 grid gap-2">
                <GlobalNavButton
                  disabled={!hasBattle}
                  label="対戦画面へ"
                  onClick={onGoToBattle}
                />
                <GlobalNavButton label="ゲーム会場へ" onClick={onGoToSelect} />
                <GlobalNavButton
                  disabled={!hasBattle}
                  label="事前準備へ"
                  onClick={onGoToPreparation}
                />
                <button
                  className={`flex min-h-10 items-center justify-center gap-2 rounded border px-3 text-sm font-black ${highlightVenueMap ? "border-sky-900 bg-sky-300 text-stone-950 ring-4 ring-sky-400 shadow-[0_0_24px_rgba(14,165,233,0.8)]" : "border-sky-200/55 bg-sky-950 text-sky-100 hover:bg-sky-900"}`}
                  onClick={onOpenVenueMap}
                  type="button"
                >
                  <MapIcon aria-hidden="true" size={16} />会場MAP
                </button>
                <button
                  className="flex min-h-10 items-center justify-center gap-2 rounded border border-brass/50 bg-brass/10 px-3 text-sm font-black text-brass hover:bg-brass/20"
                  type="button"
                >
                  <Lightbulb aria-hidden="true" size={16} />
                  ヒント
                </button>
                <button
                  className="mt-1 flex min-h-10 items-center justify-center gap-2 rounded border border-white/14 bg-white/8 px-3 text-sm font-black text-stone-100 hover:bg-white/14"
                  onClick={onResetStage}
                  type="button"
                >
                  <RotateCcw size={16} />
                  ステージをリセット
                </button>
              </div>
              <button
                className="mt-3 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-stone-300 hover:bg-white/10"
                onClick={onCloseMenu}
                type="button"
              >
                閉じる
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
    </>
  );
}

function GlobalNavButton({
  disabled = false,
  label,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`min-h-10 rounded px-3 text-sm font-black ${
        disabled
          ? "cursor-not-allowed bg-stone-800 text-stone-500"
          : "bg-brass text-stone-950 hover:bg-yellow-300"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function GameInfoButtons({
  gameType,
  onOpenModal,
  robot,
}: {
  gameType: GameType;
  onOpenModal: (kind: ModalKind, gameType: GameType) => void;
  robot: Robot;
}) {
  const gameLabel = getGameLabel(gameType);

  return (
    <div className="flex items-center gap-1">
      <button
        aria-label={`${robot.name}の${gameLabel}ルール`}
        className="grid h-8 w-8 place-items-center rounded border border-sky-200/70 bg-sky-950/70 text-sky-100 hover:bg-sky-900"
        onClick={() => onOpenModal("rules", gameType)}
        title="ルール"
        type="button"
      >
        <BookOpen size={15} />
      </button>
      <button
        aria-label={`${robot.name}の${gameLabel}仕様`}
        className="grid h-8 w-8 place-items-center rounded border border-emerald-200/70 bg-emerald-950/70 text-emerald-100 hover:bg-emerald-900"
        onClick={() => onOpenModal("spec", gameType)}
        title="仕様"
        type="button"
      >
        <Info size={15} />
      </button>
    </div>
  );
}

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

const BlueTextSelectionContext = createContext<{
  active: boolean;
  selectedId: string | null;
  replacements: Record<string, string>;
  allowRiddleCopy?: boolean;
  onSelect: (id: string, text: string) => void;
} | null>(null);

function SelectableBlueText({ id, children }: { id: string; children: string }) {
  const selection = useContext(BlueTextSelectionContext);
  const text = selection?.replacements[id] ?? children;
  return selection?.active ? (
    <button
      className={`rounded px-1 font-black text-sky-300 underline underline-offset-4 hover:bg-sky-400/20 ${selection.selectedId === id ? "ring-2 ring-sky-300" : ""}`}
      onClick={() => selection.onSelect(id, text)}
      type="button"
    >
      {text}
    </button>
  ) : (
    <span className="font-black text-sky-300">{text}</span>
  );
}
type ExchangeTargetId =
  | "player-hand"
  | "robot-hand"
  | "deck"
  | "field"
  | "visible-print";

const generatedScanCards: Record<string, PlayingCard> = {
  "scan-0": {
    id: "scan-0",
    imageSrc: "/cards/cropped/0_spade.png",
    rank: "0",
    suit: "spade",
  },
  "scan-3": {
    id: "scan-3",
    imageSrc: "/cards/cropped/3_spade.png",
    rank: "3",
    suit: "spade",
  },
  "scan-9": {
    id: "scan-9",
    imageSrc: "/cards/cropped/9_spade.png",
    rank: "9",
    suit: "spade",
  },
  "scan-10": {
    id: "scan-10",
    imageSrc: "/cards/cropped/10_spade.png",
    rank: "10",
    suit: "spade",
  },
  "scan-12": {
    id: "scan-12",
    imageSrc: "/cards/cropped/Q_spade.png",
    rank: "Q",
    suit: "spade",
  },
  "scan-A": {
    id: "scan-A",
    imageSrc: "/cards/cropped/A_spade.png",
    rank: "A",
    suit: "spade",
  },
  "scan-J": {
    id: "scan-J",
    imageSrc: "/cards/cropped/J_spade.png",
    rank: "J",
    suit: "spade",
  },
  "scan-K": {
    id: "scan-K",
    imageSrc: "/cards/cropped/K_spade.png",
    rank: "K",
    suit: "spade",
  },
};

const physicalScanTripleFiveInventoryCards: PlayingCard[] = [
  {
    id: "physical-queen-spade",
    imageSrc: "/cards/cropped/Q_spade.png",
    rank: "Q",
    suit: "spade",
  },
  ...[1, 2, 3].map((index) => ({
    id: `physical-5-spade-${index}`,
    imageSrc: "/cards/cropped/5_spade.png",
    rank: "5" as const,
    suit: "spade" as const,
  })),
];

const physicalScanQueenPairInventoryCards = physicalScanTripleFiveInventoryCards.filter(
  (card) => card.rank === "Q",
);

const physicalScanConfigs = {
  "blackjack-2-2": {
    errorMessage:
      "現物スキャンするカードをもう一度確認してください。5のカード3枚を指定しましょう。",
    generatedCardId: "scan-3",
    generatedLabel: "3のカードを生成済み",
    guideText:
      "クイーンのカード1枚と5のカード3枚をアイテムとして渡そう。\n5のカード3枚をポーカーの役として現物スキャンしてみると良い",
    inventoryCards: physicalScanTripleFiveInventoryCards,
    prompt:
      "5のカード3枚を指定して、ポーカーのスリーカードとして現物スキャンを発動しましょう。",
    requiredSelectionCount: 3,
    readingPrompt:
      "通常のスキャンと同じく、数字として読みたい単語の区切り位置にスラッシュを入れてください。",
    requiredReading: "スリー/カード",
    roleName: "スリーカード",
    successMessage:
      "現物スキャン成功。ポーカーの役として5のカード3枚を読み取り、3のカードを生成しました。",
  },
  "blackjack-2-3": {
    errorMessage:
      "現物スキャンするカードをもう一度確認してください。クイーンのカード2枚を指定しましょう。",
    generatedCardId: "scan-A",
    generatedLabel: "Aのカードを生成済み",
    guideText: "",
    inventoryCards: physicalScanQueenPairInventoryCards,
    prompt: "",
    readingPrompt:
      "通常のスキャンと同じく、数字として読みたい単語の区切り位置にスラッシュを入れてください。",
    requiredReading: "ワン/ペア",
    requiredSelectionCount: 2,
    roleName: "ワンペア",
    successMessage:
      "現物スキャン成功。ポーカーの役としてクイーンのワンペアを読み取り、Aのカードを生成しました。",
  },
} as const;

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
    generatedNumber: "10",
    id: "scan-catalog-vital-0315",
    illustrationName: "じゅう　しょ",
    targetImageSrc: scanTargetImages.jyuusho,
  },
  {
    answer: "ななめ",
    ability: "エクスチェンジ",
    generated: true,
    generatedNumber: "9",
    id: "scan-catalog-address-exchange",
    illustrationName: "きゅう　しょ",
    targetImageSrc: scanTargetImages.kyuusho,
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
    generated: true,
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
    targetImageSrc: scanTargetImages.hijack,
  },
];

function normalizeRiddleAnswer(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[\u30a1-\u30f6]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60),
    )
    .toLowerCase();
}

function getCheckedInputClass(value: string, result: boolean | null) {
  const base =
    "min-h-11 rounded border bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none";

  if (result === true) {
    return `${base} border-emerald-400 ring-4 ring-emerald-400/25`;
  }

  if (result === false) {
    return `${base} border-red-400 ring-4 ring-red-400/25`;
  }

  if (value.trim()) {
    return `${base} border-white/40`;
  }

  return `${base} animate-pulse border-brass ring-4 ring-brass/30`;
}

function CheckResultText({ result }: { result: boolean | null }) {
  if (result === true) {
    return <span className="text-xs font-black text-emerald-300">正解</span>;
  }

  if (result === false) {
    return (
      <span className="text-xs font-black text-red-300">
        もう一度確認してください
      </span>
    );
  }

  return null;
}

// Set to true to restore scan discovery after the final disclosure.
// const ENABLE_FINAL_DISCOVERY_PHASE = true;
const ENABLE_FINAL_DISCOVERY_PHASE = false;

const finalBattleDisclosureSections: ExchangeCardSection[] = [
  {
    cards: getCardsById(["A-daia", "J-heart"]),
    id: "final-player-hand",
    label: "自分の手札",
  },
  {
    cards: getCardsById(["Q-heart", "K-crub"]),
    id: "final-high-low-robot-hand",
    label: "ハイ＆ローのロボット手札",
  },
  {
    cards: getCardsById(["K-heart", "Q-daia"]),
    id: "final-blackjack-robot-hand",
    label: "ブラックジャックのロボット手札",
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
];

export default function CasinoGame(props: Parameters<typeof CasinoGameSession>[0]) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? <CasinoGameSession {...props} /> : null;
}

function CasinoGameSession({
  initialBattle = null,
  initialStageId = 1,
  initialPokerBettingTutorial = false,
  initialGameSelectTutorial = false,
}: {
  initialBattle?: ActiveBattle | null;
  initialStageId?: number;
  initialPokerBettingTutorial?: boolean;
  initialGameSelectTutorial?: boolean;
}) {
  const initialStage = stages.find((item) => item.id === initialStageId) ?? stages[0];
  const [stageId, setStageId] = useState(initialStage.id);
  const [hasCompletedNewGameTutorial, setHasCompletedNewGameTutorial] = useSessionState(`stage-${stageId}:CasinoGame:hasCompletedNewGameTutorial`, false);
  const [, setChips] = useSessionState(`stage-${stageId}:CasinoGame:Chips`, initialStage.startingChips);
  const [, setPlayedRobotIds] = useSessionState<string[]>(`stage-${stageId}:CasinoGame:PlayedRobotIds`, []);
  const [pokerScanCount, setPokerScanCount] = useSessionState(`stage-${stageId}:CasinoGame:pokerScanCount`, 0);
  const [showPokerBettingTutorial, setShowPokerBettingTutorial] = useSessionState(`stage-${stageId}:CasinoGame:showPokerBettingTutorial`, initialPokerBettingTutorial);
  const [isPokerBettingRevealed, setIsPokerBettingRevealed] = useSessionState(
    `stage-${stageId}:CasinoGame:isPokerBettingRevealed`, initialPokerBettingTutorial || initialBattle?.robotId === "poker-3-3",
  );
  const [activeBattle, setActiveBattle] = useSessionState<ActiveBattle | null>(
    `stage-${stageId}:CasinoGame:activeBattle`, initialBattle ? { ...initialBattle, gameType: getStageTableGameType(initialStage.id) } : null,
  );
  const [isVenueVisible, setIsVenueVisible] = useSessionState(`stage-${stageId}:CasinoGame:isVenueVisible`, false);
  const [
    hasReachedHighLowTutorialLosePart,
    setHasReachedHighLowTutorialLosePart,
  ] = useSessionState(`stage-${stageId}:CasinoGame:hasReachedHighLowTutorialLosePart`, false);
  const [focusedOptionIndex, setFocusedOptionIndex] = useSessionState(`stage-${stageId}:CasinoGame:focusedOptionIndex`, 0);
  const [venueGameType, setVenueGameType] = useSessionState<GameType>(
    `stage-${stageId}:CasinoGame:venueGameType`, initialStage.id === 1 ? "high-low" : initialStage.id === 3 ? "poker" : "blackjack",
  );
  const [highLowExchangePreparations, setHighLowExchangePreparations] =
    useSessionState<Record<string, HighLowExchangePreparation>>(`stage-${stageId}:CasinoGame:highLowExchangePreparations`, {});
  const [finalScanCatalogEntries, setFinalScanCatalogEntries] = useSessionState<
    ScanCatalogEntry[]
  >(`stage-${stageId}:CasinoGame:finalScanCatalogEntries`, initialScanCatalogEntries);
  const [isFinalDisclosureSeen, setIsFinalDisclosureSeen] = useSessionState(`stage-${stageId}:CasinoGame:isFinalDisclosureSeen`, false);
  const [isFinalScanCatalogComplete, setIsFinalScanCatalogComplete] =
    useSessionState(`stage-${stageId}:CasinoGame:isFinalScanCatalogComplete`, false);
  const [isFinalAbilitySpecSeen, setIsFinalAbilitySpecSeen] = useSessionState(`stage-${stageId}:CasinoGame:isFinalAbilitySpecSeen`, false);
  const [isRiddleExchangeTimingRevealed, setIsRiddleExchangeTimingRevealed] =
    useSessionState(`stage-${stageId}:CasinoGame:isRiddleExchangeTimingRevealed`, false);
  const [showBlackjackUnlockDialog, setShowBlackjackUnlockDialog] =
    useSessionState(`stage-${stageId}:CasinoGame:showBlackjackUnlockDialog`, initialStage.id === 2 && !initialBattle);
  const [showPokerUnlockDialog, setShowPokerUnlockDialog] =
    useSessionState(`stage-${stageId}:CasinoGame:showPokerUnlockDialog`, initialStage.id === 3 && !initialBattle);
  const [isGlobalMenuOpen, setIsGlobalMenuOpen] = useState(false);
  const [isVenueMapOpen, setIsVenueMapOpen] = useState(false);
  const [isVenueMapRequired, setIsVenueMapRequired] = useSessionState(`stage-${stageId}:CasinoGame:isVenueMapRequired`, false);
  const [showVenueMapInstruction, setShowVenueMapInstruction] = useSessionState(`stage-${stageId}:CasinoGame:showVenueMapInstruction`, false);
  const [venueMapCloseSignal, setVenueMapCloseSignal] = useSessionState(`stage-${stageId}:CasinoGame:venueMapCloseSignal`, 0);
  const requestVenueMapTutorial = useCallback(() => {
    setIsVenueMapRequired(true);
    setShowVenueMapInstruction(true);
  }, []);
  const [hasShownTableHandInfoDialog, setHasShownTableHandInfoDialog] =
    useSessionState(`stage-${stageId}:CasinoGame:hasShownTableHandInfoDialog`, false);
  const hasShownGameSelectTutorial = useSyncExternalStore(
    subscribeGameSelectTutorialSeen,
    getGameSelectTutorialSeenSnapshot,
    getGameSelectTutorialSeenServerSnapshot,
  );

  const stage = stages.find((item) => item.id === stageId) ?? stages[0];
  const hand = useMemo(() => drawOpeningHand(stage.id), [stage.id]);
  const boundedFocusedOptionIndex = Math.min(
    focusedOptionIndex,
    Math.max(stage.robots.length - 1, 0),
  );
  const focusedRobot = stage.robots[boundedFocusedOptionIndex] ?? null;
  const isVenueGameUnlocked = venueGameType === "high-low" ||
    (venueGameType === "blackjack" && stage.id >= 2) ||
    (venueGameType === "poker" && stage.id >= 3);
  const canFocusPrevious = true;
  const canFocusNext = true;
  const activeBattleRobot =
    stage.robots.find((robot) => robot.id === activeBattle?.robotId) ?? null;
  const isHighLowBattle = activeBattle?.gameType === "high-low" && activeBattleRobot;
  const isBlackjackBattle =
    activeBattle?.gameType === "blackjack" && activeBattleRobot;
  const isPokerBattle = activeBattle?.gameType === "poker" && activeBattleRobot;
  const shouldShowFinalDisclosure =
    stage.id === 4 &&
    !activeBattle &&
    !isFinalDisclosureSeen &&
    !isFinalScanCatalogComplete;
  const shouldShowFinalScanCatalog =
    ENABLE_FINAL_DISCOVERY_PHASE &&
    stage.id === 4 &&
    !activeBattle &&
    isFinalDisclosureSeen &&
    !isFinalScanCatalogComplete;
  const shouldShowFinalAbilitySpec =
    ENABLE_FINAL_DISCOVERY_PHASE &&
    stage.id === 4 &&
    !activeBattle &&
    isFinalDisclosureSeen &&
    isFinalScanCatalogComplete &&
    !isFinalAbilitySpecSeen;
  const shouldShowTableHandInfoDialog =
    activeBattle?.gameType === "high-low" &&
    activeBattle.robotId === HIGH_LOW_TUTORIAL_ROBOT_ID &&
    !hasShownTableHandInfoDialog;
  const [modal, setModal] = useSessionState<{
    gameType: GameType;
    kind: ModalKind;
    robot: Robot;
  } | null>(`stage-${stageId}:CasinoGame:modal`, null);
  const [expandedGuideImage, setExpandedGuideImage] = useSessionState<{
    alt: string;
    src: string;
  } | null>(`stage-${stageId}:CasinoGame:expandedGuideImage`, null);
  const [modalCloseSignal, setModalCloseSignal] = useSessionState(`stage-${stageId}:CasinoGame:modalCloseSignal`, 0);

  function closeModal() {
    window.dispatchEvent(new Event("casino-rule-modal-closed"));
    setModalCloseSignal((current) => current + 1);
    setModal(null);
  }

  function goToStage(nextStageId: number, options: { replace?: boolean } = {}) {
    const destinationStage =
      stages.find((item) => item.id === nextStageId) ?? stage;
    const stageUrl = `/?stage=${destinationStage.id}`;
    clearStageSession(destinationStage.id);

    setStageId(destinationStage.id);
    setShowPokerBettingTutorial(false);
    setIsPokerBettingRevealed(false);
    setChips(destinationStage.startingChips);
    setPlayedRobotIds([]);
    setActiveBattle(null);
    setIsVenueVisible(false);
    setHasReachedHighLowTutorialLosePart(false);
    setFocusedOptionIndex(0);
    setVenueGameType(destinationStage.id === 1 ? "high-low" : destinationStage.id === 3 ? "poker" : "blackjack");
    setModal(null);
    setHighLowExchangePreparations({});
    setIsFinalDisclosureSeen(false);
    setIsFinalScanCatalogComplete(false);
    setIsFinalAbilitySpecSeen(false);
    setIsRiddleExchangeTimingRevealed(false);
    setShowBlackjackUnlockDialog(destinationStage.id === 2);
    setShowPokerUnlockDialog(destinationStage.id === 3);

    if (options.replace) {
      window.history.replaceState(null, "", stageUrl);
    } else {
      window.history.pushState(null, "", stageUrl);
    }
  }

  function resetCurrentStage() {
    goToStage(stage.id, { replace: true });
  }

  function focusRobot(offset: number) {
    const games: GameType[] = ["high-low", "blackjack", "poker"];
    setVenueGameType((current) => {
      const next = (games.indexOf(current) - offset + games.length) % games.length;
      return games[next];
    });
  }

  function selectRobot(robot: Robot) {
    if (!isVenueGameUnlocked) {
      return;
    }

    if (activeBattle) {
      setIsVenueVisible(false);
      return;
    }
    setIsVenueVisible(false);
    setHasReachedHighLowTutorialLosePart(false);
    setActiveBattle({ gameType: getStageTableGameType(stage.id), robotId: robot.id });
  }

  function advanceBattle(robotId: string) {
    const gameType = getStageTableGameType(stage.id);
    setPlayedRobotIds((current) => [
      ...new Set([...current, ...(activeBattle ? [activeBattle.robotId] : [])]),
    ]);
    setFocusedOptionIndex(
      Math.max(0, stage.robots.findIndex((robot) => robot.id === robotId)),
    );
    setIsVenueVisible(false);
    setActiveBattle({ gameType, robotId });
    window.history.pushState(null, "", `/?stage=${stage.id}&battle=${gameType}&robot=${robotId}`);
    window.scrollTo(0, 0);
  }

  function getCurrentObjective() {
    if (stage.id === 4 && !ENABLE_FINAL_DISCOVERY_PHASE) {
      return "ロボットのチップを0にして完ぺきな全勝する";
    }
    if (showPokerBettingTutorial) {
      return "勝率に応じたロボットの賭けと、オールインを確認しよう";
    }
    if (activeBattle) {
      if (activeBattle.gameType === "blackjack" && stage.id === 2) {
        return "同じ手札でハイ＆ローとブラックジャックに2連勝しましょう。";
      }

      if (activeBattle.gameType === "high-low") {
        if (hasReachedHighLowTutorialLosePart) {
          return "能力を理解し、必要な準備をしてハイ＆ローで勝利しましょう。";
        }

        return "手札を確認し、必要な準備をしてハイ＆ローに勝利しましょう。";
      }

      if (activeBattle.gameType === "poker") {
        if (activeBattle.robotId === "poker-3-3") {
          return "コピーペーストでルールを変えて何とか勝ちにしよう";
        }
        if (activeBattle.robotId === "poker-3-2" && pokerScanCount < 2) {
          return 'エクスチェンジ無しで"A"と"もう一枚"スキャンで生成しよう';
        }
        return "解放済みの能力を使い、ポーカーの勝利条件を整えましょう。";
      }

      return "対戦テーブルで状況を確認し、勝利条件を満たしましょう。";
    }

    if (shouldShowFinalDisclosure || shouldShowFinalScanCatalog) {
      return "未判明のスキャン生成2枚を特定しよう";
    }

    if (shouldShowFinalAbilitySpec) {
      return "ファイナルゲームに必要な能力と条件を確認しましょう。";
    }

    if (stage.id === 2) {
      return "ブラックジャックにも挑戦します。ルールとロボット仕様を確認し、対戦テーブルへ進みましょう。";
    }

    if (stage.id >= 3) {
      return "解放済みの能力を活用し、次の対戦相手を攻略しましょう。";
    }

    return "ルールを確認し、ゲームテーブルへ進みましょう。";
  }

  function dispatchGlobalNavAction(action: GlobalNavAction) {
    setIsVenueVisible(false);
    window.dispatchEvent(
      new CustomEvent<{ action: GlobalNavAction }>(GLOBAL_NAV_EVENT, {
        detail: { action },
      }),
    );
    setIsGlobalMenuOpen(false);
  }

  return (
    <main className="min-h-screen px-3 pb-3 max-[424px]:px-2 max-[374px]:px-1.5 sm:px-5 lg:px-8 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-3 sm:gap-5">
        <GlobalGameHeader
          activeBattle={activeBattle}
          currentObjective={getCurrentObjective()}
          isMenuOpen={isGlobalMenuOpen}
          highlightVenueMap={isVenueMapRequired}
          onOpenVenueMap={() => {
            setIsVenueMapOpen(true);
            setIsGlobalMenuOpen(false);
          }}
          onCloseMenu={() => setIsGlobalMenuOpen(false)}
          onGoToBattle={() => dispatchGlobalNavAction("battle")}
          onGoToPreparation={() => dispatchGlobalNavAction("preparation")}
          onGoToSelect={() => {
            setIsVenueVisible(true);
            setIsGlobalMenuOpen(false);
          }}
          onResetStage={() => {
            resetCurrentStage();
            setIsGlobalMenuOpen(false);
          }}
          onToggleMenu={() => setIsGlobalMenuOpen((current) => !current)}
          stageId={stage.id}
        />

        {shouldShowTableHandInfoDialog && !isVenueVisible ? (
          <TutorialDialog
            onDismiss={() => setHasShownTableHandInfoDialog(true)}
            text="プレイヤーには対戦相手の手札と自分の手札が事前に開示されます"
            tone="hands"
          />
        ) : null}

        <div className="grid gap-3 lg:gap-5">
          <section className="overflow-hidden rounded border border-white/12 bg-[#1a1714] shadow-table">
            <div hidden={isVenueVisible}>
            {isBlackjackBattle ? (
              <BlackjackBattle
                key={activeBattle.robotId}
                onNextBattle={advanceBattle}
                onAdvanceToThirdStage={() => goToStage(3)}
                hand={hand}
                isRiddleExchangeTimingRevealed={
                  isRiddleExchangeTimingRevealed
                }
                onRevealRiddleExchangeTiming={() =>
                  setIsRiddleExchangeTimingRevealed(true)
                }
                onOpenModal={(kind, gameType) =>
                  setModal({ gameType, kind, robot: activeBattleRobot })
                }
                robot={activeBattleRobot}
                robotId={activeBattle.robotId}
              />
            ) : isHighLowBattle ? (
              <HighLowBattle
                key={activeBattle.robotId}
                onNextBattle={advanceBattle}
                backHref={`/?stage=${stage.id}`}
                hand={hand}
                isRiddleExchangeTimingRevealed={
                  isRiddleExchangeTimingRevealed
                }
                onBack={() => {
                  setIsVenueVisible(true);
                }}
                onAdvanceToSecondStage={() => goToStage(2)}
                onOpenModal={(kind, gameType) =>
                  setModal({ gameType, kind, robot: activeBattleRobot })
                }
                onTutorialLosePartReached={() =>
                  setHasReachedHighLowTutorialLosePart(true)
                }
                robot={activeBattleRobot}
                robotId={activeBattle.robotId}
                stageId={stage.id}
                exchangePreparation={
                  highLowExchangePreparations[activeBattle.robotId]
                }
                onSaveExchangePreparation={(preparation) =>
                  setHighLowExchangePreparations((current) => ({
                    ...current,
                    [activeBattle.robotId]: preparation,
                  }))
                }
              />
            ) : showPokerBettingTutorial && activeBattleRobot ? (
              <PokerBettingTutorial
                onComplete={() => {
                  setShowPokerBettingTutorial(false);
                  setPlayedRobotIds((current) => [...new Set([...current, "poker-3-2"])]);
                  setFocusedOptionIndex(2);
                  setActiveBattle({ gameType: "poker", robotId: "poker-3-3" });
                  window.history.pushState(null, "", "/?stage=3&battle=poker&robot=poker-3-3");
                  window.scrollTo(0, 0);
                }}
                onOpenModal={(kind, gameType) =>
                  setModal({ gameType, kind, robot: activeBattleRobot })
                }
                robot={activeBattleRobot}
              />
            ) : isPokerBattle ? (
              <PokerBattle
                key={activeBattle.robotId}
                onScanCountChange={setPokerScanCount}
                backHref={`/?stage=${stage.id}`}
                hand={hand}
                isRiddleExchangeTimingRevealed={
                  isRiddleExchangeTimingRevealed
                }
                onBack={() => {
                  setIsVenueVisible(true);
                }}
                onWin={() => {
                  if (activeBattle.robotId === "all-games-last") {
                    window.location.assign("/?screen=clear");
                    return;
                  }
                  if (activeBattle.robotId === "poker-3-3") {
                    goToStage(4);
                    window.scrollTo(0, 0);
                    return;
                  }
                  if (activeBattle.robotId === "poker-3-2") {
                    setIsPokerBettingRevealed(true);
                    setShowPokerBettingTutorial(true);
                    window.history.pushState(null, "", "/?stage=3&battle=poker&robot=poker-3-2&tutorial=betting");
                    window.scrollTo(0, 0);
                    return;
                  }
                  setPlayedRobotIds((current) =>
                    current.includes(activeBattle.robotId)
                      ? current
                      : [...current, activeBattle.robotId],
                  );
                  const currentRobotIndex = stage.robots.findIndex(
                    (robot) => robot.id === activeBattle.robotId,
                  );
                  const nextRobot = stage.robots[currentRobotIndex + 1];
                  setFocusedOptionIndex(
                    Math.min(currentRobotIndex + 1, stage.robots.length - 1),
                  );
                  if (nextRobot) {
                    const gameType = getRobotGameTypes(nextRobot)[0];
                    setActiveBattle({ gameType, robotId: nextRobot.id });
                    window.history.pushState(null, "", `/?stage=${stage.id}&battle=${gameType}&robot=${nextRobot.id}`);
                    window.scrollTo(0, 0);
                  } else {
                    setActiveBattle(null);
                  }
                }}
                onOpenModal={(kind, gameType) =>
                  setModal({ gameType, kind, robot: activeBattleRobot })
                }
                robot={activeBattleRobot}
                robotId={activeBattle.robotId}
              />
            ) : null}
            </div>
            <div hidden={activeBattle !== null && !isVenueVisible}>
            {shouldShowFinalDisclosure ? (
              <FinalDisclosure
                onContinue={() => {
                  setIsFinalDisclosureSeen(true);
                  if (!ENABLE_FINAL_DISCOVERY_PHASE) {
                    setActiveBattle({ gameType: "poker", robotId: "all-games-last" });
                    window.scrollTo(0, 0);
                  }
                }}
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
              />
            ) : shouldShowFinalAbilitySpec ? (
              <FinalAbilitySpecDisclosure
                onContinue={() => setIsFinalAbilitySpecSeen(true)}
              />
            ) : (
              <OpponentSelector
                key={`venue-${stage.id}`}
                focusedGameType={venueGameType}
                focusedGameTypes={[venueGameType]}
                isGameUnlocked={isVenueGameUnlocked}
                focusedRobot={focusedRobot}
                modalCloseSignal={modalCloseSignal}
                venueMapCloseSignal={venueMapCloseSignal}
                onRequestVenueMap={requestVenueMapTutorial}
                canFocusNext={canFocusNext}
                canFocusPrevious={canFocusPrevious}
                shouldShowTutorial={
                  !activeBattle && ((stage.id === 1 && (initialGameSelectTutorial
                    ? !hasCompletedNewGameTutorial
                    : !hasShownGameSelectTutorial)) || showBlackjackUnlockDialog || showPokerUnlockDialog)
                }
                tutorialVariant={
                  showPokerUnlockDialog ? "poker-unlock" : showBlackjackUnlockDialog ? "blackjack-unlock" : "default"
                }
                onFocusRobot={focusRobot}
                onOpenModal={(robot, kind, gameType) =>
                  setModal({ gameType, kind, robot })
                }
                onSelectRobot={selectRobot}
                onTutorialShown={() => {
                  if (showPokerUnlockDialog) {
                    setShowPokerUnlockDialog(false);
                  } else if (showBlackjackUnlockDialog) {
                    setShowBlackjackUnlockDialog(false);
                  } else {
                    setHasCompletedNewGameTutorial(true);
                    markGameSelectTutorialSeen();
                  }
                }}
              />
            )}
            </div>
          </section>
        </div>
      </section>

      {showVenueMapInstruction ? (
        <TutorialDialog
          text="最後に会場MAPを確認しましょう。画面右上のメニューにある、青く光る会場MAPボタンを押してください。"
          tone="rules"
          onDismiss={() => {
            setShowVenueMapInstruction(false);
            setIsGlobalMenuOpen(true);
          }}
        />
      ) : null}
      {isVenueMapOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/86 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="会場MAP" onClick={() => {
          setIsVenueMapOpen(false);
          setIsVenueMapRequired(false);
          setVenueMapCloseSignal((current) => current + 1);
        }}>
          <section className="w-full max-w-6xl overflow-auto rounded border border-white/20 bg-white p-2" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-end">
              <button aria-label="会場MAPを閉じる" className="grid h-10 w-10 place-items-center rounded text-stone-950 hover:bg-stone-100" type="button" onClick={() => {
                setIsVenueMapOpen(false);
                setIsVenueMapRequired(false);
                setVenueMapCloseSignal((current) => current + 1);
              }}><X size={24} /></button>
            </div>
            <Image alt="会場MAP：ゲームテーブルと準備用車両" src="/venue-map.png" width={1920} height={1080} className="h-auto max-h-[80vh] w-full object-contain" />
          </section>
        </div>
      ) : null}
      {modal ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-3 sm:place-items-center sm:p-4"
          onClick={closeModal}
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
                onClick={closeModal}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-5 min-h-28 rounded border border-white/10 bg-white/6 p-4 leading-7 text-stone-200">
              {modal.gameType === "blackjack" && modal.kind === "rules" ? (
                <HighlightedBlackjackRuleText />
              ) : modal.gameType === "blackjack" && modal.kind === "spec" ? (
                <HighlightedBlackjackSpecText />
              ) : modal.gameType === "high-low" && modal.kind === "rules" ? (
                <HighlightedHighLowRuleText />
              ) : modal.gameType === "high-low" && modal.kind === "spec" ? (
                <HighlightedHighLowSpecText />
              ) : modal.gameType === "poker" && modal.kind === "rules" ? (
                <PokerRuleContent
                  onOpenGuideImage={setExpandedGuideImage}
                  ruleText={getModalText(modal)}
                  showRobotWinRate={false}
                />
              ) : modal.gameType === "poker" && modal.kind === "spec" ? (
                <PokerRobotSpecContent
                  specText={getModalText(modal)}
                  showBettingSpec={isPokerBettingRevealed || modal.robot.id === "poker-3-3"}
                />
              ) : (
                getModalText(modal)
              )}
            </p>
          </section>
        </div>
      ) : null}

      {expandedGuideImage ? (
        <RiddleImageModal
          alt={expandedGuideImage.alt}
          onClose={() => setExpandedGuideImage(null)}
          src={expandedGuideImage.src}
        />
      ) : null}

    </main>
  );
}

function FinalScanCatalogBuilder({
  entries,
  onComplete,
  onMarkGenerated,
}: {
  entries: ScanCatalogEntry[];
  onComplete: () => void;
  onMarkGenerated: (entryId: string) => void;
}) {
  const [preparationAbility, setPreparationAbility] = useState<PreparationAbility>("scan");
  const [expandedScanRiddle, setExpandedScanRiddle] = useState<{ alt: string; src: string } | null>(null);
  const [showFirstScanHint, setShowFirstScanHint] = useState(true);
  const [illustrationName, setIllustrationName] = useState("");
  const [answer, setAnswer] = useState("");
  const [splitIndexes, setSplitIndexes] = useState<number[]>([]);
  const [scanMessage, setScanMessage] = useState("");
  const [generatedPreviewSrc, setGeneratedPreviewSrc] = useState<string | null>(
    null,
  );
  const [isFinalCopyPasteApplied, setIsFinalCopyPasteApplied] = useState(false);
  const pendingCount = entries.filter((entry) => !entry.generated).length;
  const allEntriesGenerated = pendingCount === 0;
  const canAddEntry =
    illustrationName.trim().length > 0 &&
    answer.trim().length > 0;

  function resolveEntry() {
    if (!canAddEntry) {
      return;
    }

    const normalizedAnswer = answer.trim();
    const normalizedIllustrationName =
      normalizeScanIllustrationName(illustrationName);
    const matchedEntry = entries.find(
      (entry) =>
        !entry.generated &&
        entry.answer === normalizedAnswer &&
        normalizeScanIllustrationName(entry.illustrationName) ===
          normalizedIllustrationName,
    );

    if (matchedEntry) {
      if (matchedEntry.ability === "コピーペースト" && !isFinalCopyPasteApplied) {
        setGeneratedPreviewSrc(null);
        setScanMessage("先にコピーペーストで青字のコピー元と上書き先を選択してください。");
        return;
      }

      onMarkGenerated(matchedEntry.id);
      setGeneratedPreviewSrc(matchedEntry.targetImageSrc);
      setScanMessage(`${matchedEntry.generatedNumber}のカードを生成しました。`);
      setIllustrationName("");
      setAnswer("");
      setSplitIndexes([]);
      return;
    }

        setGeneratedPreviewSrc(null);
        setScanMessage("生成できません。答え、イラスト読み方、区切り位置を確認してください。");
  }

  return (
    <div className="min-h-[680px] bg-[#071b12] p-3 text-white sm:p-5">
      <div className="rounded border border-brass/50 bg-black/35 p-4 sm:p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brass">
          ファイナル事前準備
        </p>
        <h2 className="mt-2 text-2xl font-black">
          {preparationAbility === "scan" ? "スキャン生成可能一覧"
            : preparationAbility === "exchange" ? "エクスチェンジ" : "コピーペースト"}
        </h2>
        <AbilityUsageTabs
          activeAbility={preparationAbility}
          counts={{ exchange: "自由", scan: "自由", "copy-paste": "自由" }}
          onSelect={setPreparationAbility}
        />
      </div>

      {preparationAbility === "exchange" ? (
        <div className="mt-3">
          <ExchangeSpecToggle />
          <ExchangeRuleList />
        </div>
      ) : null}
      {preparationAbility === "copy-paste" ? (
        <FinalCopyPasteWorkbench
          isApplied={isFinalCopyPasteApplied}
          onAppliedChange={setIsFinalCopyPasteApplied}
        />
      ) : null}
      <div className={preparationAbility === "scan" ? "" : "hidden"}>
      {preparationAbility === "scan" && showFirstScanHint ? (
        <TutorialDialog
          onDismiss={() => setShowFirstScanHint(false)}
          text="⑤はまだ解いていないが、もう1枚は能力を使わない限りイラストなさそうだな"
          tone="quick"
        />
      ) : null}
      {expandedScanRiddle ? <RiddleImageModal {...expandedScanRiddle} onClose={() => setExpandedScanRiddle(null)} /> : null}
      <details className="mt-3 rounded border border-white/12 bg-black/30 p-3">
        <summary className="cursor-pointer text-sm font-black leading-6 text-brass">小謎の紙</summary>
        <ScanRiddleImages
          images={[
            { src: "/riddles/riddle_1.png", label: "①" },
            { src: "/riddles/riddle_1-2.png", label: "" },
            { src: "/riddles/riddle_2.png", label: "②" },
            { src: "/riddles/riddle_3.png", label: "③" },
            { src: "/riddles/riddle_4.png", label: "④" },
          ]}
          onOpen={setExpandedScanRiddle}
        />
      </details>
      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded border border-white/12 bg-black/28 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                カタログ
              </p>
              <h3 className="mt-1 text-xl font-black">スキャン生成一覧</h3>
            </div>
            <p className="rounded border border-brass/40 bg-brass/10 px-3 py-2 text-sm font-black text-brass">
              未生成 {pendingCount}件
            </p>
          </div>

          <ScanSummaryList
            rows={entries.filter((entry) => entry.generated).sort((a, b) => {
              const order = ["0315", "すいり", "ななめ", "フエ", "ツーペア"];
              const aIndex = order.indexOf(a.answer);
              const bIndex = order.indexOf(b.answer);
              return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex);
            }).map((entry) => ({
              id: entry.id,
              question: ({ "0315": "①", "すいり": "②", "ななめ": "①´", "フエ": "③", "ツーペア": "④" } as Record<string, string>)[entry.answer] ?? "⑤",
              answer: entry.generated ? entry.answer : "未入力",
              illustrationName: entry.generated ? entry.illustrationName.replace(/[\s\u3000]+/g, "/") : "未入力",
              generatedNumber: entry.generated ? entry.generatedNumber : "未入力",
              imageSrc: entry.generated ? entry.targetImageSrc : undefined,
            }))}
          />
        </section>

        <section className="min-w-0 rounded border border-white/12 bg-black/28 p-3 sm:p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
            スキャン入力
          </p>
          <h3 className="mt-1 text-xl font-black">スキャン実行</h3>
          <ScanAnswerPanel
            answer={answer}
            inventoryCards={entries.filter((entry) => entry.generated).flatMap((entry) => {
              const cardId = entry.generatedNumber === "1" ? "scan-A" : entry.generatedNumber === "11" ? "scan-J" : `scan-${entry.generatedNumber}`;
              return generatedScanCards[cardId] ? [generatedScanCards[cardId]] : [];
            })}
            illustration={illustrationName}
            splitIndexes={splitIndexes}
            onAnswerChange={setAnswer}
            onIllustrationChange={(value) => {
              setIllustrationName(value);
              setSplitIndexes([]);
            }}
            onSplitChange={(indexes, value) => {
              setSplitIndexes(indexes);
              setIllustrationName(value);
            }}
            onSubmit={resolveEntry}
            disabled={!canAddEntry}
            message={scanMessage}
          >
            {generatedPreviewSrc ? <ScanTargetPreview alt="今回スキャンした対象" src={generatedPreviewSrc} /> : null}
          </ScanAnswerPanel>

          <div className="mt-4 rounded border border-casinoRed/45 bg-red-950/20 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-100">
              ファイナルバトル
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
    </div>
  );
}

function FinalDisclosure({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="min-h-[680px] bg-[#071b12] p-3 text-white sm:p-5">
      <section className="grid min-h-[640px] place-items-center rounded border border-brass/50 bg-black/45 p-4 shadow-[inset_0_0_80px_rgba(0,0,0,0.45)]">
        <div className="w-full max-w-2xl rounded border border-white/12 bg-stone-950/92 p-5 shadow-2xl sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brass">
            ファイナル情報開示
          </p>
          <h2 className="mt-2 text-2xl font-black">ファイナルゲームの勝利条件<span className="text-red-300">公開</span></h2>
          <p className="mt-3 text-sm font-bold leading-7 text-stone-100">
            {ENABLE_FINAL_DISCOVERY_PHASE
              ? "最後の1戦で使われる手札とフィールドが判明。このまま事前準備へ入る前に、未判明のスキャン生成2枚を特定しよう"
              : <>
                  <span className="my-7 block text-xl font-black leading-8 text-red-300 sm:text-2xl">「ロボットのチップを0にして全勝する」</span>
                  <span className="mt-3 block">最後の1戦で使われる手札とフィールドが<span className="text-red-300">公開</span>。事前準備を整えて、ファイナルゲームに挑もう</span>
                </>}
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
          <h3 className="mt-5 text-lg font-black">小ネタも<span className="text-red-300">公開</span>！</h3>
          <div className="relative ml-2 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-stone-950 sm:p-5">
            <span aria-hidden="true" className="absolute -left-[9px] top-6 h-4 w-4 rotate-45 border-b border-l border-emerald-200 bg-emerald-50" />
            <p className="relative text-sm font-bold leading-7">
            画面上部の”やること”を5回連続でタップすると開発秘話が見れるぞ
            </p>
          </div>
          <button
            className="mt-5 min-h-12 w-full rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
            onClick={onContinue}
            type="button"
          >
            {ENABLE_FINAL_DISCOVERY_PHASE ? "スキャン一覧を作成する" : "ファイナルゲームへ"}
          </button>
        </div>
      </section>
    </div>
  );
}

function DevelopmentStoryText() {
  return <>ここまで遊んでくれてありがとう！これが最後の戦いだから頑張ってね！このゲームのこだわりポイントとして、ゲームに登場する全ての車は僕の愛車の”<span className="font-black text-red-700">ハイエース</span>”なんだ。気にしてみてね</>;
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
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
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
            ファイナル仕様
          </p>
          <h2 className="mt-2 text-2xl font-black">最後の仕様<span className="text-red-300">公開</span></h2>
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
      duration: "1ステージ",
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

function ScanTargetPreview({ alt, src }: { alt: string; src: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <>
      <button
        aria-label={`${alt}を拡大表示`}
        className="group block w-full cursor-zoom-in overflow-hidden rounded border border-white/12 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        onClick={() => setIsExpanded(true)}
        type="button"
      >
        <Image
          alt={alt}
          className="h-auto w-full transition-transform duration-200 group-hover:scale-[1.015]"
          height={900}
          src={src}
          width={1600}
        />
      </button>
      {isExpanded ? (
        <RiddleImageModal alt={alt} src={src} onClose={() => setIsExpanded(false)} />
      ) : null}
    </>
  );
}

function ScanRuleText() {
  return (
    <>
      <span className="block">
        ①回答と
        <span className="text-red-300">スキャンしたいイラスト名</span>
        を入力し、謎が成立しているか判定
      </span>
      <span className="block">
        ②法則に従ってカード1枚を生成
      </span>
      <span className="block">
        ③エクスチェンジ機能を使ってゲームで利用
      </span>
      <span className="block">
        ※
        <span className="text-red-300">
          トランプのスキャンはできない
        </span>
        が、
        <SelectableBlueText id="scan-poker">ポーカー</SelectableBlueText>
        として現物のトランプをセットした時に
        <SelectableBlueText id="scan-role-name">役名</SelectableBlueText>
        なら生成できる。
      </span>
      <span className="mt-5 block">
        イラストの呼称の入力<SelectableBlueText id="scan-example">例</SelectableBlueText>
      </span>
      <span className="block">イチ　ゴ→6</span>
      <span className="block">フォー　カード→4</span>
      <span className="block">レース　クイーン→12</span>
      <span className="block">ひ　ふ　み→和名のためNG</span>
      <span className="block">
        レイチ　ョウルイ→0でも1でもないためNG
      </span>
      <span className="block">
        イチ　モクサン→3が区切られていないためNG
      </span>
    </>
  );
}

function AbilitySpecToggleButton({ label, isVisible, onToggle }: {
  label: string;
  isVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-expanded={isVisible}
      className={`mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded border px-3 py-3 text-left text-sm font-black text-sky-100 transition-colors hover:bg-sky-900/45 ${isVisible ? "border-sky-200/70 bg-sky-900/45" : "border-sky-300/40 bg-sky-950/35"}`}
      onClick={onToggle}
      type="button"
    >
      <span className="min-w-0">{label}</span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-sky-200">
        {isVisible ? "閉じる" : "開く"}
        {isVisible ? <ChevronUp aria-hidden="true" size={20} /> : <ChevronDown aria-hidden="true" size={20} />}
      </span>
    </button>
  );
}

function ScanSpecToggle({
  isVisible,
  onToggle,
}: {
  isVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <AbilitySpecToggleButton label="スキャン機能について" isVisible={isVisible} onToggle={onToggle} />
      {isVisible ? (
        <p className="mt-3 whitespace-pre-line rounded border border-sky-300/35 bg-sky-950/25 p-3 text-sm font-bold leading-6 text-sky-50">
          <ScanRuleText />
        </p>
      ) : null}
    </>
  );
}

function ExchangeSpecToggle() {
  const [isVisible, setIsVisible] = useState(true);

  return (
    <>
      <AbilitySpecToggleButton label="エクスチェンジ機能について" isVisible={isVisible} onToggle={() => setIsVisible((current) => !current)} />
      {isVisible ? (
        <p className="mt-3 rounded border border-sky-300/35 bg-sky-950/25 p-3 text-sm font-bold leading-6 text-sky-50">
          トランプ同士を選択し、決められたタイミングで交換される。数字とスート（マーク）の印刷面のみ交換されるため、
          <span className="text-red-300">常に印刷面を目視されていない限り</span>
          不正に気付かれない
        </p>
      ) : null}
    </>
  );
}

function PhysicalScanPanel({
  canAnswerRoleName,
  canRun,
  cards,
  generatedCard,
  generatedLabel,
  isGenerated,
  message,
  onAnswerRoleName,
  onRun,
  onSplitChange,
  onToggleCard,
  prompt,
  reading,
  readingPrompt,
  requiredSelectionCount,
  selectedCardIds,
  splitIndexes,
}: {
  canAnswerRoleName: boolean;
  canRun: boolean;
  cards: PlayingCard[];
  generatedCard: PlayingCard;
  generatedLabel: string;
  isGenerated: boolean;
  message: string;
  onAnswerRoleName: () => void;
  onRun: () => void;
  onSplitChange: (indexes: number[], dividedText: string) => void;
  onToggleCard: (cardId: string) => void;
  prompt: string;
  reading: string;
  readingPrompt: string;
  requiredSelectionCount: number;
  selectedCardIds: string[];
  splitIndexes: number[];
}) {
  return (
    <div className="mt-3 rounded border border-sky-300/35 bg-sky-950/20 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
        所持アイテム一覧
      </p>
      {prompt ? (
        <p className="mt-2 text-sm font-bold leading-6 text-stone-100">
          {prompt}
        </p>
      ) : null}
      <p className="mt-2 text-xs font-black text-sky-100">
        選択中: {selectedCardIds.length}/{requiredSelectionCount}枚
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {cards.map((card) => {
          const selected = selectedCardIds.includes(card.id);

          return (
            <button
              className={`rounded border p-1 ${
                selected
                  ? "border-emerald-300 bg-emerald-400/20 ring-4 ring-emerald-300/30"
                  : "border-white/12 bg-black/20 hover:bg-white/10"
              }`}
              key={card.id}
              onClick={() => onToggleCard(card.id)}
              type="button"
            >
              <PlayingCardView card={card} size="hand" />
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid gap-2">
        <button
          className={`min-h-11 rounded px-3 py-2 text-sm font-black ${
            reading
              ? "bg-emerald-500 text-stone-950"
              : canAnswerRoleName
                ? "bg-brass text-stone-950 hover:bg-yellow-300"
                : "cursor-not-allowed bg-stone-700 text-stone-400"
          }`}
          disabled={!canAnswerRoleName || Boolean(reading)}
          onClick={onAnswerRoleName}
          type="button"
        >
          {reading ? `役名: ${reading.replace(/[／/]/g, "")}` : "回答"}
        </button>
        {reading ? (
          <>
            <IllustrationSplitSelector
              onChange={onSplitChange}
              selectedIndexes={splitIndexes}
              value={reading}
            />
            <p className="rounded border border-sky-300/35 bg-sky-950/25 p-3 text-sm font-bold leading-6 text-sky-50">
              {readingPrompt}
            </p>
          </>
        ) : null}
      </div>
      <button
        className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
          isGenerated
            ? "bg-emerald-500 text-stone-950"
            : canRun
              ? "bg-brass text-stone-950 hover:bg-yellow-300"
              : "cursor-not-allowed bg-stone-700 text-stone-400"
        }`}
          disabled={selectedCardIds.length === 0 || !canRun || isGenerated}
        onClick={onRun}
        type="button"
      >
        {isGenerated ? generatedLabel : "現物スキャン発動"}
      </button>
      {isGenerated ? (
        <>
        {generatedCard.rank === "A" ? (
          <ScanTargetPreview alt="今回スキャンした対象: ワンペア" src={scanTargetImages.onepair} />
        ) : null}
        <div className="mt-3 flex justify-center rounded border border-emerald-300/35 bg-emerald-950/30 p-3">
          <PlayingCardView card={generatedCard} size="hand" />
        </div>
        </>
      ) : null}
      {message ? (
        <ScanFeedbackMessage message={message} />
      ) : null}
    </div>
  );
}

function ScanFeedbackMessage({ message }: { message: string }) {
  const isFailure = message === "上手くいかないようだ...";

  return (
    <p
      role={isFailure ? "alert" : "status"}
      className={`mt-3 rounded border p-3 font-black leading-6 ${
        isFailure
          ? "border-casinoRed bg-red-950/70 text-base text-red-50 shadow-[0_0_18px_rgba(239,68,68,0.35)]"
          : "border-white/12 bg-white/8 text-sm text-stone-100"
      }`}
    >
      {message}
    </p>
  );
}

function BattleResultOverlay({ result, onDismiss }: { result: "win" | "lose"; onDismiss: () => void }) {
  return (
    <button
      aria-label="結果表示を閉じる"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 text-center backdrop-blur-[2px]"
      onClick={onDismiss}
      type="button"
    >
      <span className="relative inline-grid place-items-center">
        <span className={`absolute h-44 w-44 rounded-full blur-3xl sm:h-64 sm:w-64 ${result === "win" ? "bg-emerald-400/25" : "bg-casinoRed/30"}`} />
        <span className={`absolute h-28 w-72 rounded-full border sm:h-40 sm:w-[34rem] ${result === "win" ? "border-brass/70 shadow-[0_0_48px_rgba(246,195,92,0.75)]" : "border-casinoRed/75 shadow-[0_0_48px_rgba(180,31,44,0.72)]"}`} />
        <span className={`relative scale-105 text-5xl font-black drop-shadow-[0_6px_0_rgba(0,0,0,0.8)] sm:text-8xl ${result === "win" ? "text-brass" : "text-casinoRed"}`}>
          {result === "win" ? "YOU WIN" : "YOU LOSE"}
        </span>
      </span>
    </button>
  );
}

function GameStartRow({ robotId, children }: { robotId: string; children: ReactNode }) {
  const stage = stages.find((item) => item.robots.some((robot) => robot.id === robotId));
  const gameNumber = stage ? stage.robots.findIndex((robot) => robot.id === robotId) + 1 : 0;
  const stageLabel = stage?.id === 4 ? "FinalStage" : `${["", "1st", "2nd", "3rd"][stage?.id ?? 0]}Stage`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {stage ? <p className="text-sm font-black text-brass sm:text-base">{stageLabel} 第{gameNumber}ゲーム</p> : null}
      <div className="ml-auto shrink-0">{children}</div>
    </div>
  );
}

function GameStartHandNotice({ timing = "ゲームスタート" }: { timing?: string }) {
  return <p className="rounded border border-brass/45 bg-brass/10 px-3 py-2 text-sm font-black text-brass">{timing}宣言時の手札状況</p>;
}

function BattleDefeatNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      <div className="rounded border border-casinoRed/60 bg-red-950/45 p-3">
        <p className="text-sm font-black leading-6 text-red-100">{message}</p>
        <p className="mt-4 text-3xl font-black text-casinoRed">YOU LOSE</p>
      </div>
      <button className="min-h-12 rounded border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15" onClick={onRetry} type="button">
        もう一度確認
      </button>
    </>
  );
}

function VictoryConditionNotice({ message }: { message: string }) {
  const title = message.startsWith("勝利後条件変更")
    ? "勝利後条件変更"
    : message.startsWith("勝利後条件追加")
      ? "勝利後条件追加"
      : "勝利後追加";
  return (
    <div
      className="mt-4 rounded border-2 border-red-400 bg-red-950 p-4 text-white shadow-[0_0_20px_rgba(239,68,68,0.25)]"
      role="status"
    >
      <p className="flex items-center gap-2 text-sm font-black text-red-200">
        <Info aria-hidden="true" className="h-5 w-5 shrink-0" />
        {title}
      </p>
      <p className="mt-2 text-base font-black leading-7">
        {message.replace(/^勝利後(?:追加|条件変更|条件追加)[:：]\s*/, "")}
      </p>
    </div>
  );
}

type ScanSummaryRow = {
  answer: string;
  generatedNumber: string;
  illustrationName: string;
  question: string;
  id?: string;
  ability?: string;
  selected?: boolean;
  imageSrc?: string;
};

function ScanSummaryList({ rows }: {
  rows: ScanSummaryRow[];
}) {
  const [expandedImage, setExpandedImage] = useState<ScanSummaryRow | null>(null);
  const columns = "1.8rem minmax(0,0.8fr) minmax(0,1fr) 2rem 3rem";
  const cellClass = "min-w-0 border-b border-white/8 px-1 py-2 break-words";
  return (
    <div className="mt-3 min-w-0 max-w-full">
      {expandedImage?.imageSrc ? <RiddleImageModal alt={`${expandedImage.illustrationName}のスキャン対象`} src={expandedImage.imageSrc} onClose={() => setExpandedImage(null)} /> : null}
      <div className="grid min-w-0 text-sm font-bold text-stone-100" style={{ gridTemplateColumns: columns }}>
        {["問題", "答え", "イラスト読み方", "生成", "詳細"].map((label) => (
          <div className="border-b border-white/10 px-1 py-2 text-[10px] text-stone-400" key={label}>{label}</div>
        ))}
        {rows.map((row) => (
          <Fragment key={row.id ?? `${row.question}-${row.answer}`}>
            <div className={cellClass}>{row.question}</div>
            <div className={cellClass}>{row.answer}</div>
            <div className={cellClass}>{row.illustrationName}</div>
            <div className={cellClass}>{row.generatedNumber}</div>
            {(
              <div className={cellClass}>
                <button
                  aria-label={`${row.question}の詳細`}
                  className="min-h-9 w-full rounded border border-brass/50 px-1 text-xs font-black text-brass hover:bg-brass/15 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!row.imageSrc}
                  onClick={() => setExpandedImage(row)}
                  type="button"
                >詳細</button>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function ScanRiddleImages({ images, onOpen }: {
  images: Array<{ src: string; label: string }>;
  onOpen: (image: { alt: string; src: string }) => void;
}) {
  const uniqueImages = Array.from(new Map([
    { src: "/riddles/riddle_0.png", label: "⓪" },
    ...images,
  ].map((image) => [image.src, image])).values());
  return (
    <div className="mt-3 grid gap-3">
      {uniqueImages.map((riddle) => (
        <div className="rounded border border-white/12 bg-white p-3 text-stone-950" key={riddle.src}>
          <ZoomableRiddleImage alt={"スキャン用小謎" + riddle.label} badge={riddle.label} src={riddle.src} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}

function ScanInventoryPanel({ cards, disabled, onScan }: {
  cards: PlayingCard[];
  disabled: boolean;
  onScan?: (cardIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedCards = cards.filter((card) => selectedIds.includes(card.id));
  return (
    <section className="mt-3 rounded border border-white/12 bg-black/25 p-3">
      <h3 className="text-sm font-black text-brass">所持アイテム一覧</h3>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {cards.map((card) => (
          <button
            aria-label={`${card.rank}のカードを現物スキャン対象に選択`}
            aria-pressed={selectedIds.includes(card.id)}
            className={`rounded border p-1 ${selectedIds.includes(card.id) ? "border-emerald-300 bg-emerald-400/20 ring-2 ring-emerald-300" : "border-white/15 bg-black/20"}`}
            key={card.id}
            onClick={() => setSelectedIds((current) => current.includes(card.id) ? current.filter((id) => id !== card.id) : [...current, card.id])}
            type="button"
          ><PlayingCardView card={card} size="hand" /></button>
        ))}
        {cards.length === 0 ? <p className="text-sm font-bold text-stone-400">所持アイテムなし</p> : null}
      </div>
      <button
        className="mt-3 min-h-11 w-full rounded bg-brass px-3 text-sm font-black text-stone-950 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
        disabled={disabled || selectedCards.length === 0 || !onScan}
        onClick={() => onScan?.(selectedCards.map((card) => card.id))}
        type="button"
      >現物スキャン</button>
    </section>
  );
}

function ScanAnswerPanel({ answer, illustration, splitIndexes, onAnswerChange, onIllustrationChange, onSplitChange, onSubmit, disabled = false, message, children, inventoryCards = [], onPhysicalScan, physicalScanDisabled = false }: {
  answer: string;
  illustration: string;
  splitIndexes: number[];
  onAnswerChange: (value: string) => void;
  onIllustrationChange: (value: string) => void;
  onSplitChange: (indexes: number[], value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  message: string;
  children?: ReactNode;
  inventoryCards?: PlayingCard[];
  onPhysicalScan?: (cardIds: string[]) => void;
  physicalScanDisabled?: boolean;
}) {
  return (
    <div className="mt-3 grid gap-3 rounded border border-brass/45 bg-black/30 p-3">
      <p className="text-sm font-black leading-6 text-brass">スキャン回答</p>
      <label className="grid gap-2 text-sm font-bold text-stone-100">
        謎の答え
        <input className="min-h-11 min-w-0 w-full rounded border border-brass bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none ring-4 ring-brass/20" onChange={(event) => onAnswerChange(event.target.value)} placeholder="謎の答えを入力" value={answer} />
      </label>
      <label className="grid gap-2 text-sm font-bold text-stone-100">
        イラスト読み方
        <input className="min-h-11 min-w-0 w-full rounded border border-brass bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none ring-4 ring-brass/20" onChange={(event) => onIllustrationChange(event.target.value)} placeholder="イラスト読み方を入力" value={illustration} />
      </label>
      <IllustrationSplitSelector onChange={onSplitChange} selectedIndexes={splitIndexes} value={illustration} />
      <button className={`min-h-11 rounded px-3 py-2 text-sm font-black ${disabled ? "cursor-not-allowed bg-stone-700 text-stone-400" : "bg-brass text-stone-950 hover:bg-yellow-300"}`} disabled={disabled} onClick={onSubmit} type="button">スキャン発動</button>
      {message ? <ScanFeedbackMessage message={message} /> : null}
      {children}
      <ScanInventoryPanel cards={inventoryCards} disabled={physicalScanDisabled} onScan={onPhysicalScan} />
    </div>
  );
}

function ScanSolvedSummary({ hasFourthScanResult = false, additionalRows = [] }: { hasFourthScanResult?: boolean; additionalRows?: ScanSummaryRow[] }) {
  const rows = [
    {
      answer: "0315",
      generatedNumber: "10",
      illustrationName: "じゅう/しょ",
      imageSrc: scanTargetImages.jyuusho,
      question: "①",
    },
    {
      answer: "すいり",
      generatedNumber: "12",
      illustrationName: "クイーン",
      imageSrc: scanTargetImages.queen,
      question: "②",
    },
    ...(hasFourthScanResult
      ? [{
          answer: "ななめ",
          generatedNumber: "9",
          illustrationName: "きゅう/しょ",
          imageSrc: scanTargetImages.kyuusho,
          question: "①´",
        }]
      : []),
    ...additionalRows,
  ];

  return (
    <div className="mt-3 rounded border border-white/12 bg-black/30 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
        スキャン回答済み
      </p>
      <ScanSummaryList rows={rows} />
    </div>
  );
}

function ExchangeModeToggleButton({
  className = "",
  isActive,
  isCompleted = false,
  onClick,
}: {
  className?: string;
  isActive: boolean;
  isCompleted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`${className} min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
        isCompleted
          ? "bg-emerald-500 text-stone-950"
          : isActive
            ? "bg-red-500 text-white"
            : "bg-casinoRed text-white hover:bg-red-600"
      }`}
      onClick={onClick}
      type="button"
    >
      {isCompleted
        ? "エクスチェンジ済み"
        : isActive
          ? "エクスチェンジ起動中"
          : "エクスチェンジ起動"}
    </button>
  );
}

function GameTableReturnButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      className={`${className} min-h-11 rounded border border-white/20 bg-white/8 px-4 py-2 text-sm font-black text-white hover:bg-white/14`}
      onClick={onClick}
      type="button"
    >
      ゲームテーブルへ
    </button>
  );
}

function ExchangeRedoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="mt-3 min-h-11 w-full rounded border border-white/15 bg-white/8 px-3 py-2 text-sm font-black text-white hover:bg-white/14"
      onClick={onClick}
      type="button"
    >
      やり直し
    </button>
  );
}

function IllustrationSplitSelector({
  onChange,
  selectedIndexes,
  value,
}: {
  onChange: (indexes: number[], dividedText: string) => void;
  selectedIndexes: number[];
  value: string;
}) {
  const characters = Array.from(value.trim().replace(/[／/]/g, ""));
  const hasValue = characters.length > 0;
  const selectedSet = new Set(selectedIndexes);
  const buildDividedText = (indexes: number[]) => {
    const indexSet = new Set(indexes);

    return hasValue
      ? characters
          .map((character, index) =>
            index < characters.length - 1 && indexSet.has(index + 1)
              ? `${character}/`
              : character,
          )
          .join("")
      : "";
  };
  const dividedText = buildDividedText(selectedIndexes);

  function toggleSplit(index: number) {
    const nextIndexes = selectedSet.has(index)
      ? selectedIndexes.filter((item) => item !== index)
      : [...selectedIndexes, index].sort((a, b) => a - b);

    if (selectedSet.has(index)) {
      onChange(nextIndexes, buildDividedText(nextIndexes));
      return;
    }

    onChange(nextIndexes, buildDividedText(nextIndexes));
  }

  return (
    <div className="rounded border border-sky-300/35 bg-sky-950/25 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-100">
        区切り位置
      </p>
      <p className="mt-2 text-sm font-bold leading-6 text-stone-100">
        数字として読みたい単語の区切り位置にスラッシュを入れてください。
      </p>
      {hasValue ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1 rounded border border-white/10 bg-black/35 p-3">
            {characters.map((character, index) => (
              <Fragment key={`${character}-${index}`}>
                <span className="grid min-h-12 min-w-10 place-items-center rounded border border-white/15 bg-white px-2 text-2xl font-black text-stone-950">
                  {character}
                </span>
                {index < characters.length - 1 ? (
                  <button
                    aria-pressed={selectedSet.has(index + 1)}
                    className={`grid min-h-12 min-w-9 place-items-center rounded border px-2 text-xl font-black ${
                      selectedSet.has(index + 1)
                        ? "border-sky-200 bg-sky-300 text-stone-950"
                        : "border-white/15 bg-black/45 text-stone-500 hover:bg-white/10"
                    }`}
                    onClick={() => toggleSplit(index + 1)}
                    type="button"
                  >
                    /
                  </button>
                ) : null}
              </Fragment>
            ))}
          </div>
          <p className="mt-3 rounded border border-white/10 bg-black/35 p-3 text-lg font-black leading-7 text-sky-100">
            {dividedText}
          </p>
        </>
      ) : (
        <p className="mt-3 rounded border border-white/10 bg-black/35 p-3 text-sm font-bold text-stone-400">
          イラスト読み方を入力すると、区切り位置を指定できます。
        </p>
      )}
    </div>
  );
}

function RiddleCopyTargetLayer({ src, onSelected }: { src: string; onSelected?: () => void }) {
  const selection = useContext(BlueTextSelectionContext);
  if (!["/riddles/riddle_4.png", "/riddles/riddle_4ex.png"].includes(src) || !selection?.allowRiddleCopy) return null;
  const id = "riddle-four-game";
  const replacement = selection.replacements[id];
  if (!selection.active && !replacement) return null;
  return (
    <button
      aria-label="小謎④の青字のポーカー"
      className={`absolute left-[32%] top-[7%] h-[11%] w-[20%] border-0 bg-transparent text-sm font-black text-sky-500 ${selection.active ? "" : "pointer-events-none"}`}
      onClick={(event) => {
        event.stopPropagation();
        if (!selection.active) return;
        selection.onSelect(id, replacement ?? "ポーカー");
        onSelected?.();
      }}
      type="button"
    >
      {null}
    </button>
  );
}

function ZoomableRiddleImage({
  alt,
  badge,
  className = "",
  onOpen,
  src,
}: {
  alt: string;
  badge?: string;
  className?: string;
  onOpen: (image: { alt: string; src: string }) => void;
  src: string;
}) {
  const selection = useContext(BlueTextSelectionContext);
  const isReplaced = src === "/riddles/riddle_4.png" && selection?.replacements["riddle-four-game"] === "ハイ＆ロー";
  const displaySrc = isReplaced ? "/riddles/riddle_4ex.png" : src;
  const displayBadge = isReplaced ? "④'" : badge;
  return (
    <div className={className}>
      {displayBadge ? (
        <span className="mb-1 inline-grid h-8 min-w-8 place-items-center rounded border border-brass/70 bg-black/80 px-2 text-sm font-black text-brass shadow-lg">
          {displayBadge}
        </span>
      ) : null}
      <div className="relative">
      <button
        className="group block w-full overflow-hidden rounded border border-white/12 bg-white text-left"
        onClick={() => onOpen({ alt, src })}
        type="button"
      >
        <Image
          alt={alt}
          className="h-auto w-full transition-transform duration-200 group-hover:scale-[1.015]"
          height={900}
          src={displaySrc}
          width={1600}
        />
      </button>
      <RiddleCopyTargetLayer src={displaySrc} />
      </div>
    </div>
  );
}

function RiddleImageModal({
  alt,
  onClose,
  riddlePrintSelection,
  src,
}: {
  alt: string;
  onClose: () => void;
  riddlePrintSelection?: {
    disabled?: boolean;
    onToggleTarget: (targetId: string) => void;
    selectedIds: string[];
  };
  src: string;
}) {
  const selection = useContext(BlueTextSelectionContext);
  const displaySrc = src === "/riddles/riddle_4.png" && selection?.replacements["riddle-four-game"] === "ハイ＆ロー"
    ? "/riddles/riddle_4ex.png" : src;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/86 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-full w-full max-w-6xl overflow-auto rounded border border-white/20 bg-white p-2 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          <Image
            alt={alt}
            className="h-auto w-full rounded"
            height={900}
            priority
            src={displaySrc}
            width={1600}
          />
          <RiddleCopyTargetLayer src={displaySrc} onSelected={onClose} />
          {riddlePrintSelection ? (
            <RiddlePrintTargetLayer
              disabled={riddlePrintSelection.disabled}
              onToggleTarget={riddlePrintSelection.onToggleTarget}
              selectedIds={riddlePrintSelection.selectedIds}
            />
          ) : null}
        </div>
      </div>
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
  text: ReactNode;
  tone: "hands" | "quick" | "rules" | "spec" | "start";
}) {
  const toneClass = {
    hands: "border-cyan-300 bg-cyan-950 text-cyan-50",
    quick: "border-sky-300 bg-sky-950 text-sky-50",
    rules: "border-sky-400 bg-sky-50 text-stone-950",
    spec: "border-emerald-400 bg-emerald-50 text-stone-950",
    start: "border-casinoRed bg-red-50 text-stone-950",
  }[tone];

  useEffect(() => {
    function handleDismissEvent(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      if (target.closest("[data-tutorial-action]")) {
        return;
      }

      const isDismissButton = target.closest("[data-tutorial-dismiss]");
      const isOutsideCard = !target.closest("[data-tutorial-card]");

      if (isDismissButton || isOutsideCard) {
        event.preventDefault();
        onDismiss();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target instanceof Element ? event.target : null;

      if (target?.closest("[data-tutorial-dismiss]")) {
        onDismiss();
      }
    }

    document.addEventListener("click", handleDismissEvent, true);
    document.addEventListener("mousedown", handleDismissEvent, true);
    document.addEventListener("focusin", handleFocusIn, true);

    return () => {
      document.removeEventListener("click", handleDismissEvent, true);
      document.removeEventListener("mousedown", handleDismissEvent, true);
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-40 grid cursor-default place-items-center bg-black/78 p-4 text-left backdrop-blur-[3px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div
        data-tutorial-card
        className={`w-full max-w-2xl rounded border-2 px-5 py-5 text-base font-black leading-7 shadow-[0_24px_80px_rgba(0,0,0,0.72)] sm:px-7 sm:py-6 sm:text-lg ${toneClass}`}
        onClick={(event) => {
          event.stopPropagation();

          if (!actionLabel) {
            onDismiss();
          }
        }}
      >
        <p>{text}</p>
        {actionLabel && onAction ? (
          <button
            data-tutorial-action
            className="mt-3 min-h-10 w-full rounded bg-white px-4 text-sm font-black text-stone-950 hover:bg-stone-100"
            onClick={(event) => {
              event.stopPropagation();
              onAction();
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
            data-tutorial-dismiss
            className="mt-3 min-h-10 w-full rounded bg-white px-4 text-sm font-black text-stone-950 hover:bg-stone-100"
            onClick={(event) => {
              event.stopPropagation();
              onDismiss();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onDismiss();
            }}
            onFocus={onDismiss}
            type="button"
          >
            閉じる
          </button>
        )}
      </div>
    </div>
  );
}

function PlayerCutInDialog({
  onDismiss,
  text,
}: {
  onDismiss: () => void;
  text: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 grid cursor-default place-items-center overflow-hidden bg-black/74 p-0 text-left backdrop-blur-[4px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <button
        className="group relative w-full max-w-4xl -skew-y-3 overflow-hidden border-y-2 border-cyan-200 bg-gradient-to-r from-black via-sky-950 to-black px-5 py-7 text-left shadow-[0_0_48px_rgba(34,211,238,0.45)] sm:px-10 sm:py-9"
        onClick={onDismiss}
        type="button"
      >
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(125,211,252,0.22)_18%,transparent_36%,transparent_100%)]" />
        <span className="pointer-events-none absolute -left-10 top-0 h-full w-32 bg-cyan-300/15 blur-xl" />
        <span className="block skew-y-3">
          <span className="mb-3 inline-flex items-center gap-2 border border-cyan-200/65 bg-cyan-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-stone-950 shadow-[4px_4px_0_rgba(0,0,0,0.55)]">
            プレイヤー
          </span>
          <span className="block text-xl font-black leading-9 text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.85)] sm:text-3xl sm:leading-[1.65]">
            {text}
          </span>
          <span className="mt-5 inline-flex min-h-10 items-center border border-white/45 bg-white px-5 text-sm font-black text-stone-950 shadow-[5px_5px_0_rgba(0,0,0,0.6)] transition group-hover:bg-cyan-100">
            閉じる
          </span>
        </span>
      </button>
    </div>
  );
}

function OpponentSelector({
  canFocusNext,
  canFocusPrevious,
  focusedGameType,
  focusedGameTypes,
  focusedRobot,
  isGameUnlocked,
  modalCloseSignal,
  onFocusRobot,
  onOpenModal,
  onSelectRobot,
  onTutorialShown,
  onRequestVenueMap,
  venueMapCloseSignal,
  shouldShowTutorial,
  tutorialVariant = "default",
}: {
  canFocusNext: boolean;
  canFocusPrevious: boolean;
  focusedGameType: GameType | null;
  focusedGameTypes: GameType[];
  focusedRobot: Robot | null;
  isGameUnlocked: boolean;
  modalCloseSignal: number;
  onFocusRobot: (offset: number) => void;
  onOpenModal: (robot: Robot, kind: ModalKind, gameType: GameType) => void;
  onSelectRobot: (robot: Robot, gameType: GameType) => void;
  onTutorialShown: () => void;
  onRequestVenueMap: () => void;
  venueMapCloseSignal: number;
  shouldShowTutorial: boolean;
  tutorialVariant?: "default" | "blackjack-unlock" | "poker-unlock";
}) {
  const [tutorialStep, setTutorialStep] = useState<
    "rules" | "rules-close" | "spec" | "spec-close" | "map" | "start" | "done"
  >(shouldShowTutorial ? "rules" : "done");
  const [isTutorialDialogVisible, setIsTutorialDialogVisible] =
    useState(shouldShowTutorial);
  const shouldRenderTutorialDialog =
    shouldShowTutorial && isTutorialDialogVisible;
  const isTutorialBlocking = shouldShowTutorial && tutorialStep !== "start" && tutorialStep !== "done";
  const tutorialMessages =
    tutorialVariant === "poker-unlock"
      ? {
          rules: "第3ステージはポーカーにも挑戦していただきます。まずはゲームのルールを確認しましょう。青く光る本のボタンを押してください。",
          rulesClose: "ゲームルールを確認したら、右上の×ボタンで閉じてください。",
          spec: "次にポーカーロボットの仕様を確認します。緑に光っている情報ボタンを押してください。",
          specClose: "ロボットの仕様を確認したら、右上の×ボタンで閉じてください。",
        }
      : tutorialVariant === "blackjack-unlock"
      ? {
          rules:
            "第2ステージはブラックジャックにも挑戦していただきます。まずはゲームのルールを確認しましょう。青く光る本のボタンを押してください。",
          rulesClose:
            "ゲームルールを確認したら、右上の×ボタンで閉じてください。",
          spec:
            "次にブラックジャックロボットの仕様を確認します。緑に光っている情報ボタンを押してください。",
          specClose:
            "ロボットの仕様を確認したら、右上の×ボタンで閉じてください。",
        }
      : {
          rules:
            "まずゲームのルールを確認します。青く光っている本のボタンを押してください。",
          rulesClose:
            "ゲームルールを確認したら、右上の×ボタンで閉じてください。",
          spec:
            "次にロボットの仕様を確認します。緑に光っている情報ボタンを押してください。",
          specClose:
            "ロボットの仕様を確認したら、右上の×ボタンで閉じてください。",
        };
  const currentSeat = focusedGameType ? getGameSeat(focusedGameType) : "top";
  const currentImage = viewImage[currentSeat];

  useEffect(() => {
    if (modalCloseSignal === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setTutorialStep((current) => {
        if (current === "rules-close") {
          setIsTutorialDialogVisible(true);
          return "spec";
        }

        if (current === "spec-close") {
          setIsTutorialDialogVisible(false);
          return tutorialVariant === "default" ? "map" : "start";
        }

        return current;
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [modalCloseSignal, tutorialVariant]);

  useEffect(() => {
    function handleModalClosed() {
      setTutorialStep((current) => {
        if (current === "rules-close") {
          setIsTutorialDialogVisible(true);
          return "spec";
        }

        if (current === "spec-close") {
          setIsTutorialDialogVisible(false);
          return tutorialVariant === "default" ? "map" : "start";
        }

        return current;
      });
    }

    window.addEventListener("casino-rule-modal-closed", handleModalClosed);

    return () => {
      window.removeEventListener("casino-rule-modal-closed", handleModalClosed);
    };
  }, [tutorialVariant]);

  useEffect(() => {
    if (tutorialStep === "map") onRequestVenueMap();
  }, [tutorialStep, onRequestVenueMap]);

  useEffect(() => {
    if (venueMapCloseSignal > 0) {
      setTutorialStep((current) => current === "map" ? "start" : current);
    }
  }, [venueMapCloseSignal]);

  return (
    <div className="relative bg-black">
      {shouldRenderTutorialDialog && tutorialStep === "rules" ? (
        <TutorialDialog
          onDismiss={() => setIsTutorialDialogVisible(false)}
          text={tutorialMessages.rules}
          tone="rules"
        />
      ) : shouldRenderTutorialDialog && tutorialStep === "rules-close" ? (
        <TutorialDialog
          onDismiss={() => setIsTutorialDialogVisible(false)}
          text={tutorialMessages.rulesClose}
          tone="rules"
        />
      ) : shouldRenderTutorialDialog && tutorialStep === "spec" ? (
        <TutorialDialog
          onDismiss={() => setIsTutorialDialogVisible(false)}
          text={tutorialMessages.spec}
          tone="spec"
        />
      ) : shouldRenderTutorialDialog && tutorialStep === "spec-close" ? (
        <TutorialDialog
          onDismiss={() => setIsTutorialDialogVisible(false)}
          text={tutorialMessages.specClose}
          tone="spec"
        />
      ) : null}
      <div className="relative mb-[19rem] aspect-[1402/1124] min-h-[330px] overflow-visible max-[424px]:mb-[17rem] max-[424px]:min-h-[270px] max-[374px]:min-h-[240px] max-[340px]:min-h-[220px] sm:mb-[27rem] sm:min-h-[560px]">
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
                    ロボットチップ
                  </p>
                  <p className="text-2xl font-black leading-none text-brass sm:text-4xl">
                    {focusedRobot.chips}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="absolute inset-x-3 bottom-0 z-20 translate-y-[calc(100%+12px)] rounded border border-stone-200 bg-white p-3 text-stone-950 shadow-[0_12px_28px_rgba(0,0,0,0.45)] max-[424px]:inset-x-1.5 max-[424px]:p-2 max-[374px]:inset-x-0 sm:inset-x-6 sm:translate-y-[calc(100%+20px)] sm:p-4">
              <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 max-[424px]:grid-cols-[38px_minmax(0,1fr)_38px] max-[424px]:gap-1.5 max-[374px]:grid-cols-[34px_minmax(0,1fr)_34px]">
                <button
                  aria-label="前のゲーム種類"
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded border border-stone-300 max-[424px]:h-[38px] max-[424px]:w-[38px] max-[374px]:h-[34px] max-[374px]:w-[34px] ${
                    canFocusPrevious
                      ? "bg-stone-100 text-stone-950 hover:bg-stone-200"
                      : "cursor-not-allowed bg-stone-200 text-stone-400 opacity-45"
                  }`}
                  disabled={!canFocusPrevious || isTutorialBlocking}
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
                  disabled={!canFocusNext || isTutorialBlocking}
                  onClick={() => onFocusRobot(1)}
                  type="button"
                >
                  <ChevronRight size={22} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-[44px_44px_minmax(0,1fr)] gap-2 max-[424px]:mt-2 max-[424px]:grid-cols-[38px_38px_minmax(0,1fr)] max-[424px]:gap-1.5 max-[374px]:grid-cols-[34px_34px_minmax(0,1fr)]">
                <button
                  aria-label={`${focusedRobot.name}のルール`}
                  disabled={!isGameUnlocked}
                  className={`grid h-11 place-items-center rounded border text-stone-950 max-[424px]:h-[38px] max-[374px]:h-[34px] ${
                    tutorialStep === "rules"
                      ? "relative z-10 border-2 border-sky-900 bg-sky-300 ring-4 ring-sky-400 shadow-[0_0_24px_rgba(14,165,233,0.8)]"
                      : "border-stone-300 bg-stone-100 hover:bg-stone-200"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                  onClick={() => {
                    if (!isGameUnlocked) return;
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
                    if (!isGameUnlocked) return;
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
                  disabled={!isGameUnlocked}
                  className={`grid h-11 place-items-center rounded border text-stone-950 max-[424px]:h-[38px] max-[374px]:h-[34px] ${
                    tutorialStep === "spec"
                      ? "relative z-10 border-2 border-emerald-900 bg-emerald-300 ring-4 ring-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.8)]"
                      : "border-stone-300 bg-stone-100 hover:bg-stone-200"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                  onClick={() => {
                    if (!isGameUnlocked) return;
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
                    if (!isGameUnlocked) return;
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
                {!isGameUnlocked || !focusedGameType || isTutorialBlocking ? (
                  <button
                    className="h-11 cursor-not-allowed rounded bg-stone-700 px-3 text-sm font-bold text-stone-400 max-[424px]:h-[38px] max-[424px]:px-2 max-[424px]:text-xs max-[374px]:h-[34px]"
                    disabled
                    type="button"
                  >
                    ゲームテーブルへ
                  </button>
                ) : (
                  <button
                    className={`grid h-11 place-items-center rounded px-3 text-sm font-bold text-white max-[424px]:h-[38px] max-[424px]:px-2 max-[424px]:text-xs max-[374px]:h-[34px] ${
                      tutorialStep === "start"
                        ? "animate-pulse bg-casinoRed shadow-[0_0_0_4px_rgba(180,31,44,0.26)] hover:bg-red-700"
                        : "bg-casinoRed hover:bg-red-700"
                    }`}
                    onClick={() => {
                      if (isTutorialBlocking) return;
                      onTutorialShown();
                      setTutorialStep("done");
                      setIsTutorialDialogVisible(false);
                      onSelectRobot(focusedRobot, focusedGameType);
                    }}
                    type="button"
                  >
                    ゲームテーブルへ
                  </button>
                )}
              </div>
            </div>
          </>
        ) : null}

      </div>

    </div>
  );
}

type BlackjackPhase =
  | "idle"
  | "opening-card"
  | "first-card"
  | "second-card"
  | "result";
type BlackjackActiveGame = "ready" | "high-low" | "blackjack";

function BlackjackBattle({
  hand,
  isRiddleExchangeTimingRevealed,
  onNextBattle,
  onAdvanceToThirdStage,
  onOpenModal,
  onRevealRiddleExchangeTiming,
  robot,
  robotId,
}: {
  hand: PlayingCard[];
  isRiddleExchangeTimingRevealed: boolean;
  onNextBattle: (robotId: string) => void;
  onAdvanceToThirdStage: () => void;
  onOpenModal: (kind: ModalKind, gameType: GameType) => void;
  onRevealRiddleExchangeTiming: () => void;
  robot: Robot;
  robotId: string;
}) {
  const config =
    robotId in blackjackBattleConfigs
      ? blackjackBattleConfigs[robotId as keyof typeof blackjackBattleConfigs]
      : null;
  const canExchangePlayerHand =
    robotId === "blackjack-2-1";
  const canUseScan = robotId === "blackjack-2-2" || robotId === "blackjack-2-3";
  const isPrintedScanBattle = robotId === "blackjack-2-2";
  const physicalScanConfig =
    robotId in physicalScanConfigs
      ? physicalScanConfigs[robotId as keyof typeof physicalScanConfigs]
      : null;
  const isFinalBattle = robotId === "all-games-last";
  const areRobotHandsExchangeDisabled =
    robotId !== "blackjack-2-1" && robotId !== "blackjack-high-low-2-3";
  const [preparationAbility, setPreparationAbility] =
    useSessionState<PreparationAbility>(
      `stage-2:BlackjackBattle:${robotId}:preparationAbility`, canUseScan ? "scan" : "exchange",
    );
  const [scannedItems, setScannedItems] = useSessionState<string[]>(`stage-2:BlackjackBattle:${robotId}:scannedItems`, []);
  const [scanTutorialAnswer, setScanTutorialAnswer] = useSessionState(`stage-2:BlackjackBattle:${robotId}:scanTutorialAnswer`, "");
  const [isScanTutorialAnswerSolved, setIsScanTutorialAnswerSolved] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:isScanTutorialAnswerSolved`, false);
  const [scanTutorialIllustrationName, setScanTutorialIllustrationName] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:scanTutorialIllustrationName`, "");
  const [scanTutorialSplit, setScanTutorialSplit] = useSessionState(`stage-2:BlackjackBattle:${robotId}:scanTutorialSplit`, "");
  const [isScanTutorialComplete, setIsScanTutorialComplete] = useSessionState(`stage-2:BlackjackBattle:${robotId}:isScanTutorialComplete`, false);
  const [scanTutorialMessage, setScanTutorialMessage] = useSessionState(`stage-2:BlackjackBattle:${robotId}:scanTutorialMessage`, "");
  const [scanRiddleAnswerOne, setScanRiddleAnswerOne] = useSessionState(`stage-2:BlackjackBattle:${robotId}:scanRiddleAnswerOne`, "");
  const [scanRiddleIllustrationOne, setScanRiddleIllustrationOne] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:scanRiddleIllustrationOne`, "");
  const [
    scanRiddleIllustrationOneSplitIndexes,
    setScanRiddleIllustrationOneSplitIndexes,
  ] = useSessionState<number[]>(`stage-2:BlackjackBattle:${robotId}:scanRiddleIllustrationOneSplitIndexes`, []);
  const [scanRiddleAnswerTwo, setScanRiddleAnswerTwo] = useSessionState(`stage-2:BlackjackBattle:${robotId}:scanRiddleAnswerTwo`, "");
  const [scanRiddleIllustrationTwo, setScanRiddleIllustrationTwo] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:scanRiddleIllustrationTwo`, "");
  const [
    scanRiddleIllustrationTwoSplitIndexes,
    setScanRiddleIllustrationTwoSplitIndexes,
  ] = useSessionState<number[]>(`stage-2:BlackjackBattle:${robotId}:scanRiddleIllustrationTwoSplitIndexes`, []);
  const [postTutorialScanAnswer, setPostTutorialScanAnswer] = useSessionState(`stage-2:BlackjackBattle:${robotId}:postTutorialScanAnswer`, "");
  const [
    postTutorialScanIllustrationName,
    setPostTutorialScanIllustrationName,
  ] = useSessionState(`stage-2:BlackjackBattle:${robotId}:postTutorialScanIllustrationName`, "");
  const [
    postTutorialScanSplitIndexes,
    setPostTutorialScanSplitIndexes,
  ] = useSessionState<number[]>(`stage-2:BlackjackBattle:${robotId}:postTutorialScanSplitIndexes`, []);
  const [isRiddleExchangeModeActive, setIsRiddleExchangeModeActive] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:isRiddleExchangeModeActive`, false);
  const [isCardExchangeModeActive, setIsCardExchangeModeActive] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:isCardExchangeModeActive`, false);
  const [isRiddlePrintExchangeApplied, setIsRiddlePrintExchangeApplied] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:isRiddlePrintExchangeApplied`, false);
  const [fourthScanAnswer, setFourthScanAnswer] = useSessionState(`stage-2:BlackjackBattle:${robotId}:fourthScanAnswer`, "");
  const [fourthScanIllustration, setFourthScanIllustration] = useSessionState(`stage-2:BlackjackBattle:${robotId}:fourthScanIllustration`, "");
  const [fourthScanSplitIndexes, setFourthScanSplitIndexes] = useSessionState<
    number[]
  >(`stage-2:BlackjackBattle:${robotId}:fourthScanSplitIndexes`, []);
  const [isFourthScanGenerated, setIsFourthScanGenerated] = useSessionState(`stage-2:BlackjackBattle:${robotId}:isFourthScanGenerated`, false);
  const [fourthRobotExchangeCardIds, setFourthRobotExchangeCardIds] = useSessionState<
    string[]
  >(`stage-2:BlackjackBattle:${robotId}:fourthRobotExchangeCardIds`, []);
  const [
    isFourthRobotExchangeConfirmed,
    setIsFourthRobotExchangeConfirmed,
  ] = useSessionState(`stage-2:BlackjackBattle:${robotId}:isFourthRobotExchangeConfirmed`, false);
  const [
    areScanRiddleAnswersConfirmed,
    setAreScanRiddleAnswersConfirmed,
  ] = useSessionState(`stage-2:BlackjackBattle:${robotId}:areScanRiddleAnswersConfirmed`, false);
  const [scanRiddleAnswerResults, setScanRiddleAnswerResults] = useSessionState<{
    one: boolean | null;
    two: boolean | null;
  }>(`stage-2:BlackjackBattle:${robotId}:scanRiddleAnswerResults`, { one: null, two: null });
  const [
    scanRiddleIllustrationResults,
    setScanRiddleIllustrationResults,
  ] = useSessionState<{
    one: boolean | null;
    two: boolean | null;
  }>(`stage-2:BlackjackBattle:${robotId}:scanRiddleIllustrationResults`, { one: null, two: null });
  const [areScanRiddleAnswersSolved, setAreScanRiddleAnswersSolved] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:areScanRiddleAnswersSolved`, false);
  const [scanExchangeChoice, setScanExchangeChoice] = useSessionState<string | null>(
    `stage-2:BlackjackBattle:${robotId}:scanExchangeChoice`, null,
  );
  const [scanGeneratedPreviewSources, setScanGeneratedPreviewSources] = useSessionState<string[]>(`stage-2:BlackjackBattle:${robotId}:scanGeneratedPreviewSources`, []);
  const [expandedRiddleImage, setExpandedRiddleImage] = useSessionState<{
    alt: string;
    src: string;
  } | null>(`stage-2:BlackjackBattle:${robotId}:expandedRiddleImage`, null);
  const [showScanPrintedItemsDialog, setShowScanPrintedItemsDialog] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:showScanPrintedItemsDialog`, false);
  const [isScanSpecVisible, setIsScanSpecVisible] = useSessionState(`stage-2:BlackjackBattle:${robotId}:isScanSpecVisible`, true);
  const [isScanCardExchanged, setIsScanCardExchanged] = useSessionState(`stage-2:BlackjackBattle:${robotId}:isScanCardExchanged`, false);
  const [scanExchangeCardIds, setScanExchangeCardIds] = useSessionState<string[]>(`stage-2:BlackjackBattle:${robotId}:scanExchangeCardIds`, []);
  const [isScanExchangeConfirmed, setIsScanExchangeConfirmed] = useSessionState(`stage-2:BlackjackBattle:${robotId}:isScanExchangeConfirmed`, false);
  const [showPhysicalScanGuideDialog, setShowPhysicalScanGuideDialog] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:showPhysicalScanGuideDialog`, false);
  const [physicalScanCardIds, setPhysicalScanCardIds] = useSessionState<string[]>(`stage-2:BlackjackBattle:${robotId}:physicalScanCardIds`, []);
  const [consumedPhysicalScanCardIds, setConsumedPhysicalScanCardIds] = useSessionState<string[]>(`stage-2:BlackjackBattle:${robotId}:consumedPhysicalScanCardIds`, []);
  const [physicalScanReading, setPhysicalScanReading] = useSessionState(`stage-2:BlackjackBattle:${robotId}:physicalScanReading`, "");
  const [physicalScanSplitIndexes, setPhysicalScanSplitIndexes] = useSessionState<
    number[]
  >(`stage-2:BlackjackBattle:${robotId}:physicalScanSplitIndexes`, []);
  const [isPhysicalScanGenerated, setIsPhysicalScanGenerated] = useSessionState(`stage-2:BlackjackBattle:${robotId}:isPhysicalScanGenerated`, false);
  const [physicalScanMessage, setPhysicalScanMessage] = useSessionState(`stage-2:BlackjackBattle:${robotId}:physicalScanMessage`, "");
  const [
    showPhysicalScanDisposalDialog,
    setShowPhysicalScanDisposalDialog,
  ] = useSessionState(`stage-2:BlackjackBattle:${robotId}:showPhysicalScanDisposalDialog`, false);
  const [
    showRiddlePrintChangedDialog,
    setShowRiddlePrintChangedDialog,
  ] = useSessionState(`stage-2:BlackjackBattle:${robotId}:showRiddlePrintChangedDialog`, false);
  const physicalScanPanelRef = useRef<HTMLDivElement | null>(null);
  const [selectedRiddlePrintIds, setSelectedRiddlePrintIds] = useSessionState<string[]>(
    `stage-2:BlackjackBattle:${robotId}:selectedRiddlePrintIds`, [],
  );
  const scannedOneCard = generatedScanCards["scan-10"];
  const scannedTwelveCard = generatedScanCards["scan-12"];
  const scannedNineCard = generatedScanCards["scan-9"];
  const fourthScanGeneratedExchangeCards = isFourthScanGenerated
    ? [scannedTwelveCard, scannedNineCard]
    : [scannedTwelveCard];
  const canSelectFourthRobotExchangeCards =
    isRiddleExchangeModeActive && !isFourthRobotExchangeConfirmed;
  const canConfirmFourthRobotExchange =
    canSelectFourthRobotExchangeCards && fourthRobotExchangeCardIds.length === 2;
  const canConfirmRiddlePrintExchange =
    isRiddleExchangeModeActive && selectedRiddlePrintIds.length === 2;
  const scannedPhysicalScanCard = physicalScanConfig
    ? generatedScanCards[physicalScanConfig.generatedCardId]
    : generatedScanCards["scan-3"];
  const priorTutorialGeneratedCards =
    robotId === "blackjack-2-3" ? [scannedTwelveCard] : [];
  const scannedGeneratedCards = isPrintedScanBattle
    ? [scannedOneCard, scannedTwelveCard]
    : [
        ...priorTutorialGeneratedCards,
        ...(robotId === "blackjack-2-3" && scannedItems.includes("scan-9") ? [scannedNineCard] : []),
        ...(isPhysicalScanGenerated ? [scannedPhysicalScanCard] : []),
      ];
  const scanGeneratedDisplayCards = [
    ...scannedGeneratedCards,
    ...(isPrintedScanBattle && isPhysicalScanGenerated
      ? [scannedPhysicalScanCard]
      : []),
  ];
  const physicalScanInventoryCards = physicalScanConfig?.inventoryCards ?? [];
  const isPhysicalScanReadingCorrect =
    !physicalScanConfig ||
    !("requiredReading" in physicalScanConfig) ||
    physicalScanReading === physicalScanConfig.requiredReading;
  const isPhysicalScanCardCountReady =
    physicalScanCardIds.length ===
    (physicalScanConfig?.requiredSelectionCount ?? 0);
  const canRunPhysicalScan =
    isPhysicalScanCardCountReady && physicalScanReading.trim().length > 0;
  const visiblePhysicalScanInventoryCards = Array.from(new Map([
    ...physicalScanInventoryCards,
    ...priorTutorialGeneratedCards,
    ...getCardsById(scannedItems, generatedScanCards),
  ].map((card) => [card.id, card])).values()).filter(
    (card) =>
      // Older sessions granted a jack for solving the unlock riddle, without scanning it.
      !(isPrintedScanBattle && card.id === "scan-J") &&
      !consumedPhysicalScanCardIds.includes(card.id),
  );
  const areScanCardsGenerated = scannedGeneratedCards.every((card) =>
    scannedItems.includes(card.id),
  );
  const shouldShowScanGeneratedCards = isPrintedScanBattle
    ? areScanCardsGenerated ||
      areScanRiddleAnswersSolved ||
      (scanRiddleIllustrationResults.one === true &&
        scanRiddleIllustrationResults.two === true)
    : scanGeneratedDisplayCards.length > 0;
  const canSelectRiddlePrints = robotId === "blackjack-high-low-2-3" || robotId === "blackjack-2-3";
  const remainingSecondStageExchanges = robotId === "blackjack-high-low-2-3"
    ? 2 - Number(isRiddlePrintExchangeApplied) - Number(isFourthRobotExchangeConfirmed)
    : 1 - Number(isScanExchangeConfirmed) - Number(isRiddlePrintExchangeApplied);
  const remainingSecondStageScans = 1 - Number(
    scannedItems.includes("scan-9") || scannedItems.includes("scan-A"),
  );
  const highLowRobotExchangeCards =
    config && "highLowRobotHandIds" in config
      ? getCardsById([...config.highLowRobotHandIds])
      : [];
  const scanExchangeSections: ExchangeCardSection[] =
    config && canUseScan
      ? [
          {
            cards: getCardsById([...config.initialPlayerHandIds]),
            id: "scan-player-hand",
            label: "プレイヤーの手札",
          },
          ...(highLowRobotExchangeCards.length > 0
            ? [
                {
                  cards: highLowRobotExchangeCards,
                  disabled: areRobotHandsExchangeDisabled,
                  id: "scan-high-low-robot-hand",
                  label: "ハイ＆ローのロボット手札",
                },
              ]
            : []),
          {
            cards: getCardsById([...config.initialRobotHandIds]),
            disabled: areRobotHandsExchangeDisabled,
            id: "scan-robot-hand",
            label: "ブラックジャックのロボット手札",
          },
          ...(shouldShowScanGeneratedCards
            ? [
                {
                  cards: scanGeneratedDisplayCards,
                  id: "scan-generated-card",
                  label: "スキャン生成カード",
                },
              ]
            : []),
        ]
      : [];
  const isScanExchangeCorrect =
    config && canUseScan
      ? scanExchangeCardIds.length === 2 &&
        (robotId === "blackjack-2-3"
          ? scanExchangeCardIds.includes(scannedPhysicalScanCard.id) &&
            scanExchangeCardIds.some((cardId) => {
              const selectedCard = getCardsById([cardId])[0] ?? null;
              const initialPlayerHandIds: readonly string[] =
                config.initialPlayerHandIds;

              return (
                initialPlayerHandIds.includes(cardId) &&
                selectedCard?.rank === "K"
              );
            })
          : scanExchangeCardIds.includes(scannedOneCard.id) &&
            scanExchangeCardIds.some((cardId) => {
              const selectedCard = getCardsById([cardId])[0] ?? null;
              const initialPlayerHandIds: readonly string[] =
                config.initialPlayerHandIds;

              return (
                initialPlayerHandIds.includes(cardId) &&
                selectedCard?.rank === "A"
              );
            }))
      : false;
  const [blackjackExchangeCardIds, setBlackjackExchangeCardIds] = useSessionState<
    string[]
  >(`stage-2:BlackjackBattle:${robotId}:blackjackExchangeCardIds`, []);
  const [isBlackjackExchangeConfirmed, setIsBlackjackExchangeConfirmed] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:isBlackjackExchangeConfirmed`, false);
  const blackjackExchangeSections: ExchangeCardSection[] =
    config && canExchangePlayerHand
      ? [
          {
            cards: getCardsById([...config.initialPlayerHandIds]),
            id: "blackjack-player-hand",
            label: "プレイヤーの手札",
          },
          ...(highLowRobotExchangeCards.length > 0
            ? [
                {
                  cards: highLowRobotExchangeCards,
                  disabled: areRobotHandsExchangeDisabled,
                  id: "blackjack-high-low-robot-hand",
                  label: "ハイ＆ローのロボット手札",
                },
              ]
            : []),
          {
            cards: getCardsById([...config.initialRobotHandIds]),
            disabled: areRobotHandsExchangeDisabled,
            id: "blackjack-robot-hand",
            label: "ブラックジャックのロボット手札",
          },
        ]
      : [];
  const confirmedExchangeCardIds = isFourthRobotExchangeConfirmed
    ? fourthRobotExchangeCardIds
    : isScanExchangeConfirmed
      ? scanExchangeCardIds
      : isBlackjackExchangeConfirmed
        ? blackjackExchangeCardIds
        : [];
  const playerHandIds =
    config
      ? swapSelectedCardIds([...config.initialPlayerHandIds], confirmedExchangeCardIds)
        : [];
  const playerHand = config
    ? getCardsById(playerHandIds, generatedScanCards)
    : hand;
  const robotHandIds =
    config
      ? swapSelectedCardIds([...config.initialRobotHandIds], confirmedExchangeCardIds)
        : [];
  const robotHand = config
    ? getCardsById(robotHandIds, generatedScanCards)
    : hand.slice().reverse();
  const highLowRobotHand =
    config && "highLowRobotHandIds" in config
      ? getCardsById(
          swapSelectedCardIds([...config.highLowRobotHandIds], confirmedExchangeCardIds),
          generatedScanCards,
        )
      : [];
  const [phase, setPhase] = useSessionState<BlackjackPhase>(`stage-2:BlackjackBattle:${robotId}:phase`, "idle");
  const [settledResult, setSettledResult] = useSessionState<Outcome | null>(`stage-2:BlackjackBattle:${robotId}:settledResult`, null);
  const [message, setMessage] = useSessionState(`stage-2:BlackjackBattle:${robotId}:message`, "全ての対戦に勝利しましょう。");
  const [placementAnimation, setPlacementAnimation] =
    useState<PlacementStyle | null>(null);
  const [placementAnimationMode, setPlacementAnimationMode] =
    useState<"hold" | "release">("release");
  const [showBlackjackDeclaration, setShowBlackjackDeclaration] =
    useState(false);
  const [blackjackResultOverlayDismissed, setBlackjackResultOverlayDismissed] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:blackjackResultOverlayDismissed`, false);
  const [blackjackSecondPlacementPending, setBlackjackSecondPlacementPending] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:blackjackSecondPlacementPending`, false);
  const [isFinalPreparationApplied, setIsFinalPreparationApplied] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:isFinalPreparationApplied`, false);
  const [showPreparation, setShowPreparation] = useSessionState(`stage-2:BlackjackBattle:${robotId}:showPreparation`, false);
  const [showSecondStageIntro, setShowSecondStageIntro] = useSessionState(
    `stage-2:BlackjackBattle:${robotId}:showSecondStageIntro`, robotId === "blackjack-2-1",
  );
  const [showScanUnlockDialog, setShowScanUnlockDialog] = useSessionState(
    `stage-2:BlackjackBattle:${robotId}:showScanUnlockDialog`, robotId === "blackjack-2-2",
  );
  const [hasDismissedScanAbilityIntro, setHasDismissedScanAbilityIntro] = useSessionState(`stage-2:BlackjackBattle:${robotId}:hasDismissedScanAbilityIntro`, false);
  const [showTrafficLightScanHint, setShowTrafficLightScanHint] = useSessionState(`stage-2:BlackjackBattle:${robotId}:showTrafficLightScanHint`, false);
  const hasShownTrafficLightScanHint = useRef(false);
  const [
    shouldHighlightScanPreparationButton,
    setShouldHighlightScanPreparationButton,
  ] = useSessionState(`stage-2:BlackjackBattle:${robotId}:shouldHighlightScanPreparationButton`, robotId === "blackjack-2-2");
  const [activeBlackjackGame, setActiveBlackjackGame] =
    useSessionState<BlackjackActiveGame>(`stage-2:BlackjackBattle:${robotId}:activeBlackjackGame`, "ready");
  const [blackjackHighLowPlayerZone, setBlackjackHighLowPlayerZone] =
    useSessionState<HighLowZoneName | null>(`stage-2:BlackjackBattle:${robotId}:blackjackHighLowPlayerZone`, null);
  const [blackjackHighLowPlayerCardId, setBlackjackHighLowPlayerCardId] =
    useSessionState<string | null>(`stage-2:BlackjackBattle:${robotId}:blackjackHighLowPlayerCardId`, null);
  const [blackjackHighLowPlacementPending, setBlackjackHighLowPlacementPending] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:blackjackHighLowPlacementPending`, false);
  const [blackjackHighLowPlacementConfirmed, setBlackjackHighLowPlacementConfirmed] =
    useSessionState(`stage-2:BlackjackBattle:${robotId}:blackjackHighLowPlacementConfirmed`, false);
  const [blackjackHighLowPlacementAnimation, setBlackjackHighLowPlacementAnimation] =
    useState<{
      mode: "hold" | "release";
      styleType: PlacementStyle;
      zone: HighLowZoneName;
    } | null>(null);
  const [blackjackDraggingCardId, setBlackjackDraggingCardId] = useState<
    string | null
  >(null);
  const [blackjackDragPreviewPoint, setBlackjackDragPreviewPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [blackjackPlacedCardIds, setBlackjackPlacedCardIds] = useSessionState<string[]>(
    `stage-2:BlackjackBattle:${robotId}:blackjackPlacedCardIds`, [],
  );
  const playerFirstCard = playerHand[0] ?? null;
  const orderedBlackjackRobotHand = [...robotHand].sort((a, b) => getBlackjackOrderValue(b.rank) - getBlackjackOrderValue(a.rank));
  const robotFirstCard = orderedBlackjackRobotHand[0] ?? null;
  const [blackjackFirstPlacementPending, setBlackjackFirstPlacementPending] = useSessionState(`stage-2:BlackjackBattle:${robotId}:blackjackFirstPlacementPending`, false);
  const [blackjackOrderError, setBlackjackOrderError] = useState(false);
  const blackjackGuaranteedWinOpening = getGuaranteedWinOpening(playerHand.map(getHighLowCardValue), highLowRobotHand.map(getHighLowCardValue));
  const blackjackHighLowRobotCard = highLowRobotHand[blackjackGuaranteedWinOpening ?? 0] ?? null;
  const blackjackHighLowPlayerCard =
    (blackjackHighLowPlayerCardId
      ? playerHand.find((card) => card.id === blackjackHighLowPlayerCardId)
      : null) ??
    playerFirstCard;
  const blackjackHighLowRobotZone: HighLowZoneName = blackjackGuaranteedWinOpening !== null ? "LOW" : "HIGH";
  const blackjackHighLowHighCard =
    blackjackHighLowRobotZone === "HIGH"
      ? blackjackHighLowRobotCard
      : blackjackHighLowPlayerZone === "HIGH"
        ? blackjackHighLowPlayerCard
        : null;
  const blackjackHighLowLowCard =
    blackjackHighLowRobotZone === "LOW"
      ? blackjackHighLowRobotCard
      : blackjackHighLowPlayerZone === "LOW"
        ? blackjackHighLowPlayerCard
        : null;
  const blackjackHighLowResult =
    blackjackHighLowPlacementConfirmed &&
    blackjackHighLowHighCard &&
    blackjackHighLowLowCard
      ? getHighLowResult(blackjackHighLowHighCard, blackjackHighLowLowCard)
      : null;
  const playerScore = getBlackjackScore(playerHand);
  const playerHasBlackjack = playerScore === 21;
  const highLowChainResult =
    isFinalBattle
      ? "win"
      : robotId === "blackjack-2-2" && isScanCardExchanged
      ? "win"
      : blackjackHighLowPlacementConfirmed && blackjackHighLowResult
      ? blackjackHighLowResult
      : highLowRobotHand.length > 0 && highLowRobotHand[0] && playerHand[0]
      ? getHighLowResult(highLowRobotHand[0], playerHand[0])
      : null;
  const learningRestriction: string | null =
    config &&
    "learningRestriction" in config &&
    typeof config.learningRestriction === "string"
      ? config.learningRestriction
      : null;
  const disabledExchangeTargets: ExchangeTargetId[] = [
    ...(robotId === "blackjack-high-low-2-3"
      ? (["player-hand"] as const)
      : []),
  ];
  const result =
    phase === "result"
      ? settledResult ?? getBlackjackResult(playerHand, robotHand)
      : null;
  const showBlackjackResultOverlay =
    (result === "win" || result === "lose") && !blackjackResultOverlayDismissed;
  const samePrintTimingLabel = isRiddleExchangeTimingRevealed
    ? "小謎の紙"
    : "対象が同じ紙面上の場合";
  const blackjackPlacementConfirmationControls = blackjackFirstPlacementPending || blackjackSecondPlacementPending ? (
    <div className="mt-3 grid grid-cols-2 gap-2 rounded border border-brass/45 bg-black/35 p-3">
      <button
        className="min-h-11 rounded bg-brass px-4 text-sm font-black text-stone-950 hover:bg-yellow-300"
        onClick={blackjackFirstPlacementPending ? confirmBlackjackFirstPlacement : confirmBlackjackSecondPlacement}
        type="button"
      >
        確定
      </button>
      <button
        className="min-h-11 rounded border border-white/15 bg-white/8 px-4 text-sm font-black text-white hover:bg-white/14"
        onClick={blackjackFirstPlacementPending ? resetBlackjackFirstPlacement : resetBlackjackSecondPlacement}
        type="button"
      >
        選び直し
      </button>
    </div>
  ) : null;
  const blackjackHighLowPlacementConfirmationControls =
    blackjackHighLowPlacementPending ? (
      <div className="mt-3 grid grid-cols-2 gap-2 rounded border border-brass/45 bg-black/35 p-3">
        <button
          className="min-h-11 rounded bg-brass px-4 text-sm font-black text-stone-950 hover:bg-yellow-300"
          onClick={confirmBlackjackHighLowPlacement}
          type="button"
        >
          確定
        </button>
        <button
          className="min-h-11 rounded border border-white/15 bg-white/8 px-4 text-sm font-black text-white hover:bg-white/14"
          onClick={resetBlackjackHighLowPlacement}
          type="button"
        >
          選び直し
        </button>
      </div>
    ) : null;
  const canOpenPreparation =
    phase === "idle" &&
    activeBlackjackGame === "ready" &&
    (canExchangePlayerHand || canUseScan || canSelectRiddlePrints || isFinalBattle);
  const shouldPulsePreparationButton =
    canUseScan &&
    shouldHighlightScanPreparationButton &&
    canOpenPreparation &&
    !showScanUnlockDialog &&
    !showPreparation;
  const isBlackjackStarted =
    activeBlackjackGame === "blackjack" && phase !== "idle";
  const isBlackjackFirstCardPlaced =
    phase === "first-card" || phase === "second-card" || phase === "result";
  const isBlackjackSecondCardPlaced =
    phase === "second-card" || phase === "result";
  const blackjackFirstPlacedCard =
    playerHand.find((card) => card.id === blackjackPlacedCardIds[0]) ?? null;
  const blackjackSecondPlacedCard =
    playerHand.find((card) => card.id === blackjackPlacedCardIds[1]) ?? null;
  const blackjackRobotFieldCards = robotFirstCard && isBlackjackFirstCardPlaced
    ? [
        robotFirstCard,
        ...(isBlackjackSecondCardPlaced &&
        !blackjackSecondPlacementPending &&
        orderedBlackjackRobotHand[1]
          ? [orderedBlackjackRobotHand[1]]
          : []),
      ]
    : [];
  const blackjackPlayerFieldCards =
    blackjackFirstPlacedCard && isBlackjackFirstCardPlaced
      ? [
          blackjackFirstPlacedCard,
          ...(isBlackjackSecondCardPlaced && blackjackSecondPlacedCard
            ? [blackjackSecondPlacedCard]
            : []),
        ]
      : [];
  const blackjackRobotFieldValue =
    blackjackRobotFieldCards.length > 0
      ? getBlackjackScore(blackjackRobotFieldCards)
      : null;
  const blackjackPlayerValueCards =
    blackjackPlayerFieldCards.length > 0
      ? blackjackSecondPlacementPending
        ? blackjackPlayerFieldCards.slice(0, 1)
        : blackjackPlayerFieldCards
      : [];
  const blackjackPlayerFieldValue =
    blackjackPlayerValueCards.length > 0
      ? getBlackjackScore(blackjackPlayerValueCards)
      : null;
  const visibleBlackjackRobotHand = isBlackjackFirstCardPlaced
    ? orderedBlackjackRobotHand.slice(
        isBlackjackSecondCardPlaced && !blackjackSecondPlacementPending ? 2 : 1,
      )
    : orderedBlackjackRobotHand;
  const visibleBlackjackPlayerHand = isBlackjackStarted
    ? playerHand.filter((card) => !blackjackPlacedCardIds.includes(card.id))
    : playerHand;
  const blackjackDraggableCardIds =
    blackjackFirstPlacementPending ? [] : isBlackjackStarted && phase === "opening-card"
      ? playerHand.map((card) => card.id)
      : isBlackjackStarted && phase === "first-card"
        ? playerHand
            .filter((card) => !blackjackPlacedCardIds.includes(card.id))
            .map((card) => card.id)
      : [];
  const blackjackDraggingCard =
    playerHand.find((card) => card.id === blackjackDraggingCardId) ?? null;
  const visibleActivePlayerHand =
    activeBlackjackGame === "high-low" && blackjackHighLowPlayerZone
      ? playerHand.filter((card) => card.id !== blackjackHighLowPlayerCard?.id)
      : visibleBlackjackPlayerHand;
  const visibleHighLowRobotHand =
    activeBlackjackGame === "high-low" && blackjackHighLowRobotCard
      ? highLowRobotHand.filter((card) => card.id !== blackjackHighLowRobotCard.id)
      : highLowRobotHand;
  const shouldShowGameStartHandState =
    phase === "idle" &&
    activeBlackjackGame === "ready" &&
    confirmedExchangeCardIds.length === 2;
  const isFourthBattlePreparationRequired =
    robotId === "blackjack-high-low-2-3" && !isFourthRobotExchangeConfirmed;

  function startRound() {
    if (!playerFirstCard || !robotFirstCard) {
      setMessage("手札が足りません。");
      return;
    }

    if (isFinalBattle && !isFinalPreparationApplied) {
      setMessage("先にファイナルゲーム用の事前準備を完了してください。");
      return;
    }

    if (isFourthBattlePreparationRequired) {
      setMessage("先に4戦目用のエクスチェンジとスキャンを完了してください。");
      return;
    }

    setSettledResult(null);
    setBlackjackResultOverlayDismissed(false);

    if (highLowRobotHand.length > 0 && activeBlackjackGame === "ready") {
      setActiveBlackjackGame("high-low");
      setBlackjackHighLowPlayerZone(null);
      setBlackjackHighLowPlayerCardId(null);
      setBlackjackHighLowPlacementPending(false);
      setBlackjackHighLowPlacementConfirmed(false);
      setBlackjackHighLowPlacementAnimation(null);
      setMessage("まずハイ＆ローで勝利しましょう。");
      return;
    }

    setMessage("1枚目をプレイヤーフィールドへ置いてください。");
    setActiveBlackjackGame("blackjack");
    setBlackjackPlacedCardIds([]);
    setPhase("opening-card");
  }

  function placeBlackjackHighLowCard(
    zone: HighLowZoneName,
    cardId = blackjackDraggingCardId ?? playerFirstCard?.id,
  ) {
    if (
      zone === blackjackHighLowRobotZone ||
      !cardId ||
      !playerHand.some((card) => card.id === cardId) ||
      blackjackHighLowPlacementPending ||
      blackjackHighLowPlacementConfirmed
    ) {
      return;
    }

    setBlackjackHighLowPlayerZone(zone);
    setBlackjackHighLowPlayerCardId(cardId);
    setBlackjackDraggingCardId(null);
    setBlackjackDragPreviewPoint(null);
    setBlackjackHighLowPlacementPending(true);
    setBlackjackHighLowPlacementAnimation({
      mode: "hold",
      styleType: "gentle",
      zone,
    });
  }

  function confirmBlackjackHighLowPlacement() {
    if (!blackjackHighLowPlayerZone || !blackjackHighLowPlayerCard) {
      return;
    }

    const zone = blackjackHighLowPlayerZone;
    setBlackjackHighLowPlacementPending(false);
    setBlackjackHighLowPlacementConfirmed(true);
    setBlackjackHighLowPlacementAnimation({
      mode: "release",
      styleType: "gentle",
      zone,
    });

    const highCard =
      blackjackHighLowRobotZone === "HIGH"
        ? blackjackHighLowRobotCard
        : zone === "HIGH"
          ? blackjackHighLowPlayerCard
          : null;
    const lowCard =
      blackjackHighLowRobotZone === "LOW"
        ? blackjackHighLowRobotCard
        : zone === "LOW"
          ? blackjackHighLowPlayerCard
          : null;
    const nextResult = highCard && lowCard ? getHighLowResult(highCard, lowCard) : null;

    if (nextResult === "win") {
      window.setTimeout(() => {
        setBlackjackHighLowPlacementAnimation(null);
        setActiveBlackjackGame("blackjack");
        setPhase("opening-card");
        setMessage("ハイ＆ローに勝利しました。1枚目をプレイヤーフィールドへ置いてください。");
      }, 900);
      return;
    }

    setSettledResult("lose");
    setPhase("result");
    setMessage("YOU LOSE。ハイ＆ローの条件を満たせませんでした。");
  }

  function resetBlackjackHighLowPlacement() {
    setBlackjackHighLowPlayerZone(null);
    setBlackjackHighLowPlayerCardId(null);
    setBlackjackHighLowPlacementPending(false);
    setBlackjackHighLowPlacementConfirmed(false);
    setBlackjackHighLowPlacementAnimation(null);
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
          ? "YOU WIN。ブラックジャックとハイ＆ローの両方に勝利しました。"
          : "YOU WIN。勝利条件を満たしました。"
        : blackjackOutcome === "draw"
          ? "引き分けのため、あなたの負けです。"
          : highLowChainResult === "lose"
            ? "YOU LOSE。ハイ＆ローの条件を満たせませんでした。"
            : "YOU LOSE。ロボットの勝利です。",
    );
    setPhase("result");
  }

  function placeSecondCard() {
    setBlackjackDraggingCardId(null);
    setBlackjackDragPreviewPoint(null);
    setPhase("second-card");
    setBlackjackSecondPlacementPending(true);
    setPlacementAnimation("gentle");
    setPlacementAnimationMode("hold");
    setMessage("この置き方で進めますか？");
  }

  function confirmBlackjackSecondPlacement() {
    setPlacementAnimation("gentle");

    if (playerHasBlackjack) {
      setPlacementAnimationMode("hold");
      setShowBlackjackDeclaration(true);
      window.setTimeout(() => {
        setShowBlackjackDeclaration(false);
        setBlackjackSecondPlacementPending(false);
        setPlacementAnimationMode("release");
      }, 1000);
      window.setTimeout(() => {
        setPlacementAnimation(null);
        revealSecondCard();
      }, 1760);
      return;
    }

    setBlackjackSecondPlacementPending(false);
    setPlacementAnimationMode("release");
    window.setTimeout(() => {
      setPlacementAnimation(null);
      revealSecondCard();
    }, 760);
  }

  function resetBlackjackSecondPlacement() {
    setBlackjackSecondPlacementPending(false);
    setBlackjackDraggingCardId(null);
    setBlackjackDragPreviewPoint(null);
    setBlackjackPlacedCardIds((current) => current.slice(0, 1));
    setPlacementAnimation(null);
    setPlacementAnimationMode("release");
    setShowBlackjackDeclaration(false);
    setPhase("first-card");
    setMessage("2枚目を1枚目に重ねてください。");
  }

  function dropBlackjackPlayerCard(droppedCardId = blackjackDraggingCardId) {
    if (activeBlackjackGame !== "blackjack") {
      return;
    }

    if (
      phase === "opening-card" &&
      droppedCardId &&
      playerHand.some((card) => card.id === droppedCardId)
    ) {
      setBlackjackPlacedCardIds([droppedCardId]);
      setBlackjackDraggingCardId(null);
      setBlackjackDragPreviewPoint(null);
      setPhase("first-card");
      setPlacementAnimation("gentle");
      setPlacementAnimationMode("hold");
      setBlackjackFirstPlacementPending(true);
      setMessage("この置き方で進めますか？");
      return;
    }

    if (
      phase === "first-card" &&
      !blackjackFirstPlacementPending &&
      droppedCardId &&
      playerHand.some((card) => card.id === droppedCardId) &&
      !blackjackPlacedCardIds.includes(droppedCardId)
    ) {
      setBlackjackPlacedCardIds((current) =>
        [...current, droppedCardId].slice(0, 2),
      );
      placeSecondCard();
    }
  }

  function confirmBlackjackFirstPlacement() {
    const card = playerHand.find((item) => item.id === blackjackPlacedCardIds[0]);
    if (!card || !isLargestBlackjackCard(card.rank, playerHand.map((item) => item.rank))) {
      setBlackjackOrderError(true);
      return;
    }
    setBlackjackFirstPlacementPending(false);
    setPlacementAnimationMode("release");
    setMessage("ロボットも1枚目を出しました。2枚目を1枚目に重ねてください。");
    window.setTimeout(() => setPlacementAnimation(null), 760);
  }

  function resetBlackjackFirstPlacement() {
    setBlackjackFirstPlacementPending(false);
    setBlackjackPlacedCardIds([]);
    setPhase("opening-card");
    setPlacementAnimation(null);
  }

  function resetRound() {
    setBlackjackFirstPlacementPending(false);
    if (robotId === "blackjack-high-low-2-3") {
      setIsFourthRobotExchangeConfirmed(false);
      setFourthRobotExchangeCardIds([]);
      setIsRiddleExchangeModeActive(false);
      setSelectedRiddlePrintIds([]);
      setScanTutorialMessage("");
    }
    setActiveBlackjackGame("ready");
    setPhase("idle");
    setSettledResult(null);
    setBlackjackResultOverlayDismissed(false);
    setPlacementAnimation(null);
    setPlacementAnimationMode("release");
    setShowBlackjackDeclaration(false);
    setBlackjackSecondPlacementPending(false);
    setBlackjackHighLowPlayerZone(null);
    setBlackjackHighLowPlayerCardId(null);
    setBlackjackHighLowPlacementPending(false);
    setBlackjackHighLowPlacementConfirmed(false);
    setBlackjackHighLowPlacementAnimation(null);
    setBlackjackDraggingCardId(null);
    setBlackjackDragPreviewPoint(null);
    setBlackjackPlacedCardIds([]);
    setMessage("全ての対戦に勝利しましょう。");
  }

  function toggleBlackjackExchangeCard(cardId: string) {
    if (!isCardExchangeModeActive) {
      setScanTutorialMessage("先にエクスチェンジを起動してください。");
      return;
    }

    setIsBlackjackExchangeConfirmed(false);
    setBlackjackExchangeCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      return [...current, cardId].slice(-2);
    });
  }

  function toggleScanExchangeCard(cardId: string) {
    if (robotId === "blackjack-2-3" && isRiddlePrintExchangeApplied) return;
    if (!isCardExchangeModeActive) {
      setScanTutorialMessage("先にエクスチェンジを起動してください。");
      return;
    }

    setIsScanExchangeConfirmed(false);
    setIsScanCardExchanged(false);
    setScanExchangeCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      return [...current, cardId].slice(-2);
    });
  }

  function solveScanTutorialRiddle() {
    if (scanTutorialAnswer.trim() !== "りすく") {
      setScanTutorialMessage("答えが違うようです。小謎をもう一度確認してください。");
      return;
    }

    setIsScanTutorialAnswerSolved(true);
    setIsScanTutorialComplete(true);
    setScanTutorialMessage("");
    setShowScanPrintedItemsDialog(true);
  }

  function runScanTutorial() {
    const normalizedSplit = normalizeScanIllustrationName(scanTutorialSplit);

    if (
      scanTutorialIllustrationName.trim() !== "すごろく" ||
      normalizedSplit !== "す ご ろく"
    ) {
      setScanTutorialMessage("上手くいかないようだ...");
      return;
    }

    setIsScanTutorialComplete(true);
    setScanTutorialMessage(
      "スキャン成功。すごろくを「す　ご　ろく」に区切ると、5 + 6 = 11。11のトランプを生成できます。",
    );
  }

  function solvePrintedScanRiddles() {
    const normalizedAnswerOne = normalizeRiddleAnswer(scanRiddleAnswerOne);
    const normalizedAnswerTwo = normalizeRiddleAnswer(scanRiddleAnswerTwo);
    const isAnswerOneCorrect = normalizedAnswerOne === "0315";
    const isAnswerTwoCorrect = normalizedAnswerTwo === "すいり";

    setScanRiddleAnswerResults({
      one: isAnswerOneCorrect,
      two: isAnswerTwoCorrect,
    });

    if (!isAnswerOneCorrect || !isAnswerTwoCorrect) {
      setAreScanRiddleAnswersConfirmed(false);
      setAreScanRiddleAnswersSolved(false);
      setScanExchangeChoice(null);
      setScanTutorialMessage(
        "正解している小謎は表示しました。未正解の答えをもう一度確認してください。",
      );
      return;
    }

    setAreScanRiddleAnswersConfirmed(true);
    if (isPrintedScanBattle && !hasShownTrafficLightScanHint.current) {
      hasShownTrafficLightScanHint.current = true;
      setShowTrafficLightScanHint(true);
    }
    setAreScanRiddleAnswersSolved(false);
    setScanExchangeChoice(null);
    setScanTutorialMessage(
      "正解です。カード生成に使えるイラストの呼称を入力してください。",
    );
  }

  function solveScanIllustrationNames() {
    const normalizedIllustrationOne = normalizeRiddleAnswer(
      scanRiddleIllustrationOne.replace(/[／/]/g, ""),
    );
    const normalizedIllustrationTwo = normalizeRiddleAnswer(
      scanRiddleIllustrationTwo.replace(/[／/]/g, ""),
    );
    const isIllustrationOneCorrect =
      normalizedIllustrationOne === "住所" ||
      normalizedIllustrationOne === "じゅうしょ";
    const isIllustrationTwoCorrect = normalizedIllustrationTwo === "くいーん";

    setScanRiddleIllustrationResults({
      one: isIllustrationOneCorrect,
      two: isIllustrationTwoCorrect,
    });

    if (!isIllustrationOneCorrect || !isIllustrationTwoCorrect) {
      setAreScanRiddleAnswersSolved(false);
      setScanExchangeChoice(null);
      setScanTutorialMessage(
        "正解している呼称は表示しました。未正解の呼称をもう一度確認してください。",
      );
      return;
    }

    const normalizedDividedIllustrationOne = scanRiddleIllustrationOne
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
    const normalizedDividedIllustrationTwo = scanRiddleIllustrationTwo
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
    const isSplitOneCorrect =
      normalizedDividedIllustrationOne === "じゅう/しょ";
    const isSplitTwoCorrect = normalizedDividedIllustrationTwo === "くいーん";

    if (!isSplitOneCorrect || !isSplitTwoCorrect) {
      setAreScanRiddleAnswersSolved(false);
      setScanExchangeChoice(null);
      setScanTutorialMessage("上手くいかないようだ...");
      return;
    }

    setScanRiddleIllustrationOneSplitIndexes([3]);
    setScanRiddleIllustrationOne("じゅう/しょ");
    setScanRiddleIllustrationTwoSplitIndexes([]);
    setScanRiddleIllustrationTwo("くいーん");
    setAreScanRiddleAnswersSolved(true);
    setScanExchangeChoice(null);
    setScannedItems((current) => {
      const nextItems = [...current];

      for (const card of scannedGeneratedCards) {
        if (!nextItems.includes(card.id)) {
          nextItems.push(card.id);
        }
      }

      return nextItems;
    });
    setScanGeneratedPreviewSources([scanTargetImages.jyuusho, scanTargetImages.queen]);
    setScanTutorialMessage(
      "正解です。スペードの10と12を生成しました。エクスチェンジへ進んでください。",
    );
  }

  function chooseScanExchangeCard(rank: "10" | "12") {
    if (!isCardExchangeModeActive) {
      setScanTutorialMessage("先にエクスチェンジを起動してください。");
      return;
    }

    const selectedGeneratedCard =
      rank === "10" ? scannedOneCard : scannedTwelveCard;
    const playerAceCardIds = config
      ? [...config.initialPlayerHandIds].filter((cardId) => {
          const card = getCardsById([cardId])[0] ?? null;

          return card?.rank === "A";
        })
      : [];
    const selectedPlayerAceCardId =
      playerAceCardIds[playerAceCardIds.length - 1] ?? null;

    setScanExchangeChoice(rank);
    setIsScanExchangeConfirmed(false);
    setIsScanCardExchanged(false);

    if (rank === "10" && selectedPlayerAceCardId) {
      setScanExchangeCardIds([selectedPlayerAceCardId, scannedOneCard.id]);
      setScanTutorialMessage(
        "正解です。10のカードと自分のAをエクスチェンジ対象に選択しました。",
      );
      return;
    }

    setScanExchangeCardIds((current) => {
      const generatedCardIds = scannedGeneratedCards.map((card) => card.id);
      const withoutGeneratedCards = current.filter(
        (cardId) => !generatedCardIds.includes(cardId),
      );

      return [...withoutGeneratedCards.slice(-1), selectedGeneratedCard.id];
    });

    setScanGeneratedPreviewSources([]);
    setScanTutorialMessage(
      "12のカードでは勝てなさそうです。もう一度選んでください。",
    );
  }

  function confirmScanExchangeSelection() {
    if (robotId === "blackjack-2-3" && selectedRiddlePrintIds.length === 2) {
      confirmRiddlePrintExchangeSelection();
      return;
    }
    if (robotId === "blackjack-2-3" && remainingSecondStageExchanges === 0) return;
    const isCorrect = Boolean(isScanExchangeCorrect);

    setIsScanCardExchanged(isCorrect);
    setIsScanExchangeConfirmed(true);

    setIsCardExchangeModeActive(false);

    if (isCorrect && robotId === "blackjack-2-2") {
      setShowPhysicalScanGuideDialog(true);
    }
  }

  function resetScanExchangeSelection() {
    setScanExchangeCardIds([]);
    setIsScanExchangeConfirmed(false);
    setIsScanCardExchanged(false);
    setScanExchangeChoice(null);
    setSelectedRiddlePrintIds([]);
    setIsCardExchangeModeActive(true);
    setIsRiddleExchangeModeActive(robotId === "blackjack-2-3");
    setScanTutorialMessage("エクスチェンジを解除しました。交換対象を選び直してください。");
  }

  function scrollToPhysicalScanPanel() {
    window.setTimeout(() => {
      physicalScanPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  }

  function activateCardExchangeMode() {
    if (robotId === "blackjack-2-3" && isRiddlePrintExchangeApplied) return;
    if (robotId === "blackjack-2-3") {
      setIsRiddleExchangeModeActive(!isCardExchangeModeActive);
      setSelectedRiddlePrintIds([]);
    }
    if (isCardExchangeModeActive || isBlackjackExchangeConfirmed || isScanExchangeConfirmed) {
      setIsCardExchangeModeActive(false);
      setBlackjackExchangeCardIds([]);
      setScanExchangeCardIds([]);
      setIsBlackjackExchangeConfirmed(false);
      setIsScanExchangeConfirmed(false);
      setIsScanCardExchanged(false);
      setScanExchangeChoice(null);
      setScanTutorialMessage("エクスチェンジを解除しました。");
      return;
    }

    setIsCardExchangeModeActive(true);
    setScanTutorialMessage(
      "エクスチェンジを起動しました。交換対象を2枚選択してください。",
    );
  }

  function togglePhysicalScanCard(cardId: string) {
    if (consumedPhysicalScanCardIds.includes(cardId)) return;
    setIsPhysicalScanGenerated(false);
    setPhysicalScanMessage("");
    setPhysicalScanReading("");
    setPhysicalScanSplitIndexes([]);
    setPhysicalScanCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      return [...current, cardId].slice(
        -(physicalScanConfig?.requiredSelectionCount ?? 3),
      );
    });
  }

  function changePhysicalScanSplit(
    indexes: number[],
    dividedText: string,
  ) {
    setIsPhysicalScanGenerated(false);
    setPhysicalScanMessage("");
    setPhysicalScanSplitIndexes(indexes);
    setPhysicalScanReading(dividedText);
  }

  function answerPhysicalScanRoleName() {
    if (!physicalScanConfig) {
      return;
    }

    const isCardSelectionCorrect = isPhysicalScanSelectionValid(
      physicalScanCardIds,
      visiblePhysicalScanInventoryCards,
      robotId === "blackjack-2-3" ? "Q" : "5",
      physicalScanConfig.requiredSelectionCount,
    );

    setIsPhysicalScanGenerated(false);
    setPhysicalScanSplitIndexes([]);

    if (!isCardSelectionCorrect) {
      setPhysicalScanReading("");
      setPhysicalScanMessage(physicalScanConfig.errorMessage);
      return;
    }

    setPhysicalScanReading(physicalScanConfig.roleName);
    setPhysicalScanMessage("役名は判定できました。区切り位置を指定してください。");
  }

  function runPhysicalScan() {
    if (!physicalScanConfig) {
      return;
    }
    if (robotId === "blackjack-2-3" && remainingSecondStageScans === 0) return;
    if (physicalScanCardIds.some((id) => consumedPhysicalScanCardIds.includes(id))) return;

    const isCardSelectionCorrect = isPhysicalScanSelectionValid(
      physicalScanCardIds,
      visiblePhysicalScanInventoryCards,
      robotId === "blackjack-2-3" ? "Q" : "5",
      physicalScanConfig.requiredSelectionCount,
    );
    const isCorrect = isCardSelectionCorrect && isPhysicalScanReadingCorrect;

    if (!isCorrect) {
      setPhysicalScanMessage(
        isCardSelectionCorrect
          ? "上手くいかないようだ..."
          : physicalScanConfig.errorMessage,
      );
      setIsPhysicalScanGenerated(false);
      return;
    }

    setIsPhysicalScanGenerated(true);
    setConsumedPhysicalScanCardIds((current) => [...new Set([...current, ...physicalScanCardIds])]);
    setScannedItems((current) =>
      current.includes(scannedPhysicalScanCard.id)
        ? current
        : [...current, scannedPhysicalScanCard.id],
    );
    setPhysicalScanMessage(physicalScanConfig.successMessage);
  }

  function activateRiddleExchangeMode() {
    if (isRiddleExchangeModeActive) {
      setIsRiddleExchangeModeActive(false);
      setSelectedRiddlePrintIds([]);
      setScanTutorialMessage("エクスチェンジを解除しました。");
      return;
    }

    setIsRiddleExchangeModeActive(true);
    setSelectedRiddlePrintIds([]);
    setScanTutorialMessage("");
  }

  function toggleRiddlePrintTarget(targetId: string) {
    const nextSelectedIds = selectedRiddlePrintIds.includes(targetId)
      ? selectedRiddlePrintIds.filter((id) => id !== targetId)
      : [...selectedRiddlePrintIds, targetId].slice(-2);

    setSelectedRiddlePrintIds(nextSelectedIds);
  }

  function confirmRiddlePrintExchangeSelection() {
    const isCorrectRiddlePrintExchange =
      selectedRiddlePrintIds.includes("riddle-1-middle-left") &&
      selectedRiddlePrintIds.includes("riddle-1-center");

    if (
      !canSelectRiddlePrints ||
      remainingSecondStageExchanges === 0 ||
      !isRiddleExchangeModeActive ||
      selectedRiddlePrintIds.length !== 2
    ) {
      return;
    }

    if (!isCorrectRiddlePrintExchange) {
      setScanTutorialMessage("選択した対象をもう一度確認してください。");
      return;
    }

    setIsRiddlePrintExchangeApplied(true);
    setIsCardExchangeModeActive(false);
    setScanExchangeCardIds([]);
    setIsRiddleExchangeModeActive(false);
    setPreparationAbility("scan");
    setScanTutorialMessage("エクスチェンジ発動しました。");
    setShowRiddlePrintChangedDialog(true);
    onRevealRiddleExchangeTiming();
  }

  function runFourthBattleScan(answer = fourthScanAnswer, illustration = fourthScanIllustration) {
    if (remainingSecondStageScans === 0) return;
    if (!isRiddlePrintExchangeApplied) {
      setScanTutorialMessage(
        "先にエクスチェンジで小謎の紙を変化させてください。",
      );
      setIsFourthScanGenerated(false);
      return;
    }

    const normalizedAnswer = normalizeRiddleAnswer(answer);
    const normalizedIllustration = normalizeRiddleAnswer(illustration);

    if (
      normalizedAnswer !== "ななめ" ||
      normalizedIllustration !== "きゅう/しょ"
    ) {
      setScanTutorialMessage("上手くいかないようだ...");
      setIsFourthScanGenerated(false);
      return;
    }

    if (robotId === "blackjack-2-3") {
      setScanTutorialMessage("それをスキャンしても勝てなさそうだ");
      setIsFourthScanGenerated(false);
      return;
    }

    setIsFourthScanGenerated(true);
    setFourthScanAnswer("");
    setFourthScanIllustration("");
    setFourthScanSplitIndexes([]);
    setScannedItems((current) =>
      current.includes(scannedNineCard.id)
        ? current
        : [...current, scannedNineCard.id],
    );
    setScanTutorialMessage(
      "スキャン成功。9のトランプを生成しました。",
    );
  }

  function toggleFourthRobotExchangeCard(cardId: string) {
    setIsFourthRobotExchangeConfirmed(false);
    setFourthRobotExchangeCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      return [...current, cardId].slice(-2);
    });
  }

  function confirmFourthRobotExchange() {
    if (fourthRobotExchangeCardIds.length !== 2) {
      return;
    }

    setIsFourthRobotExchangeConfirmed(true);
    setIsRiddleExchangeModeActive(false);
    setScanTutorialMessage("エクスチェンジ対象を決定しました。");
  }

  function resetFourthRobotExchangeSelection() {
    setIsFourthRobotExchangeConfirmed(false);
    setFourthRobotExchangeCardIds([]);
    setIsRiddleExchangeModeActive(true);
    setScanTutorialMessage("エクスチェンジ対象を選び直してください。");
  }

  useEffect(() => {
    function handleGlobalNav(event: Event) {
      const action = (event as CustomEvent<{ action?: GlobalNavAction }>).detail
        ?.action;

      if (action === "battle") {
        setShowPreparation(false);
        return;
      }

      if (action === "preparation" && canOpenPreparation) {
        setShowPreparation(true);
        setShouldHighlightScanPreparationButton(false);
      }
    }

    window.addEventListener(GLOBAL_NAV_EVENT, handleGlobalNav);

    return () => {
      window.removeEventListener(GLOBAL_NAV_EVENT, handleGlobalNav);
    };
  }, [canOpenPreparation]);

  return (
    <div className="min-h-[620px] bg-[#071b12] text-white">
      {blackjackOrderError ? <PlayerCutInDialog text="こちらは数字の小さい方だ。ルール通り大きい方から置こう" onDismiss={() => setBlackjackOrderError(false)} /> : null}
      {isRiddleExchangeModeActive || isCardExchangeModeActive ? (
        <div className="pointer-events-none fixed inset-0 z-[60] border-[10px] border-red-500/80 shadow-[inset_0_0_42px_rgba(239,68,68,0.75)]" />
      ) : null}
      {showSecondStageIntro ? (
        <TutorialDialog
          onDismiss={() => setShowSecondStageIntro(false)}
          text={
            <>
              第2ステージから、ハイ＆ロー・ブラックジャックの二つのゲームを”
              <span className="text-red-300">同じ手札</span>
              ”で2連勝していただきます
            </>
          }
          tone="hands"
        />
      ) : null}

      {showScanUnlockDialog ? (
        <TutorialDialog
          onDismiss={() => setShowScanUnlockDialog(false)}
          text="このステージでは、プレイヤーの手札交換を禁止します。その代わりに新たな能力を解放します"
          tone="hands"
        />
      ) : null}

      {isPrintedScanBattle && showPreparation && preparationAbility === "scan" &&
       !showScanUnlockDialog && !hasDismissedScanAbilityIntro ? (
        <TutorialDialog
          onDismiss={() => setHasDismissedScanAbilityIntro(true)}
          text="新たに2つ目の能力を開示します。スキャン機能を活用しましょう"
          tone="hands"
        />
      ) : null}

      {showTrafficLightScanHint ? (
        <TutorialDialog
          onDismiss={() => setShowTrafficLightScanHint(false)}
          text="⓪の緑黄赤の丸を信号機としてスキャンすることはできない。⓪の謎で信号機として捉えることがないためだ"
          tone="hands"
        />
      ) : null}

      {showScanPrintedItemsDialog ? (
        <TutorialDialog
          onDismiss={() => setShowScanPrintedItemsDialog(false)}
          text={
            <>
              <span className="block">
                車内２つ目の機能、スキャン機能が公開されたと同時に、印刷された小謎の紙も渡された。
              </span>
              <span className="mt-2 block">
                イラストの呼称で入力した答えが導ければ、インクを無視してイラストをスキャンできるらしい。とりあえず謎を解いてみよう
              </span>
            </>
          }
          tone="hands"
        />
      ) : null}

      {showPhysicalScanGuideDialog ? (
        <TutorialDialog
          onDismiss={() => {
            setShowPhysicalScanGuideDialog(false);
            setPreparationAbility("scan");
            scrollToPhysicalScanPanel();
          }}
          text={
            <>
              <span className="block">
                ゲームスタートする前に、スキャンのもう一つの生成方法も説明しておく
              </span>
              <span className="mt-2 block">
                クイーンのカード1枚と5のカード3枚をアイテムとして渡そう。
              </span>
              <span className="mt-2 block">
                5のカード3枚をポーカーの役として現物スキャンしてみると良い
              </span>
            </>
          }
          tone="hands"
        />
      ) : null}

      {showPhysicalScanDisposalDialog ? (
        <TutorialDialog
          onDismiss={() => setShowPhysicalScanDisposalDialog(false)}
          text="生成した3のカードはチュートリアル用のため処分しておく"
          tone="hands"
        />
      ) : null}

      {showRiddlePrintChangedDialog ? (
        <TutorialDialog
          onDismiss={() => setShowRiddlePrintChangedDialog(false)}
          text="小謎の紙が変わったようだ...。確認してみるか"
          tone="hands"
        />
      ) : null}

      {expandedRiddleImage ? (
        <RiddleImageModal
          alt={expandedRiddleImage.alt}
          onClose={() => setExpandedRiddleImage(null)}
          riddlePrintSelection={
            canSelectRiddlePrints && expandedRiddleImage.src === "/riddles/riddle_1.png"
              ? {
                  disabled:
                    !isRiddleExchangeModeActive || isRiddlePrintExchangeApplied,
                  onToggleTarget: toggleRiddlePrintTarget,
                  selectedIds: selectedRiddlePrintIds,
                }
              : undefined
          }
          src={expandedRiddleImage.src}
        />
      ) : null}

      <div className="flex items-center gap-3 border-b border-white/10 bg-black/28 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <GameLogo gameType="blackjack" compact />
          {highLowRobotHand.length > 0 ? (
            <GameLogo gameType="high-low" compact />
          ) : null}
        </div>
      </div>

      {showPreparation ? (
        <div className="p-4">
          <section className="mx-auto max-w-3xl rounded border border-white/12 bg-black/28 p-3">
            <GameTableReturnButton
              className="mb-3"
              onClick={() => setShowPreparation(false)}
            />
            <div className="mb-3"><GameStartHandNotice /></div>

            {canExchangePlayerHand ? (
              <div className="rounded border border-brass/50 bg-brass/10 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                  事前準備
                </p>
                <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
                  <ExchangeModeToggleButton
                    isActive={isCardExchangeModeActive}
                    isCompleted={isBlackjackExchangeConfirmed}
                    onClick={activateCardExchangeMode}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                        交換対象
                      </p>
                      <h3 className="mt-1 text-xl font-black">交換対象を2枚選択</h3>
                    </div>
                    <span className="rounded bg-white px-2 py-1 text-xs font-black text-stone-950">
                      {blackjackExchangeCardIds.length}/2
                    </span>
                  </div>
                  <ExchangeCardSectionPicker
                    onToggleCard={toggleBlackjackExchangeCard}
                    sections={blackjackExchangeSections.map((section) => ({
                      ...section,
                      interactionDisabled: !isCardExchangeModeActive,
                    }))}
                    selectedCardIds={blackjackExchangeCardIds}
                  />
                  {isBlackjackExchangeConfirmed ? (
                    <p className="mt-3 rounded border border-emerald-400/40 bg-emerald-950/40 p-3 text-sm font-black text-emerald-100">
                      エクスチェンジ対象を決定しました。
                    </p>
                  ) : null}
                </div>
                <button
                  className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
                    isBlackjackExchangeConfirmed
                      ? "cursor-not-allowed bg-emerald-700 text-emerald-100 opacity-70"
                      : isCardExchangeModeActive &&
                          blackjackExchangeCardIds.length === 2
                        ? "bg-brass text-stone-950 hover:bg-yellow-300"
                        : "cursor-not-allowed bg-stone-700 text-stone-400"
                  }`}
                  disabled={
                    !isCardExchangeModeActive ||
                    blackjackExchangeCardIds.length !== 2 ||
                    isBlackjackExchangeConfirmed
                  }
                  onClick={() => {
                    setIsBlackjackExchangeConfirmed(true);
                    setIsCardExchangeModeActive(false);
                  }}
                  type="button"
                >
                  決定
                </button>
              </div>
            ) : null}

            {canUseScan ? (
              <div className="rounded border border-brass/50 bg-brass/10 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                  事前準備
                </p>

                {robotId === "blackjack-2-3" ? (
                  <AbilityUsageTabs
                    activeAbility={preparationAbility}
                    abilities={["scan", "exchange"]}
                    counts={{ scan: remainingSecondStageScans, exchange: remainingSecondStageExchanges, "copy-paste": 0 }}
                    onSelect={setPreparationAbility}
                  />
                ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["scan", "exchange"] as const).map((ability) => (
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
                      {ability === "scan" ? "スキャン" : "エクスチェンジ"}
                    </button>
                  ))}
                </div>
                )}

                {preparationAbility === "scan" ? (
                  <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
                    {!isPrintedScanBattle ? (
                      <>
                        {physicalScanConfig?.guideText ? (
                          <p className="text-sm font-bold leading-6 text-stone-100">
                            {physicalScanConfig.guideText}
                          </p>
                        ) : null}
                        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                          印刷済み謎
                        </p>
                        <div className="mt-3 rounded border border-white/12 bg-white p-3 text-stone-950">
                          <div className="grid gap-3">
                            <ZoomableRiddleImage alt="スキャン解放謎" badge="⓪" src="/riddles/riddle_0.png" onOpen={setExpandedRiddleImage} />
                            <div className="grid gap-0">
                              {scanRiddleImages.slice(0, 2).map((image, index) => (
                                robotId === "blackjack-2-3" && index === 0 ? (
                                  <RiddlePrintTargetPicker
                                    key={image.src}
                                    disabled={!isRiddleExchangeModeActive || remainingSecondStageExchanges === 0}
                                    isExchanged={isRiddlePrintExchangeApplied}
                                    onOpen={setExpandedRiddleImage}
                                    onToggleTarget={toggleRiddlePrintTarget}
                                    selectedIds={selectedRiddlePrintIds}
                                  />
                                ) : (
                                <ZoomableRiddleImage
                                  alt={image.alt}
                                  badge={index === 0 ? "①" : undefined}
                                  className={
                                    index === 0
                                      ? "rounded-b-none border-b-0"
                                      : "rounded-t-none"
                                  }
                                  key={image.src}
                                  onOpen={setExpandedRiddleImage}
                                  src={image.src}
                                />
                                )
                              ))}
                            </div>
                            {scanRiddleImages.slice(2).map((image) => (
                              <ZoomableRiddleImage
                                alt={image.alt}
                                badge="②"
                                key={image.src}
                                onOpen={setExpandedRiddleImage}
                                src={image.src}
                              />
                            ))}
                          </div>
                        </div>
                        <ScanSolvedSummary hasFourthScanResult={scannedItems.includes("scan-9")} />
                        {isRiddleExchangeModeActive ? (
                          <button
                            className="mt-3 min-h-11 w-full rounded bg-brass px-3 py-2 text-sm font-black text-stone-950 disabled:opacity-40"
                            disabled={selectedRiddlePrintIds.length !== 2 || remainingSecondStageExchanges === 0}
                            onClick={confirmRiddlePrintExchangeSelection}
                            type="button"
                          >エクスチェンジ決定</button>
                        ) : null}
                        <div className="mt-3 grid gap-3 rounded border border-brass/45 bg-black/30 p-3">
                          <p className="text-sm font-black leading-6 text-brass">
                            スキャン回答
                          </p>
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            謎の答え
                            <input
                              className="min-h-11 rounded border border-brass bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none ring-4 ring-brass/20"
                              onChange={(event) =>
                                setPostTutorialScanAnswer(event.target.value)
                              }
                              placeholder="謎の答えを入力"
                              value={postTutorialScanAnswer}
                            />
                          </label>
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            イラスト読み方
                            <input
                              className="min-h-11 rounded border border-brass bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none ring-4 ring-brass/20"
                              onChange={(event) => {
                                setPostTutorialScanIllustrationName(
                                  event.target.value,
                                );
                                setPostTutorialScanSplitIndexes([]);
                              }}
                              placeholder="イラスト読み方を入力"
                              value={postTutorialScanIllustrationName}
                            />
                          </label>
                          <IllustrationSplitSelector
                            onChange={(indexes, dividedText) => {
                              setPostTutorialScanSplitIndexes(indexes);
                              setPostTutorialScanIllustrationName(dividedText);
                            }}
                            selectedIndexes={postTutorialScanSplitIndexes}
                            value={postTutorialScanIllustrationName}
                          />
                          <button
                            className="min-h-11 rounded bg-brass px-3 py-2 text-sm font-black text-stone-950 disabled:opacity-40"
                            disabled={remainingSecondStageScans === 0}
                            onClick={() => runFourthBattleScan(postTutorialScanAnswer, postTutorialScanIllustrationName)}
                            type="button"
                          >スキャン発動</button>
                          {isFourthScanGenerated ? <ScanTargetPreview alt="今回スキャンした対象: 急所" src={scanTargetImages.kyuusho} /> : null}
                          {scanTutorialMessage ? <ScanFeedbackMessage message={scanTutorialMessage} /> : null}
                        </div>
                        <div ref={physicalScanPanelRef}>
                          <PhysicalScanPanel
                            canAnswerRoleName={isPhysicalScanCardCountReady}
                            canRun={canRunPhysicalScan && remainingSecondStageScans > 0}
                            cards={visiblePhysicalScanInventoryCards}
                            generatedCard={scannedPhysicalScanCard}
                            generatedLabel={
                              physicalScanConfig?.generatedLabel ??
                              "Aのカードを生成済み"
                            }
                            isGenerated={isPhysicalScanGenerated}
                            message={physicalScanMessage}
                            onAnswerRoleName={answerPhysicalScanRoleName}
                            onRun={runPhysicalScan}
                            onSplitChange={changePhysicalScanSplit}
                            onToggleCard={togglePhysicalScanCard}
                            prompt={physicalScanConfig?.prompt ?? ""}
                            reading={physicalScanReading}
                            readingPrompt={
                              physicalScanConfig?.readingPrompt ??
                              "通常のスキャンと同じく、区切り位置を指定してください。"
                            }
                            requiredSelectionCount={
                              physicalScanConfig?.requiredSelectionCount ?? 2
                            }
                            selectedCardIds={physicalScanCardIds}
                            splitIndexes={physicalScanSplitIndexes}
                          />
                        </div>
                        {isPhysicalScanGenerated ? (
                          <button
                            className="mt-3 min-h-11 w-full rounded bg-sky-500 px-3 py-2 text-sm font-black text-white hover:bg-sky-400"
                            onClick={() => setPreparationAbility("exchange")}
                            type="button"
                          >
                            エクスチェンジへ
                          </button>
                        ) : null}
                      </>
                    ) : !isScanTutorialAnswerSolved ? (
                      <>
                        <p className="text-sm font-bold leading-6 text-stone-100">
                          <span className="block">
                            スキャン機能を解放するために、こちらの謎を解きましょう
                          </span>
                          <span className="mt-1 block text-red-300">
                            ※謎の印刷時にインクが零れる場合あり
                          </span>
                        </p>
                        <ZoomableRiddleImage
                          alt="スキャン機能チュートリアル小謎"
                          className="mt-3"
                          onOpen={setExpandedRiddleImage}
                          src="/riddles/riddle_0.png"
                        />
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
                          回答
                        </button>
                      </>
                    ) : (
                      <>
                        <details className="rounded border border-emerald-300/35 bg-emerald-950/25 p-3 text-sm font-bold leading-6 text-emerald-100">
                          <summary className="cursor-pointer font-black">
                            スキャン機能 解放済み
                          </summary>
                          <ZoomableRiddleImage
                            alt="スキャン機能解放用小謎"
                            className="mt-3"
                            onOpen={setExpandedRiddleImage}
                            src="/riddles/riddle_0.png"
                          />
                        </details>
                        <ScanSpecToggle
                          isVisible={isScanSpecVisible}
                          onToggle={() =>
                            setIsScanSpecVisible((current) => !current)
                          }
                        />
                        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                          印刷済み謎
                        </p>
                        <div className="mt-3 rounded border border-white/12 bg-white p-3 text-stone-950">
                          <div className="grid gap-3">
                            <ZoomableRiddleImage alt="スキャン解放謎" badge="⓪" src="/riddles/riddle_0.png" onOpen={setExpandedRiddleImage} />
                            <div className="grid gap-0">
                              {scanRiddleImages.slice(0, 2).map((image, index) => (
                                <ZoomableRiddleImage
                                  alt={image.alt}
                                  badge={index === 0 ? "①" : undefined}
                                  className={
                                    index === 0
                                      ? "rounded-b-none border-b-0"
                                      : "rounded-t-none"
                                  }
                                  key={image.src}
                                  onOpen={setExpandedRiddleImage}
                                  src={image.src}
                                />
                              ))}
                            </div>
                            {scanRiddleImages.slice(2).map((image) => (
                              <ZoomableRiddleImage
                                alt={image.alt}
                                badge="②"
                                key={image.src}
                                onOpen={setExpandedRiddleImage}
                                src={image.src}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 rounded border border-brass/45 bg-black/30 p-3">
                          <p className="text-sm font-black leading-6 text-brass">
                            それぞれの小謎でカード生成に使えるイラストを探そう
                          </p>
                          <p className="text-sm font-bold leading-6 text-stone-100">
                            まず小謎①と②の答えを入力してください。
                          </p>
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            小謎①の答え
                            <input
                              className={getCheckedInputClass(
                                scanRiddleAnswerOne,
                                scanRiddleAnswerResults.one,
                              )}
                              onChange={(event) => {
                                setScanRiddleAnswerOne(event.target.value);
                                setScanRiddleAnswerResults((current) => ({
                                  ...current,
                                  one: null,
                                }));
                                setAreScanRiddleAnswersConfirmed(false);
                                setAreScanRiddleAnswersSolved(false);
                                setScanRiddleIllustrationResults({
                                  one: null,
                                  two: null,
                                });
                                setScanExchangeChoice(null);
                              }}
                              placeholder="小謎①の答えを入力"
                              value={scanRiddleAnswerOne}
                            />
                            <CheckResultText result={scanRiddleAnswerResults.one} />
                          </label>
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            小謎②の答え
                            <input
                              className={getCheckedInputClass(
                                scanRiddleAnswerTwo,
                                scanRiddleAnswerResults.two,
                              )}
                              onChange={(event) => {
                                setScanRiddleAnswerTwo(event.target.value);
                                setScanRiddleAnswerResults((current) => ({
                                  ...current,
                                  two: null,
                                }));
                                setAreScanRiddleAnswersConfirmed(false);
                                setAreScanRiddleAnswersSolved(false);
                                setScanRiddleIllustrationResults({
                                  one: null,
                                  two: null,
                                });
                                setScanExchangeChoice(null);
                              }}
                              placeholder="小謎②の答えを入力"
                              value={scanRiddleAnswerTwo}
                            />
                            <CheckResultText result={scanRiddleAnswerResults.two} />
                          </label>
                          <button
                            className={`min-h-11 rounded px-3 py-2 text-sm font-black ${
                              areScanRiddleAnswersConfirmed
                                ? "bg-emerald-500 text-stone-950"
                                : "bg-brass text-stone-950 hover:bg-yellow-300"
                            }`}
                            onClick={solvePrintedScanRiddles}
                            type="button"
                          >
                            {areScanRiddleAnswersConfirmed ? "回答済み" : "回答"}
                          </button>
                        </div>
                        {areScanRiddleAnswersConfirmed ? (
                          <div className="mt-3 grid gap-3 rounded border border-brass/45 bg-black/30 p-3">
                            <p className="text-sm font-black leading-6 text-brass">
                              カード生成に使えるイラストの呼称を入力してください。
                            </p>
                            <label className="grid gap-2 text-sm font-bold text-stone-100">
                              小謎①のイラストの呼称（10が生成できるイラストを探そう）
                              <input
                                className={getCheckedInputClass(
                                  scanRiddleIllustrationOne,
                                  scanRiddleIllustrationResults.one,
                                )}
                                onChange={(event) => {
                                  setScanRiddleIllustrationOne(event.target.value);
                                  setScanRiddleIllustrationOneSplitIndexes([]);
                                  setScanRiddleIllustrationResults((current) => ({
                                    ...current,
                                    one: null,
                                  }));
                                  setAreScanRiddleAnswersSolved(false);
                                  setScanExchangeChoice(null);
                                }}
                                placeholder="イラストの呼称を入力"
                                value={scanRiddleIllustrationOne}
                              />
                              <CheckResultText
                                result={scanRiddleIllustrationResults.one}
                              />
                            </label>
                            {scanRiddleIllustrationResults.one === true ? (
                              <IllustrationSplitSelector
                                onChange={(indexes, dividedText) => {
                                  setScanRiddleIllustrationOneSplitIndexes(indexes);
                                  setScanRiddleIllustrationOne(dividedText);
                                }}
                                selectedIndexes={
                                  scanRiddleIllustrationOneSplitIndexes
                                }
                                value={scanRiddleIllustrationOne}
                              />
                            ) : null}
                            <label className="grid gap-2 text-sm font-bold text-stone-100">
                              小謎②のイラストの呼称（12が生成できるイラストを探そう）
                              <input
                                className={getCheckedInputClass(
                                  scanRiddleIllustrationTwo,
                                  scanRiddleIllustrationResults.two,
                                )}
                                onChange={(event) => {
                                  setScanRiddleIllustrationTwo(event.target.value);
                                  setScanRiddleIllustrationTwoSplitIndexes([]);
                                  setScanRiddleIllustrationResults((current) => ({
                                    ...current,
                                    two: null,
                                  }));
                                  setAreScanRiddleAnswersSolved(false);
                                  setScanExchangeChoice(null);
                                }}
                                placeholder="イラストの呼称を入力"
                                value={scanRiddleIllustrationTwo}
                              />
                              <CheckResultText
                                result={scanRiddleIllustrationResults.two}
                              />
                            </label>
                            {scanRiddleIllustrationResults.two === true ? (
                              <IllustrationSplitSelector
                              onChange={(indexes, dividedText) => {
                                setScanRiddleIllustrationTwoSplitIndexes(indexes);
                                setScanRiddleIllustrationTwo(dividedText);
                              }}
                                selectedIndexes={
                                  scanRiddleIllustrationTwoSplitIndexes
                                }
                                value={scanRiddleIllustrationTwo}
                              />
                            ) : null}
                            <button
                              className={`min-h-11 rounded px-3 py-2 text-sm font-black ${
                                areScanRiddleAnswersSolved
                                  ? "bg-emerald-500 text-stone-950"
                                  : "bg-brass text-stone-950 hover:bg-yellow-300"
                              }`}
                              onClick={solveScanIllustrationNames}
                              type="button"
                            >
                              {areScanRiddleAnswersSolved ? "回答済み" : "回答"}
                            </button>
                          </div>
                        ) : null}
                        {areScanRiddleAnswersSolved ? (
                          <button
                            className="mt-3 min-h-11 w-full rounded bg-sky-500 px-3 py-2 text-sm font-black text-white hover:bg-sky-400"
                            onClick={() => setPreparationAbility("exchange")}
                            type="button"
                          >
                            エクスチェンジへ
                          </button>
                        ) : null}
                      </>
                    )}

                    {isPrintedScanBattle &&
                    isScanExchangeConfirmed &&
                    isScanExchangeCorrect ? (
                      <>
                        <div ref={physicalScanPanelRef}>
                          <PhysicalScanPanel
                            canAnswerRoleName={isPhysicalScanCardCountReady}
                            canRun={canRunPhysicalScan}
                            cards={visiblePhysicalScanInventoryCards}
                            generatedCard={scannedPhysicalScanCard}
                            generatedLabel={
                              physicalScanConfig?.generatedLabel ??
                              "3のカードを生成済み"
                            }
                            isGenerated={isPhysicalScanGenerated}
                            message={physicalScanMessage}
                            onAnswerRoleName={answerPhysicalScanRoleName}
                            onRun={runPhysicalScan}
                            onSplitChange={changePhysicalScanSplit}
                            onToggleCard={togglePhysicalScanCard}
                            prompt={physicalScanConfig?.prompt ?? ""}
                            reading={physicalScanReading}
                            readingPrompt={
                              physicalScanConfig?.readingPrompt ??
                              "通常のスキャンと同じく、区切り位置を指定してください。"
                            }
                            requiredSelectionCount={
                              physicalScanConfig?.requiredSelectionCount ?? 3
                            }
                            selectedCardIds={physicalScanCardIds}
                            splitIndexes={physicalScanSplitIndexes}
                          />
                        </div>
                        {isPhysicalScanGenerated ? (
                          <button
                            className="mt-3 min-h-11 w-full rounded bg-sky-500 px-3 py-2 text-sm font-black text-white hover:bg-sky-400"
                            onClick={() => {
                              setShowPreparation(false);
                              setShowPhysicalScanDisposalDialog(true);
                            }}
                            type="button"
                          >
                            対戦画面へ
                          </button>
                        ) : null}
                      </>
                    ) : null}

                    {scanTutorialMessage ? (
                      <div className="mt-3 rounded border border-white/12 bg-white/8 p-3">
                        {scanGeneratedPreviewSources.map((src) => (
                          <ScanTargetPreview
                            key={src}
                            alt="今回スキャンした対象"
                            src={src}
                          />
                        ))}
                        <ScanFeedbackMessage message={scanTutorialMessage} />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
                    <p className="text-sm leading-6 text-stone-100">
                      生成したカードはエクスチェンジの候補に追加されます。
                    </p>
                    <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
                      <ExchangeModeToggleButton
                        isActive={isCardExchangeModeActive}
                        isCompleted={isScanExchangeConfirmed || (robotId === "blackjack-2-3" && isRiddlePrintExchangeApplied)}
                        onClick={activateCardExchangeMode}
                      />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                            交換対象
                          </p>
                          <h3 className="mt-1 text-xl font-black">
                            交換対象を2枚選択
                          </h3>
                        </div>
                        <span className="rounded bg-white px-2 py-1 text-xs font-black text-stone-950">
                          {scanExchangeCardIds.length}/2
                        </span>
                      </div>
                      {shouldShowScanGeneratedCards && isPrintedScanBattle ? (
                        <div className="mt-3 rounded border border-sky-300/35 bg-sky-950/25 p-3">
                          <p className="text-sm font-black leading-6 text-sky-50">
                            どちらのカードを自分の手札とエクスチェンジすれば勝てる？
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {(["10", "12"] as const).map((rank) => (
                              <button
                                className={`min-h-11 rounded border px-3 py-2 text-sm font-black ${
                                  !isCardExchangeModeActive
                                    ? "cursor-not-allowed border-white/10 bg-stone-800 text-stone-500"
                                    : scanExchangeChoice === rank
                                    ? rank === "10"
                                      ? "border-emerald-300 bg-emerald-500 text-stone-950"
                                      : "border-red-300 bg-red-950/55 text-red-100"
                                    : "border-white/20 bg-black/35 text-stone-100 hover:bg-white/10"
                                }`}
                                disabled={!isCardExchangeModeActive}
                                key={rank}
                                onClick={() => chooseScanExchangeCard(rank)}
                                type="button"
                              >
                                {rank}のカード
                              </button>
                            ))}
                          </div>
                          {scanExchangeChoice === "10" ? (
                            <p className="mt-3 rounded border border-emerald-300/45 bg-emerald-950/45 p-3 text-sm font-black leading-6 text-emerald-100">
                              正解です。10のカードと自分のAをエクスチェンジ対象に選択しました。
                            </p>
                          ) : scanExchangeChoice === "12" ? (
                            <p className="mt-3 rounded border border-red-300/45 bg-red-950/45 p-3 text-sm font-black leading-6 text-red-100">
                              12のカードでは勝てなさそうです。もう一度選んでください。
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {shouldShowScanGeneratedCards &&
                      !isPrintedScanBattle &&
                      isPhysicalScanGenerated ? (
                        <p className="mt-3 rounded border border-sky-300/35 bg-sky-950/25 p-3 text-sm font-black leading-6 text-sky-50">
                          生成したAのカードと自分のKを選択してください。
                        </p>
                      ) : null}
                      <ExchangeCardSectionPicker
                        onToggleCard={toggleScanExchangeCard}
                        sections={scanExchangeSections.map((section) => ({
                          ...section,
                          interactionDisabled: !isCardExchangeModeActive,
                        }))}
                        selectedCardIds={scanExchangeCardIds}
                      />
                      {!shouldShowScanGeneratedCards ? (
                        <p className="mt-3 rounded border border-white/12 bg-white/8 p-3 text-center text-sm font-bold leading-6 text-stone-400">
                          まだ生成カードがありません。スキャンでカードを生成すると、候補に追加されます。
                        </p>
                      ) : null}
                      {isScanExchangeConfirmed ? (
                        <p
                          className={`mt-3 rounded border p-3 text-sm font-black ${
                            isScanExchangeCorrect
                              ? "border-emerald-400/40 bg-emerald-950/40 text-emerald-100"
                              : "border-red-300/45 bg-red-950/45 text-red-100"
                          }`}
                        >
                          {isScanExchangeCorrect
                            ? "エクスチェンジ対象を決定しました。"
                            : "選択したカードでは勝てなさそうです。もう一度確認してください。"}
                        </p>
                      ) : null}
                    </div>
                    <button
                      className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
                        isScanExchangeConfirmed && isScanExchangeCorrect
                          ? "cursor-not-allowed bg-emerald-700 text-emerald-100 opacity-70"
                          : isCardExchangeModeActive &&
                              scanExchangeCardIds.length === 2
                            ? "bg-brass text-stone-950 hover:bg-yellow-300"
                            : "cursor-not-allowed bg-stone-700 text-stone-400"
                      }`}
                      disabled={
                        !isCardExchangeModeActive ||
                        (scanExchangeCardIds.length !== 2 && !(robotId === "blackjack-2-3" && selectedRiddlePrintIds.length === 2)) ||
                        (robotId === "blackjack-2-3" && remainingSecondStageExchanges === 0) ||
                        (isScanExchangeConfirmed && isScanExchangeCorrect)
                      }
                      onClick={confirmScanExchangeSelection}
                      type="button"
                    >
                      決定
                    </button>
                    {isScanExchangeConfirmed ? (
                      <ExchangeRedoButton onClick={resetScanExchangeSelection} />
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {robotId === "blackjack-high-low-2-3" ? (
              <div className="rounded border border-brass/50 bg-brass/10 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                  4戦目の準備
                </p>

                {scanTutorialMessage && preparationAbility !== "scan" ? (
                  <ScanFeedbackMessage message={scanTutorialMessage} />
                ) : null}

                <AbilityUsageTabs
                  activeAbility={preparationAbility}
                  abilities={["scan", "exchange"]}
                  counts={{ scan: remainingSecondStageScans, exchange: remainingSecondStageExchanges, "copy-paste": 0 }}
                  onSelect={setPreparationAbility}
                />

                {preparationAbility === "exchange" ? (
                  <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
                    <ExchangeModeToggleButton
                      isActive={isRiddleExchangeModeActive}
                      isCompleted={isFourthRobotExchangeConfirmed}
                      onClick={activateRiddleExchangeMode}
                    />
                    <ExchangeSpecToggle />
                    <ExchangeRuleList
                      disabledTargets={disabledExchangeTargets}
                      samePrintTimingLabel={samePrintTimingLabel}
                      showTargetList={false}
                    />
                    <ExchangeCardSectionPicker
                      onToggleCard={toggleFourthRobotExchangeCard}
                      sections={[
                        {
                          cards: getCardsById(
                            ["K-spade", "Q-heart"],
                            generatedScanCards,
                          ),
                          disabled: true,
                          id: "fourth-preview-player-hand",
                          label: "プレイヤーの手札",
                        },
                        {
                          cards: getCardsById(["K-crub", "Q-crub"]),
                          interactionDisabled: !canSelectFourthRobotExchangeCards,
                          id: "fourth-preview-high-low-robot-hand",
                          label: "ハイ＆ローのロボット手札",
                        },
                        {
                          cards: getCardsById(
                            ["Q-daia", "scan-10"],
                            generatedScanCards,
                          ),
                          interactionDisabled: !canSelectFourthRobotExchangeCards,
                          id: "fourth-preview-blackjack-robot-hand",
                          label: "ブラックジャックのロボット手札",
                        },
                        {
                          cards: fourthScanGeneratedExchangeCards,
                          interactionDisabled: !canSelectFourthRobotExchangeCards,
                          id: "fourth-preview-scan-generated-card",
                          label: "スキャン生成カード",
                        },
                      ]}
                      selectedCardIds={fourthRobotExchangeCardIds}
                    />
                    <button
                      className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
                        isFourthRobotExchangeConfirmed
                          ? "cursor-not-allowed bg-emerald-700 text-emerald-100 opacity-70"
                          : canConfirmFourthRobotExchange ||
                              canConfirmRiddlePrintExchange
                            ? "bg-brass text-stone-950 hover:bg-yellow-300"
                            : "cursor-not-allowed bg-stone-700 text-stone-400"
                      }`}
                      disabled={
                        isFourthRobotExchangeConfirmed ||
                        (!canConfirmFourthRobotExchange &&
                          !canConfirmRiddlePrintExchange)
                      }
                      onClick={
                        canConfirmFourthRobotExchange
                          ? confirmFourthRobotExchange
                          : confirmRiddlePrintExchangeSelection
                      }
                      type="button"
                    >
                      決定
                    </button>
                    {isRiddlePrintExchangeApplied ? (
                      <p className="mt-3 rounded border border-emerald-400/40 bg-emerald-950/40 p-3 text-sm font-black text-emerald-100">
                        {isFourthRobotExchangeConfirmed
                          ? "エクスチェンジ対象を決定しました。"
                          : "エクスチェンジ発動しました。"}
                      </p>
                    ) : null}
                    {isFourthRobotExchangeConfirmed ? (
                      <ExchangeRedoButton
                        onClick={resetFourthRobotExchangeSelection}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 rounded border border-white/10 bg-black/20 p-3">
                    <ScanSpecToggle
                      isVisible={isScanSpecVisible}
                      onToggle={() =>
                        setIsScanSpecVisible((current) => !current)
                      }
                    />
                    <details className="rounded border border-white/12 bg-black/25 p-3">
                      <summary className="cursor-pointer text-sm font-black leading-6 text-brass">
                        小謎の紙
                      </summary>
                      <div className="mt-3 grid gap-3">
                        <RiddlePrintTargetPicker
                          disabled={
                            !isRiddleExchangeModeActive ||
                            isRiddlePrintExchangeApplied
                          }
                          isExchanged={isRiddlePrintExchangeApplied}
                          onOpen={setExpandedRiddleImage}
                          onToggleTarget={toggleRiddlePrintTarget}
                          selectedIds={selectedRiddlePrintIds}
                        />
                        <div className="rounded border border-white/12 bg-white p-3 text-stone-950">
                          <ZoomableRiddleImage
                            alt="小謎 2/2"
                            onOpen={setExpandedRiddleImage}
                            src="/riddles/riddle_1-2.png"
                          />
                        </div>
                        <div className="rounded border border-white/12 bg-white p-3 text-stone-950">
                          <ZoomableRiddleImage
                            alt="追加小謎"
                            badge="②"
                            onOpen={setExpandedRiddleImage}
                            src="/riddles/riddle_2.png"
                          />
                        </div>
                      </div>
                    </details>
                    <ScanSolvedSummary hasFourthScanResult={scannedItems.includes(scannedNineCard.id)} />
                    <ScanAnswerPanel
                      answer={fourthScanAnswer}
                      inventoryCards={visiblePhysicalScanInventoryCards}
                      illustration={fourthScanIllustration}
                      splitIndexes={fourthScanSplitIndexes}
                      onAnswerChange={setFourthScanAnswer}
                      onIllustrationChange={(value) => {
                        setFourthScanIllustration(value);
                        setFourthScanSplitIndexes([]);
                      }}
                      onSplitChange={(indexes, value) => {
                        setFourthScanSplitIndexes(indexes);
                        setFourthScanIllustration(value);
                      }}
                      disabled={!isRiddlePrintExchangeApplied}
                      onSubmit={() => runFourthBattleScan()}
                      message={scanTutorialMessage}
                    >
                      {isFourthScanGenerated ? (
                        <>
                        <ScanTargetPreview alt="今回スキャンした対象: 急所" src={scanTargetImages.kyuusho} />
                        <div className="flex justify-center rounded border border-emerald-300/35 bg-emerald-950/35 p-3">
                          <PlayingCardView card={scannedNineCard} size="hand" />
                        </div>
                        </>
                      ) : null}
                    </ScanAnswerPanel>
                  </div>
                )}
              </div>
            ) : null}
            <GameTableReturnButton
              className="mt-4 w-full"
              onClick={() => setShowPreparation(false)}
            />
          </section>
        </div>
      ) : (
      <div className="grid gap-3 p-4">
        <div className="grid gap-3">
          {phase === "idle" && activeBlackjackGame === "ready" ? (
            <GameStartRow robotId={robotId}>
              <button
                className={`min-h-12 rounded px-4 py-3 text-sm font-black ${
                  (isFinalBattle && !isFinalPreparationApplied) || isFourthBattlePreparationRequired
                    ? "cursor-not-allowed bg-stone-700 text-stone-400"
                    : "bg-brass text-stone-950 hover:bg-yellow-300"
                }`}
                disabled={(isFinalBattle && !isFinalPreparationApplied) || isFourthBattlePreparationRequired}
                onClick={startRound}
                type="button"
              >
                ゲームスタート
              </button>
            </GameStartRow>
          ) : null}
          {canOpenPreparation ? (
            <div className="flex justify-end">
              <button
                className={`min-h-12 rounded border border-brass bg-black/35 px-4 py-3 text-sm font-black text-brass hover:bg-brass/10 ${shouldPulsePreparationButton ? "animate-pulse ring-4 ring-brass/45" : ""}`}
                onClick={() => {
                  setShowPreparation(true);
                  if (canUseScan) setPreparationAbility("scan");
                  setShouldHighlightScanPreparationButton(false);
                }}
                type="button"
              >
                車内で準備
              </button>
            </div>
          ) : null}
        </div>
        {blackjackDraggingCard && blackjackDragPreviewPoint ? (
          <DraggingCardPreview
            card={blackjackDraggingCard}
            point={blackjackDragPreviewPoint}
          />
        ) : null}
        {showBlackjackResultOverlay ? (
          <BattleResultOverlay
            result={result === "win" ? "win" : "lose"}
            onDismiss={() => setBlackjackResultOverlayDismissed(true)}
          />
        ) : null}
        <section className="rounded border border-white/12 bg-black/28 p-3">
          <div className="grid gap-3">
            {activeBlackjackGame === "high-low" ? (
              <div className="rounded border border-emerald-200/20 bg-emerald-950/45 p-3 shadow-[inset_0_0_70px_rgba(0,0,0,0.35)]">
                <div className="grid grid-cols-2 gap-2">
                  <HighLowZone
                    canPlace={
                      !blackjackHighLowPlacementConfirmed &&
                      blackjackHighLowPlayerZone === null
                    }
                    label="HIGH"
                    onPlace={() => placeBlackjackHighLowCard("HIGH")}
                    onDropCard={() =>
                      placeBlackjackHighLowCard(
                        "HIGH",
                        blackjackDraggingCardId ?? undefined,
                      )
                    }
                    placeDisabled={blackjackHighLowRobotZone === "HIGH"}
                    placementAnimation={
                      blackjackHighLowPlacementAnimation?.zone === "HIGH"
                        ? blackjackHighLowPlacementAnimation
                        : null
                    }
                    playerCard={
                      blackjackHighLowPlayerZone === "HIGH"
                        ? blackjackHighLowPlayerCard
                        : null
                    }
                    playerPlaced={blackjackHighLowPlayerZone === "HIGH"}
                    robotCard={
                      blackjackHighLowRobotZone === "HIGH"
                        ? blackjackHighLowRobotCard
                        : null
                    }
                    robotPlaced={blackjackHighLowRobotZone === "HIGH"}
                    spotlight={false}
                    tone="high"
                  />
                  <HighLowZone
                    canPlace={
                      !blackjackHighLowPlacementConfirmed &&
                      blackjackHighLowPlayerZone === null
                    }
                    label="LOW"
                    onPlace={() => placeBlackjackHighLowCard("LOW")}
                    onDropCard={() =>
                      placeBlackjackHighLowCard(
                        "LOW",
                        blackjackDraggingCardId ?? undefined,
                      )
                    }
                    placeDisabled={blackjackHighLowRobotZone === "LOW"}
                    placementAnimation={
                      blackjackHighLowPlacementAnimation?.zone === "LOW"
                        ? blackjackHighLowPlacementAnimation
                        : null
                    }
                    playerCard={
                      blackjackHighLowPlayerZone === "LOW"
                        ? blackjackHighLowPlayerCard
                        : null
                    }
                    playerPlaced={blackjackHighLowPlayerZone === "LOW"}
                    robotCard={
                      blackjackHighLowRobotZone === "LOW"
                        ? blackjackHighLowRobotCard
                        : null
                    }
                    robotPlaced={blackjackHighLowRobotZone === "LOW"}
                    spotlight
                    tone="low"
                  />
                </div>
                {blackjackHighLowPlacementConfirmationControls}
                {blackjackHighLowResult ? (
                  <div
                    className={`mt-3 rounded border p-3 text-sm font-bold leading-6 ${
                      blackjackHighLowResult === "win"
                        ? "border-emerald-300 bg-emerald-950/55 text-emerald-100"
                        : "border-casinoRed bg-red-950/55 text-red-100"
                    }`}
                  >
                    {getHighLowResultText(
                      blackjackHighLowHighCard,
                      blackjackHighLowLowCard,
                      blackjackHighLowResult,
                    )}
                  </div>
                ) : blackjackHighLowPlayerZone ? null : (
                  <TutorialBubble className="mt-3">
                    ハイ＆ローから開始します。
                  </TutorialBubble>
                )}
              </div>
            ) : null}

            {isBlackjackStarted ? (
              <div>
                <BlackjackFieldArea
                  canDropPlayerCard={blackjackDraggableCardIds.length > 0}
                  onDropPlayerCard={dropBlackjackPlayerCard}
                  placementAnimation={placementAnimation}
                placementAnimationMode={placementAnimationMode}
                playerCards={blackjackPlayerFieldCards}
                playerValue={blackjackPlayerFieldValue}
                robotCards={blackjackRobotFieldCards}
                robotValue={blackjackRobotFieldValue}
              />
                {blackjackPlacementConfirmationControls}
              </div>
            ) : null}

            {shouldShowGameStartHandState ? (
              <GameStartHandNotice />
            ) : null}

            <BlackjackField
              cards={visibleActivePlayerHand}
              draggableCardIds={
                activeBlackjackGame === "blackjack"
                  ? blackjackDraggableCardIds
                  : activeBlackjackGame === "high-low" &&
                      !blackjackHighLowPlacementConfirmed &&
                      blackjackHighLowPlayerZone === null
                    ? playerHand.map((card) => card.id)
                    : []
              }
              isBlackjack={false}
              label="プレイヤーの手札"
              notice={
                robotId === "blackjack-high-low-2-3"
                  ? "エクスチェンジ不可"
                  : undefined
              }
              onCardDragEnd={() => {
                setBlackjackDraggingCardId(null);
                setBlackjackDragPreviewPoint(null);
              }}
              onCardDragMove={setBlackjackDragPreviewPoint}
              onCardDragStart={(cardId, point) => {
                setBlackjackDraggingCardId(cardId);
                setBlackjackDragPreviewPoint(point);
              }}
              revealSecond
              score={null}
            />
            {showBlackjackDeclaration ? (
              <BlackjackDeclarationOverlay />
            ) : null}
            {highLowRobotHand.length > 0 && activeBlackjackGame !== "blackjack" ? (
              <BlackjackField
                cards={visibleHighLowRobotHand}
                actions={
                  <GameInfoButtons
                    gameType="high-low"
                    onOpenModal={onOpenModal}
                    robot={robot}
                  />
                }
                isBlackjack={false}
                label="ハイ＆ローのロボット手札"
                notice={
                  areRobotHandsExchangeDisabled
                    ? "エクスチェンジ不可"
                    : undefined
                }
                revealSecond
                score={null}
              />
            ) : null}
            {activeBlackjackGame !== "high-low" ? (
              <BlackjackField
                actions={
                  <GameInfoButtons
                    gameType="blackjack"
                    onOpenModal={onOpenModal}
                    robot={robot}
                  />
                }
                cards={visibleBlackjackRobotHand}
                isBlackjack={false}
                label="ブラックジャックのロボット手札"
                notice={
                  areRobotHandsExchangeDisabled
                    ? "エクスチェンジ不可"
                    : undefined
                }
                revealSecond
                score={null}
              />
            ) : null}
          </div>

          <div className="mt-4 rounded border border-brass/60 bg-black/50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              テーブルメッセージ
            </p>
            <p className="mt-2 min-h-12 text-sm font-bold leading-6 text-stone-100">
              {blackjackSecondPlacementPending ||
              (activeBlackjackGame === "high-low" && blackjackHighLowPlayerZone)
                ? ""
                : message}
            </p>
            {result ? (
              <div className="mt-2">
                <p className="text-2xl font-black text-brass">
                  {result === "win" ? "YOU WIN" : "YOU LOSE"}
                </p>
                {result === "win" && learningRestriction ? (
                  <VictoryConditionNotice message={learningRestriction} />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className={`${phase === "idle" && activeBlackjackGame === "ready" ? "hidden" : "flex"} flex-col gap-3 rounded border border-white/12 bg-black/28 p-3`}>
          {phase === "result" ? (
            <button
              className="min-h-12 rounded border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
              onClick={resetRound}
              type="button"
            >
              もう一度確認
            </button>
          ) : null}

          {phase === "result" && result === "win" && robotId === "blackjack-2-1" ? (
            <button
              className="grid min-h-12 place-items-center rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
              onClick={() => onNextBattle("blackjack-2-2")}
              type="button"
            >
              2戦目へ
            </button>
          ) : null}

          {phase === "result" && result === "win" && robotId === "blackjack-2-2" ? (
            <button
              className="grid min-h-12 place-items-center rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
              onClick={() => onNextBattle("blackjack-2-3")}
              type="button"
            >
              3戦目へ
            </button>
          ) : null}

          {phase === "result" && result === "win" && robotId === "blackjack-2-3" ? (
            <button
              className="grid min-h-12 place-items-center rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
              onClick={() => onNextBattle("blackjack-high-low-2-3")}
              type="button"
            >
              4戦目へ
            </button>
          ) : null}

          {phase === "result" && result === "win" && robotId === "blackjack-high-low-2-3" ? (
            <button
              className="grid min-h-12 place-items-center rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
              onClick={onAdvanceToThirdStage}
              type="button"
            >
              第3ステージへ
            </button>
          ) : null}
          <div className="hidden">
          <div className="rounded border border-white/10 bg-white/6 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              ロボット仕様
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-200">
              <HighlightedBlackjackSpecText />
            </p>
          </div>

          {phase === "idle" && canExchangePlayerHand ? (
            <div className="rounded border border-brass/50 bg-brass/10 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                事前準備
              </p>
              <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                      交換対象
                    </p>
                    <h3 className="mt-1 text-xl font-black">交換対象を2枚選択</h3>
                  </div>
                  <span className="rounded bg-white px-2 py-1 text-xs font-black text-stone-950">
                    {blackjackExchangeCardIds.length}/2
                  </span>
                </div>
                <ExchangeCardSectionPicker
                  onToggleCard={toggleBlackjackExchangeCard}
                  sections={blackjackExchangeSections}
                  selectedCardIds={blackjackExchangeCardIds}
                />
                {isBlackjackExchangeConfirmed ? (
                  <p className="mt-3 rounded border border-emerald-400/40 bg-emerald-950/40 p-3 text-sm font-black text-emerald-100">
                    エクスチェンジ対象を決定しました。
                  </p>
                ) : null}
              </div>
              <button
                className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
                  isBlackjackExchangeConfirmed
                    ? "cursor-not-allowed bg-emerald-700 text-emerald-100 opacity-70"
                    : blackjackExchangeCardIds.length === 2
                      ? "bg-brass text-stone-950 hover:bg-yellow-300"
                      : "cursor-not-allowed bg-stone-700 text-stone-400"
                }`}
                disabled={
                  blackjackExchangeCardIds.length !== 2 ||
                  isBlackjackExchangeConfirmed
                }
                onClick={() => {
                  setIsBlackjackExchangeConfirmed(true);
                  setIsCardExchangeModeActive(false);
                }}
                type="button"
              >
                決定
              </button>
            </div>
          ) : null}

          {phase === "idle" && canUseScan ? (
            <div className="rounded border border-brass/50 bg-brass/10 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                事前準備
              </p>
              <p className="mt-2 rounded border border-white/12 bg-black/35 p-3 text-sm font-bold leading-6 text-stone-100">
                自分とハイ＆ロー・ブラックジャックのロボットの手札が開示されました。
                このステージでは、プレイヤーの手札交換を禁止します。その代わりに新たな能力を解放します。
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
                      {robotId === "blackjack-2-3"
                        ? "生成したAと自分のKを交換してから勝負を始めます。"
                        : "生成した10と自分のAを交換してから勝負を始めます。"}
                  </p>
                  <ExchangeSpecToggle />
                  <ExchangeRuleList
                    disabledTargets={disabledExchangeTargets}
                    samePrintTimingLabel={samePrintTimingLabel}
                  />
                  <div className="mt-3 rounded border border-white/12 bg-white/8 p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                      スキャン生成カード
                    </p>
                    <div className="mt-3 flex min-h-28 items-center justify-center rounded border border-dashed border-white/20 bg-black/25 p-3">
                      {shouldShowScanGeneratedCards ? (
                        <div className="flex flex-wrap justify-center gap-2">
                          {scanGeneratedDisplayCards.map((card) => (
                            <PlayingCardView
                              card={card}
                              key={card.id}
                              size="hand"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-sm font-bold leading-6 text-stone-400">
                          まだ生成されていません。スキャンでカードを生成すると、
                          ここに候補として追加されます。
                        </p>
                      )}
                    </div>
                  </div>
                  {shouldShowScanGeneratedCards ? (
                    <div className="mt-3 rounded border border-sky-300/35 bg-sky-950/25 p-3">
                      <p className="text-sm font-black leading-6 text-sky-50">
                        どちらのカードを自分の手札とエクスチェンジすれば勝てる？
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(["10", "12"] as const).map((rank) => (
                          <button
                            className={`min-h-11 rounded border px-3 py-2 text-sm font-black ${
                              scanExchangeChoice === rank
                                ? rank === "10"
                                  ? "border-emerald-300 bg-emerald-500 text-stone-950"
                                  : "border-red-300 bg-red-950/55 text-red-100"
                                : "border-white/20 bg-black/35 text-stone-100 hover:bg-white/10"
                            }`}
                            key={rank}
                            onClick={() => chooseScanExchangeCard(rank)}
                            type="button"
                          >
                            {rank}のカード
                          </button>
                        ))}
                      </div>
                      {scanExchangeChoice === "10" ? (
                        <p className="mt-3 rounded border border-emerald-300/45 bg-emerald-950/45 p-3 text-sm font-black leading-6 text-emerald-100">
                          正解です。10のカードと自分のAをエクスチェンジ対象に選択しました。
                        </p>
                      ) : scanExchangeChoice === "12" ? (
                        <p className="mt-3 rounded border border-red-300/45 bg-red-950/45 p-3 text-sm font-black leading-6 text-red-100">
                          12のカードでは勝てなさそうです。もう一度選んでください。
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
                      isScanCardExchanged
                        ? "bg-emerald-500 text-stone-950"
                        : shouldShowScanGeneratedCards
                          ? "bg-brass text-stone-950 hover:bg-yellow-300"
                          : "cursor-not-allowed bg-stone-700 text-stone-400"
                    }`}
                    disabled={!shouldShowScanGeneratedCards}
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
                        回答
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
                      <ScanInventoryPanel cards={visiblePhysicalScanInventoryCards} disabled />
                      <p className="rounded border border-emerald-300/45 bg-emerald-950/35 p-3 text-sm font-black leading-6 text-emerald-100">
                        チュートリアル完了。すごろくを「す　ご　ろく」に区切ると、5 + 6 = 11。
                        11のトランプが生成されることを確認できました。
                        ゴールは5を含んでいますが、イラストではなく文字のため生成できません。
                        下部に信号機のようなものも見えますが、謎内で信号機と呼んでいないためスキャン対象にはできません。
                      </p>
                      <p className="mt-3 text-sm leading-6 text-stone-100">
                        <ScanRuleText />
                      </p>
                      <div className="mt-3 rounded border border-brass/45 bg-black/30 p-3">
                        <p className="text-sm font-black leading-6 text-brass">
                          それぞれの小謎でカード生成に使えるイラストを探そう
                        </p>
                        <p className="text-sm font-bold leading-6 text-stone-100">
                          まず小謎①と②の答えを入力してください。
                        </p>
                        <div className="mt-3 grid gap-3">
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            小謎①の答え
                            <input
                              className={getCheckedInputClass(
                                scanRiddleAnswerOne,
                                scanRiddleAnswerResults.one,
                              )}
                              onChange={(event) => {
                                setScanRiddleAnswerOne(event.target.value);
                                setScanRiddleAnswerResults((current) => ({
                                  ...current,
                                  one: null,
                                }));
                                setAreScanRiddleAnswersConfirmed(false);
                                setAreScanRiddleAnswersSolved(false);
                                setScanRiddleIllustrationResults({
                                  one: null,
                                  two: null,
                                });
                                setScanExchangeChoice(null);
                              }}
                              placeholder="小謎①の答えを入力"
                              value={scanRiddleAnswerOne}
                            />
                            <CheckResultText result={scanRiddleAnswerResults.one} />
                          </label>
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            小謎②の答え
                            <input
                              className={getCheckedInputClass(
                                scanRiddleAnswerTwo,
                                scanRiddleAnswerResults.two,
                              )}
                              onChange={(event) => {
                                setScanRiddleAnswerTwo(event.target.value);
                                setScanRiddleAnswerResults((current) => ({
                                  ...current,
                                  two: null,
                                }));
                                setAreScanRiddleAnswersConfirmed(false);
                                setAreScanRiddleAnswersSolved(false);
                                setScanRiddleIllustrationResults({
                                  one: null,
                                  two: null,
                                });
                                setScanExchangeChoice(null);
                              }}
                              placeholder="小謎②の答えを入力"
                              value={scanRiddleAnswerTwo}
                            />
                            <CheckResultText result={scanRiddleAnswerResults.two} />
                          </label>
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                        印刷済み謎
                      </p>
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
                          <ZoomableRiddleImage alt="スキャン解放謎" badge="⓪" src="/riddles/riddle_0.png" onOpen={setExpandedRiddleImage} />
                          {scanRiddleImages.map((image, index) => (
                            <div
                              className="rounded border border-stone-300 bg-white"
                              key={image.src}
                            >
                              {index === 0 || index === 2 ? (
                                <span className="mb-1 ml-1 mt-1 inline-grid h-8 min-w-8 place-items-center rounded border border-brass/70 bg-black/80 px-2 text-sm font-black text-brass shadow-lg">
                                  {index === 0 ? "①" : "②"}
                                </span>
                              ) : null}
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
                          areScanRiddleAnswersConfirmed
                            ? "bg-emerald-500 text-stone-950"
                            : "bg-brass text-stone-950 hover:bg-yellow-300"
                        }`}
                        onClick={solvePrintedScanRiddles}
                        type="button"
                      >
                        {areScanRiddleAnswersConfirmed ? "回答済み" : "回答"}
                      </button>
                      {areScanRiddleAnswersConfirmed ? (
                        <div className="mt-3 grid gap-3 rounded border border-brass/45 bg-black/30 p-3">
                          <p className="text-sm font-black leading-6 text-brass">
                            カード生成に使えるイラストの呼称を入力してください。
                          </p>
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            小謎①のイラストの呼称（10が生成できるイラストを探そう）
                            <input
                              className={getCheckedInputClass(
                                scanRiddleIllustrationOne,
                                scanRiddleIllustrationResults.one,
                              )}
                              onChange={(event) => {
                                setScanRiddleIllustrationOne(event.target.value);
                                setScanRiddleIllustrationOneSplitIndexes([]);
                                setScanRiddleIllustrationResults((current) => ({
                                  ...current,
                                  one: null,
                                }));
                                setAreScanRiddleAnswersSolved(false);
                                setScanExchangeChoice(null);
                              }}
                              placeholder="イラストの呼称を入力"
                              value={scanRiddleIllustrationOne}
                            />
                            <CheckResultText
                              result={scanRiddleIllustrationResults.one}
                            />
                          </label>
                          {scanRiddleIllustrationResults.one === true ? (
                            <IllustrationSplitSelector
                              onChange={(indexes, dividedText) => {
                                setScanRiddleIllustrationOneSplitIndexes(indexes);
                                setScanRiddleIllustrationOne(dividedText);
                              }}
                              selectedIndexes={
                                scanRiddleIllustrationOneSplitIndexes
                              }
                              value={scanRiddleIllustrationOne}
                            />
                          ) : null}
                          <label className="grid gap-2 text-sm font-bold text-stone-100">
                            小謎②のイラストの呼称（12が生成できるイラストを探そう）
                            <input
                              className={getCheckedInputClass(
                                scanRiddleIllustrationTwo,
                                scanRiddleIllustrationResults.two,
                              )}
                              onChange={(event) => {
                                setScanRiddleIllustrationTwo(event.target.value);
                                setScanRiddleIllustrationTwoSplitIndexes([]);
                                setScanRiddleIllustrationResults((current) => ({
                                  ...current,
                                  two: null,
                                }));
                                setAreScanRiddleAnswersSolved(false);
                                setScanExchangeChoice(null);
                              }}
                              placeholder="イラストの呼称を入力"
                              value={scanRiddleIllustrationTwo}
                            />
                            <CheckResultText
                              result={scanRiddleIllustrationResults.two}
                            />
                          </label>
                          {scanRiddleIllustrationResults.two === true ? (
                            <IllustrationSplitSelector
                              onChange={(indexes, dividedText) => {
                                setScanRiddleIllustrationTwoSplitIndexes(indexes);
                                setScanRiddleIllustrationTwo(dividedText);
                              }}
                              selectedIndexes={
                                scanRiddleIllustrationTwoSplitIndexes
                              }
                              value={scanRiddleIllustrationTwo}
                            />
                          ) : null}
                          <button
                            className={`min-h-11 rounded px-3 py-2 text-sm font-black ${
                              areScanRiddleAnswersSolved
                                ? "bg-emerald-500 text-stone-950"
                                : "bg-brass text-stone-950 hover:bg-yellow-300"
                            }`}
                            onClick={solveScanIllustrationNames}
                            type="button"
                          >
                            {areScanRiddleAnswersSolved ? "回答済み" : "回答"}
                          </button>
                        </div>
                      ) : null}
                      {areScanRiddleAnswersSolved ? (
                        <button
                          className="mt-3 min-h-11 w-full rounded bg-sky-500 px-3 py-2 text-sm font-black text-white hover:bg-sky-400"
                          onClick={() => setPreparationAbility("exchange")}
                          type="button"
                        >
                          エクスチェンジへ
                        </button>
                      ) : null}
                    </>
                  )}
                  {isScanExchangeConfirmed && isScanExchangeCorrect ? (
                    <>
                      <div>
                        <PhysicalScanPanel
                          canAnswerRoleName={isPhysicalScanCardCountReady}
                          canRun={canRunPhysicalScan}
                          cards={visiblePhysicalScanInventoryCards}
                          generatedCard={scannedPhysicalScanCard}
                          generatedLabel={
                            physicalScanConfig?.generatedLabel ??
                            "3のカードを生成済み"
                          }
                          isGenerated={isPhysicalScanGenerated}
                          message={physicalScanMessage}
                          onAnswerRoleName={answerPhysicalScanRoleName}
                          onRun={runPhysicalScan}
                          onSplitChange={changePhysicalScanSplit}
                          onToggleCard={togglePhysicalScanCard}
                          prompt={physicalScanConfig?.prompt ?? ""}
                          reading={physicalScanReading}
                          readingPrompt={
                            physicalScanConfig?.readingPrompt ??
                            "通常のスキャンと同じく、区切り位置を指定してください。"
                          }
                          requiredSelectionCount={
                            physicalScanConfig?.requiredSelectionCount ?? 3
                          }
                          selectedCardIds={physicalScanCardIds}
                          splitIndexes={physicalScanSplitIndexes}
                        />
                      </div>
                      {isPhysicalScanGenerated ? (
                        <button
                          className="mt-3 min-h-11 w-full rounded bg-sky-500 px-3 py-2 text-sm font-black text-white hover:bg-sky-400"
                          onClick={() => {
                            setShowPreparation(false);
                            setShowPhysicalScanDisposalDialog(true);
                          }}
                          type="button"
                        >
                          対戦画面へ
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  {scanTutorialMessage ? (
                    <div className="mt-3 rounded border border-white/12 bg-white/8 p-3">
                      {scanGeneratedPreviewSources.map((src) => (
                        <ScanTargetPreview
                          key={src}
                          alt="今回スキャンした対象"
                          src={src}
                        />
                      ))}
                      <ScanFeedbackMessage message={scanTutorialMessage} />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {phase === "idle" && canSelectRiddlePrints ? (
            <div className="rounded border border-brass/50 bg-brass/10 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                4戦目の準備
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-100">
                小謎①を確認し、9のトランプを生成します。
              </p>
              <ExchangeModeToggleButton
                className="mt-3"
                isActive={isRiddleExchangeModeActive}
                isCompleted={isFourthRobotExchangeConfirmed}
                onClick={activateRiddleExchangeMode}
              />
              <RiddlePrintTargetPicker
                disabled={
                  !isRiddleExchangeModeActive || isRiddlePrintExchangeApplied
                }
                isExchanged={isRiddlePrintExchangeApplied}
                onOpen={setExpandedRiddleImage}
                onToggleTarget={toggleRiddlePrintTarget}
                selectedIds={selectedRiddlePrintIds}
              />
              <button
                className={`mt-3 min-h-11 w-full rounded px-3 py-2 text-sm font-black ${
                  isRiddlePrintExchangeApplied
                    ? "cursor-not-allowed bg-emerald-700 text-emerald-100 opacity-70"
                    : isRiddleExchangeModeActive &&
                        selectedRiddlePrintIds.length === 2
                      ? "bg-brass text-stone-950 hover:bg-yellow-300"
                      : "cursor-not-allowed bg-stone-700 text-stone-400"
                }`}
                disabled={
                  !isRiddleExchangeModeActive ||
                  selectedRiddlePrintIds.length !== 2 ||
                  isRiddlePrintExchangeApplied
                }
                onClick={confirmRiddlePrintExchangeSelection}
                type="button"
              >
                決定
              </button>
              {isRiddlePrintExchangeApplied ? (
                <p className="mt-3 rounded border border-emerald-400/40 bg-emerald-950/40 p-3 text-sm font-black text-emerald-100">
                  {isFourthRobotExchangeConfirmed
                    ? "エクスチェンジ対象を決定しました。"
                    : "エクスチェンジ発動しました。"}
                </p>
              ) : null}

              <ScanSolvedSummary hasFourthScanResult={scannedItems.includes(scannedNineCard.id)} />
              <ScanAnswerPanel
                answer={fourthScanAnswer}
                inventoryCards={visiblePhysicalScanInventoryCards}
                illustration={fourthScanIllustration}
                splitIndexes={fourthScanSplitIndexes}
                onAnswerChange={setFourthScanAnswer}
                onIllustrationChange={(value) => {
                  setFourthScanIllustration(value);
                  setFourthScanSplitIndexes([]);
                }}
                onSplitChange={(indexes, value) => {
                  setFourthScanSplitIndexes(indexes);
                  setFourthScanIllustration(value);
                }}
                disabled={!isRiddlePrintExchangeApplied}
                onSubmit={runFourthBattleScan}
                message={scanTutorialMessage}
              >
                {isFourthScanGenerated ? (
                  <>
                  <ScanTargetPreview alt="今回スキャンした対象: 急所" src={scanTargetImages.kyuusho} />
                  <div className="flex justify-center rounded border border-emerald-300/35 bg-emerald-950/35 p-3">
                    <PlayingCardView card={scannedNineCard} size="hand" />
                  </div>
                  </>
                ) : null}
              </ScanAnswerPanel>

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
            ゲームスタート
            </button>
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
          </div>
        </section>
      </div>
      )}
    </div>
  );
}

function BlackjackDeclarationOverlay({ text = "ブラックジャック" }: { text?: string }) {
  return (
    <div className="declaration-overlay pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="status" aria-live="polite">
      <div className="w-full max-w-lg rounded border-2 border-brass bg-white px-5 py-6 text-center shadow-[0_18px_60px_rgba(0,0,0,0.55)] sm:px-8">
        <p className="text-sm font-black text-stone-600">
          宣言
        </p>
        <p className="mt-2 break-words text-2xl font-black leading-relaxed text-red-800 sm:text-4xl">
          {text}
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
    "ブラックジャック宣言のタイミングで、ハイ＆ローのKと自分のJ、自分のAと生成済みKをエクスチェンジできるようにする",
  ];

  return (
    <div className="rounded border border-brass/55 bg-brass/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
            ファイナル事前準備
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
          ["エクスチェンジ", "1回"],
          ["スキャン", "3回"],
          ["コピーペースト", "5回"],
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
          ポーカーロボット
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
          コピーペースト対象
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

function FinalCopyPasteWorkbench({ isApplied, onAppliedChange }: {
  isApplied: boolean;
  onAppliedChange: (applied: boolean) => void;
}) {
  const [format, setFormat] = useState<CopyPasteFormat>("hiragana");
  const [step, setStep] = useState<"source" | "target" | null>(null);
  const [source, setSource] = useState<{ id: string; label: string; text: string }>();
  const [target, setTarget] = useState<{ id: string; label: string; text: string }>();
  const [error, setError] = useState("");
  const [expandedImage, setExpandedImage] = useState<{ alt: string; src: string } | null>(null);
  const formatLabels = { hiragana: "平仮名", katakana: "カタカナ", kanji: "漢字", number: "数字" };
  function select(id: string, text: string) {
    if (step === "source") {
      setSource({ id, label: text, text });
      setStep("target");
    } else if (step === "target" && id !== source?.id) {
      setTarget({ id, label: text, text });
      setStep(null);
    }
  }
  return (
    <BlueTextSelectionContext.Provider value={{
      active: step !== null,
      selectedId: step === "source" ? source?.id ?? null : target?.id ?? null,
      replacements: {},
      onSelect: select,
    }}>
      {expandedImage ? <RiddleImageModal {...expandedImage} onClose={() => setExpandedImage(null)} /> : null}
      <CopyPastePreparationPanel
        copiedTarget={source}
        pasteTarget={target}
        format={format}
        formatLabel={formatLabels[format]}
        isApplied={isApplied}
        isSelecting={step !== null}
        maxCopyPastes={isApplied ? 0 : 1}
        error={error}
        appliedText="ハイ＆ロー"
        onChooseFormat={setFormat}
        onStart={() => {
          setStep(step ? null : "source");
          setSource(undefined);
          setTarget(undefined);
          setError("");
        }}
        onPaste={() => {
          if (source?.id !== "high-low-declaration" || target?.id !== "final-riddle-game" || format === "number") {
            setError("文章の意味が通らないため、ペーストできません。");
            return;
          }
          onAppliedChange(true);
          setStep(null);
          setError("");
        }}
        onReset={() => {
          onAppliedChange(false);
          setSource(undefined);
          setTarget(undefined);
          setStep(null);
          setError("");
        }}
      />
      <CopyPasteGameSpecifications onOpenGuideImage={setExpandedImage} />
      <details className="mt-3 rounded border border-white/15 bg-black/30 p-3">
        <summary className="cursor-pointer text-sm font-black text-brass">小謎の紙</summary>
        <div className="relative mt-3 overflow-hidden rounded bg-white">
          <Image alt="小謎の紙" className="h-auto w-full" height={900} src="/riddles/riddle_4.png" width={1600} />
          <button
            aria-label="小謎の紙の青字"
            className="absolute left-[40%] top-[5%] h-[10%] w-[23%] text-sm font-black text-sky-500"
            onClick={() => select("final-riddle-game", isApplied ? "ハイ＆ロー" : "ポーカー")}
            type="button"
          >
            {isApplied ? <span className="bg-white">ハイ＆ロー</span> : null}
          </button>
        </div>
      </details>
    </BlueTextSelectionContext.Provider>
  );
}

function CardPlacementAnimation({
  cardSize = "hand",
  className = "",
  mode = "release",
  styleType,
}: {
  cardSize?: "hand" | "zone";
  className?: string;
  mode?: "hold" | "release";
  styleType: PlacementStyle;
}) {
  const isGentle = styleType === "gentle";
  const animationClass = mode === "hold" ? "holdingHand" : isGentle ? "gentleHand" : "snapHand";

  return (
    <div className={`pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden ${className}`}>
      <div className={`${animationClass} ${cardSize === "zone" ? "zoneHand" : ""}`}>
        <Image
          alt=""
          className="object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.34)]"
          fill
          priority
          sizes={cardSize === "zone" ? "(min-width: 640px) 300px, 200px" : "(min-width: 640px) 200px, 170px"}
          src="/hand.png"
        />
      </div>
      <style jsx>{`
        .gentleHand,
        .holdingHand,
        .snapHand {
          position: absolute;
          --card-height: 80px;
          height: calc(var(--card-height) * 2.3);
          width: calc(var(--card-height) * 1.725);
          transform-origin: center;
        }

        .zoneHand {
          --card-height: 96px;
        }

        @media (min-width: 640px) {
          .gentleHand,
          .holdingHand,
          .snapHand {
            --card-height: 96px;
          }

          .zoneHand {
            --card-height: 144px;
          }
        }

        .holdingHand {
          opacity: 1;
          transform: translate(-4px, calc(var(--card-height) * -0.45)) scale(1.18);
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
            transform: translate(-4px, calc(var(--card-height) * -0.45)) scale(1.18);
          }
          38% {
            opacity: 1;
            transform: translate(-4px, calc(var(--card-height) * -0.45)) scale(1.18);
          }
          62% {
            opacity: 1;
            transform: translate(-4px, calc(var(--card-height) * -0.45 - 10px)) scale(1.02);
          }
          100% {
            opacity: 0;
            transform: translate(-4px, calc(var(--card-height) * -0.45 - 44px)) scale(1);
          }
        }

        @keyframes snap-place {
          0% {
            opacity: 1;
            transform: translate(-4px, calc(var(--card-height) * -0.45)) rotate(-7deg) scale(1.18);
          }
          32% {
            opacity: 1;
            transform: translate(-4px, calc(var(--card-height) * -0.45)) rotate(-7deg) scale(1.18);
          }
          48% {
            transform: translate(-6px, calc(var(--card-height) * -0.45 - 9px)) rotate(-10deg) scale(1.02);
          }
          100% {
            opacity: 0;
            transform: translate(-10px, calc(var(--card-height) * -0.45 - 42px)) rotate(-4deg) scale(1);
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
      <span className="block">
        JQKは
        <span className="font-black text-red-300">10</span>
        、Aは
        <SelectableBlueText id="blackjack-ace-value">11</SelectableBlueText>
        として扱い、それ以外は数字通り
      </span>
      <span className="mt-3 block">①数字の大きい1枚目を置き、2枚目を重ねて置く</span>
      <span className="block">
        ②
        <SelectableBlueText id="blackjack-declaration">ブラックジャック</SelectableBlueText>
        と宣言して判定を開始
      </span>
      <span className="block">
        ③1枚目と2枚目の合計がブラックジャック（
        <span className="font-black text-red-300">21の役</span>
        ）に近い方の勝ち
      </span>
      <span className="block">（双方21ならプレイヤーの勝ちとする）</span>
    </>
  );
}

function HighlightedBlackjackSpecText() {
  return (
    <>
      <span className="block">
        ユニークスキル：役の21以外で引き分けとなった瞬間、プレイヤーを
        <span className="font-black text-red-300">物理的に倒す</span>
      </span>
      <span className="mt-3 block">
        置かれたカードのカウントを目視で行い、公平な判定を行う
      </span>
    </>
  );
}

function HighlightedHighLowRuleText() {
  return (
    <>
      <span className="block">
        お互いに手札2枚ずつ用意。プレイヤーの勝利条件は
        <span className="font-black text-red-300">
          カードの大小関係が成り立つこと
        </span>
        。
      </span>
      <span className="mt-3 block">
        ①ロボットが大小関係成り立たないよう先に置く
      </span>
      <span className="block">②プレイヤーが置く</span>
      <span className="block">
        ③
        <SelectableBlueText id="high-low-declaration">ハイ＆ロー</SelectableBlueText>
        と宣言して判定する。
      </span>
    </>
  );
}

function HighlightedHighLowSpecText() {
  return (
    <>
      <span className="block">ユニークスキル：プレイヤーの手札を透視</span>
      <span className="block">
        結果に差がない場合は、
        <span className="font-black text-red-300">
          大きい数字を優先して出す
        </span>
      </span>
    </>
  );
}

function PokerRuleContent({
  onOpenGuideImage,
  ruleText,
  showRobotWinRate = false,
}: {
  onOpenGuideImage?: (image: { alt: string; src: string }) => void;
  ruleText: string;
  showRobotWinRate?: boolean;
}) {
  const highlightedKeyword = "役名";
  const ruleTextParts = ruleText.split(highlightedKeyword);

  return (
    <>
      <span className="whitespace-pre-line">
        {ruleTextParts.map((part, index) => (
          <Fragment key={`${part}-${index}`}>
            {part}
            {index < ruleTextParts.length - 1 ? (
              <span className="font-black text-red-300">
                {highlightedKeyword}
              </span>
            ) : null}
          </Fragment>
        ))}
      </span>
      {showRobotWinRate ? (
        <span className="mt-3 block rounded border border-sky-300/40 bg-sky-950/35 p-3 text-base font-black text-sky-100">
          現在算出した勝率：0% / ベット：0chip
        </span>
      ) : null}
      <button
        className="mt-3 block w-full overflow-hidden rounded border border-white/12 bg-white p-1 text-left"
        onClick={() => {
          onOpenGuideImage?.({
            alt: "4枚ポーカー役一覧",
            src: "/poker-hands-guide.svg",
          });
        }}
        type="button"
      >
        <Image
          alt="4枚ポーカー役一覧"
          className="h-auto w-full transition-transform duration-200 hover:scale-[1.015]"
          height={900}
          src="/poker-hands-guide.svg"
          width={1400}
        />
      </button>
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
  const highlightedSpecParts = new Set([
    "自分の手札とフィールドを常に見ており",
    "AKQJの16枚の山札1つで3つのゲームを行うことを知っており",
  ]);
  const specParts = specText.split(/(自分の手札とフィールドを常に見ており|AKQJの16枚の山札1つで3つのゲームを行うことを知っており)/);
  const bettingFormula = "ポーカーロボット勝率（引き分けを含む）×所持チップ";

  return (
    <>
      {specParts.map((part, index) => highlightedSpecParts.has(part) ? (
        <Fragment key={index}>
          {part === "AKQJの16枚の山札1つで3つのゲームを行うことを知っており" ? <br /> : null}
          <span className="font-black text-red-300">{part}</span>
        </Fragment>
      ) : <Fragment key={index}>{part}</Fragment>)}
      {showBettingSpec ? (
        <span className="mt-3 block">
          <span className="font-black text-red-300">{bettingFormula}</span>
          {pokerBettingSpecText.slice(bettingFormula.length)}
        </span>
      ) : null}
    </>
  );
}

function PokerSelectedHandPanel({
  cards,
  evaluation,
}: {
  cards: PlayingCard[];
  evaluation: PokerHandEvaluation | null;
}) {
  return (
    <div className="rounded border border-brass/60 bg-black/50 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
        選択中の役
      </p>
      <div className="mt-3 flex min-h-28 flex-wrap items-center justify-center gap-3 rounded border border-dashed border-white/20 bg-black/25 p-3">
        {cards.map((card) => (
          <PlayingCardView card={card} key={card.id} size="hand" />
        ))}
      </div>
      <p className="mt-3 text-sm font-bold leading-6 text-stone-100">
        {evaluation
          ? `あなたの役: ${evaluation.label}`
          : "手札2枚と組み合わせるカード2枚を、フィールド4枚から選択します。"}
      </p>
    </div>
  );
}

function PokerBettingTutorial({
  onComplete,
  onOpenModal,
  robot,
}: {
  onComplete: () => void;
  onOpenModal: (kind: ModalKind, gameType: GameType) => void;
  robot: Robot;
}) {
  const [phase, setPhase] = useState<"betting" | "playing" | "result">("betting");
  const [showIntroduction, setShowIntroduction] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const playerCards = getCardsById(["A-spade", "A-daia"]);
  const robotCards = getCardsById(["K-crub", "K-heart"]);
  const fieldCards = getCardsById(["K-daia", "A-heart", "Q-heart", "J-crub"]);
  const robotSelection = getBestPokerSelection(robotCards, fieldCards);
  const selectedCards = fieldCards.filter((card) => selectedIds.includes(card.id));
  const playerSelection = [...playerCards, ...selectedCards];
  const playerEvaluation = selectedIds.length === 2 ? evaluatePokerHand(playerSelection) : null;
  const outcome = playerEvaluation && robotSelection
    ? comparePokerHands(playerEvaluation, robotSelection.evaluation)
    : 0;
  const winRate = getPokerRobotWinRate(robotCards, fieldCards);
  const chips = 100;
  const robotBet = Math.floor(chips * winRate);
  const result = outcome > 0 ? "win" : "lose";

  return (
    <div className="bg-[#071b12] text-white">
      {showIntroduction ? (
        <TutorialDialog
          onDismiss={() => setShowIntroduction(false)}
          text="ポーカー最後の要素、「チップの賭け」について説明しよう。ロボットは勝率×所持チップを賭け、プレイヤーはオールインする。まずはポーカーだけで練習してみよう。"
          tone="hands"
        />
      ) : null}
      {phase === "result" && !overlayDismissed ? (
        <BattleResultOverlay result={result} onDismiss={() => setOverlayDismissed(true)} />
      ) : null}
      <header className="border-b border-white/10 bg-black/28 p-4">
        <Image alt="ポーカー" className="h-12 w-36 rounded bg-white object-contain p-1" height={80} src="/game-logos/poker.png" width={240} />
        <h2 className="mt-3 text-lg font-black text-brass">賭けチュートリアル</h2>
      </header>
      <div className="grid gap-3 p-4">
        <details className="rounded border border-white/15 p-3" open>
          <summary className="cursor-pointer text-sm font-black text-brass">ポーカーロボットの仕様</summary>
          <div className="mt-3 text-sm font-bold leading-7">
            <PokerRobotSpecContent specText={pokerSpecText} showBettingSpec />
          </div>
        </details>
        <section className="border-y border-brass/40 py-4">
          <p className="text-xs font-bold text-stone-300">練習用チップ</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm font-bold leading-7">
            <div>
              <h3 className="text-brass">プレイヤー</h3>
              <p>所持：{chips}chip</p>
              <p>ベット：{phase === "betting" ? "未確定" : `${chips}chip（オールイン）`}</p>
            </div>
            <div>
              <h3 className="text-brass">ロボット</h3>
              <p>所持：{chips}chip</p>
              <p>勝率：{(winRate * 100).toFixed(1)}%</p>
              <p>ベット：{phase === "betting" ? "未確定" : `${robotBet}chip`}</p>
            </div>
          </div>
          <p className="mt-3 text-sm font-bold leading-6 text-stone-200">
            ロボットは自分の手札とフィールドから勝率を計算し、{chips}×勝率（{(winRate * 100).toFixed(1)}%）＝{robotBet}chipを賭けます（端数切り捨て）。
          </p>
        </section>
        <PokerCardGroup cards={playerCards} label="プレイヤーの手札" />
        {phase !== "betting" ? (
          <PokerSelectedHandPanel cards={playerSelection} evaluation={playerEvaluation} />
        ) : null}
        <PokerCardGroup
          actions={<GameInfoButtons gameType="poker" onOpenModal={onOpenModal} robot={robot} />}
          cards={robotCards}
          label="ポーカーロボットの手札"
        />
        <PokerSelectableGroup
          cards={fieldCards}
          disabled={phase !== "playing"}
          label="フィールド"
          onToggle={(id) => setSelectedIds((current) => current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id].slice(-2))}
          selectedCardIds={selectedIds}
        />
        {phase === "betting" ? (
          <button className="min-h-12 rounded bg-brass px-4 font-black text-stone-950 hover:bg-yellow-300" onClick={() => setPhase("playing")} type="button">
            オールインしてゲームスタート
          </button>
        ) : phase === "playing" ? (
          <button
            className="min-h-12 rounded bg-brass px-4 font-black text-stone-950 hover:bg-yellow-300 disabled:bg-stone-700 disabled:text-stone-400"
            disabled={!playerEvaluation}
            onClick={() => { setOverlayDismissed(false); setPhase("result"); }}
            type="button"
          >役を決定</button>
        ) : (
          <>
            <PokerSelectableGroup cards={robotSelection?.cards ?? []} disabled label={`ロボットの役：${robotSelection?.evaluation.label ?? ""}`} onToggle={() => {}} selectedCardIds={[]} />
            <section className="border-y border-white/20 py-4 text-sm font-bold leading-7">
              <p className="text-3xl font-black text-brass">{result === "win" ? "YOU WIN" : "YOU LOSE"}</p>
              <p className="mt-3">{result === "win" ? `ロボットが賭けた${robotBet}chipを獲得しました。` : `賭けた${chips}chipを失いました。`}</p>
              <p>プレイヤー：{result === "win" ? chips + robotBet : 0}chip / ロボット：{result === "win" ? chips - robotBet : chips * 2}chip</p>
              <p className="mt-3">ロボットのベットは勝率に応じて変化し、プレイヤーは所持チップを全て賭けます。</p>
            </section>
            <button className="min-h-12 rounded border border-white/20 px-4 font-black hover:bg-white/10" onClick={() => { setSelectedIds([]); setPhase("betting"); setOverlayDismissed(false); }} type="button">もう一度確認</button>
            <button className="min-h-12 rounded bg-brass px-4 font-black text-stone-950 hover:bg-yellow-300" onClick={onComplete} type="button">チュートリアルを終えて3戦目へ</button>
          </>
        )}
      </div>
    </div>
  );
}

function PokerBattle({
  onScanCountChange,
  backHref,
  hand,
  isRiddleExchangeTimingRevealed,
  onBack,
  onOpenModal,
  onWin,
  robot,
  robotId,
}: {
  onScanCountChange: (count: number) => void;
  backHref: string;
  hand: PlayingCard[];
  isRiddleExchangeTimingRevealed: boolean;
  onBack: () => void;
  onOpenModal: (kind: ModalKind, gameType: GameType) => void;
  onWin: () => void;
  robot: Robot;
  robotId: string;
}) {
  const config =
    robotId in pokerBattleConfigs
      ? pokerBattleConfigs[robotId as keyof typeof pokerBattleConfigs]
      : null;
  const [selectedCardIds, setSelectedCardIds] = useSessionState<string[]>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:selectedCardIds`, []);
  const [exchangeCardIds, setExchangeCardIds] = useSessionState<string[]>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:exchangeCardIds`, []);
  const [confirmedPokerExchangePairs, setConfirmedPokerExchangePairs] = useSessionState<Array<{ firstCardId: string; secondCardId: string }>>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:confirmedPokerExchangePairs`, []);
  const [isExchangeApplied, setIsExchangeApplied] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:isExchangeApplied`, false);
  const [hasFinalExchangeTriggered, setHasFinalExchangeTriggered] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:hasFinalExchangeTriggered`, false);
  const [settledFinalHighLowResult, setSettledFinalHighLowResult] = useSessionState<"win" | "lose" | null>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:settledFinalHighLowResult`, null);
  const [settledFinalBlackjackResult, setSettledFinalBlackjackResult] = useSessionState<"win" | "lose" | "draw" | null>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:settledFinalBlackjackResult`, null);
  const [scannedPokerCardIds, setScannedPokerCardIds] = useSessionState<string[]>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:scannedPokerCardIds`, []);
  const [consumedPokerScanCardIds, setConsumedPokerScanCardIds] = useSessionState<string[]>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:consumedPokerScanCardIds`, []);
  const [finalPhysicalScanIds, setFinalPhysicalScanIds] = useSessionState<string[]>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:finalPhysicalScanIds`, []);
  const [finalPhysicalScanReading, setFinalPhysicalScanReading] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:finalPhysicalScanReading`, "");
  const [finalPhysicalScanSplitIndexes, setFinalPhysicalScanSplitIndexes] = useSessionState<number[]>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:finalPhysicalScanSplitIndexes`, []);
  useEffect(() => {
    onScanCountChange(scannedPokerCardIds.length);
  }, [onScanCountChange, scannedPokerCardIds.length]);
  const [pokerScanAnswer, setPokerScanAnswer] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerScanAnswer`, "");
  const [pokerBlackjackFirstPlacementPending, setPokerBlackjackFirstPlacementPending] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerBlackjackFirstPlacementPending`, false);
  const [pokerBlackjackOrderError, setPokerBlackjackOrderError] = useState(false);
  const [pokerScanIllustration, setPokerScanIllustration] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerScanIllustration`, "");
  const [pokerScanSplitIndexes, setPokerScanSplitIndexes] = useSessionState<number[]>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerScanSplitIndexes`, []);
  const [pokerScanSpecVisible, setPokerScanSpecVisible] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerScanSpecVisible`, true);
  const [expandedPokerRiddle, setExpandedPokerRiddle] = useSessionState<{ alt: string; src: string } | null>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:expandedPokerRiddle`, null);
  const hasShownPokerRiddleHint = useRef(false);
  const [showPokerRiddleHint, setShowPokerRiddleHint] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:showPokerRiddleHint`, false);
  const hasShownCopyPasteHint = useRef(false);
  const [showCopyPasteHint, setShowCopyPasteHint] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:showCopyPasteHint`, false);
  const [pokerScanMessage, setPokerScanMessage] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerScanMessage`, "");
  const [pokerScanPreviewSrc, setPokerScanPreviewSrc] = useSessionState<string | null>(
    `stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerScanPreviewSrc`, null,
  );
  const [pokerPreparationAbility, setPokerPreparationAbility] =
    useSessionState<PreparationAbility>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerPreparationAbility`, "exchange");
  const [showPreparation, setShowPreparation] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:showPreparation`, false);
  const [showSituationReview, setShowSituationReview] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:showSituationReview`, false);
  useEffect(() => {
    function handleGlobalNav(event: Event) {
      const action = (event as CustomEvent<{ action?: GlobalNavAction }>).detail?.action;
      if (action === "battle" || action === "preparation") {
        setShowSituationReview(false);
        setShowPreparation(action === "preparation");
      }
    }
    window.addEventListener(GLOBAL_NAV_EVENT, handleGlobalNav);
    return () => window.removeEventListener(GLOBAL_NAV_EVENT, handleGlobalNav);
  }, []);
  const [finalRobotBet, setFinalRobotBet] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:finalRobotBet`, 0);
  const [hasOpenedSituationReview, setHasOpenedSituationReview] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:hasOpenedSituationReview`, false);
  const [showSituationReviewHint, setShowSituationReviewHint] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:showSituationReviewHint`, false);
  const hasShownSituationReviewHint = useRef(false);
  const [activePokerGame, setActivePokerGame] = useSessionState<
    "ready" | "high-low" | "blackjack" | "poker" | "result" | "lose"
  >(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:activePokerGame`, "ready");
  const [pokerHighLowPlayerZone, setPokerHighLowPlayerZone] =
    useSessionState<HighLowZoneName | null>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerHighLowPlayerZone`, null);
  const [pokerHighLowPlayerCardId, setPokerHighLowPlayerCardId] =
    useSessionState<string | null>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerHighLowPlayerCardId`, null);
  const [pokerHighLowPlacementPending, setPokerHighLowPlacementPending] =
    useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerHighLowPlacementPending`, false);
  const [pokerHighLowPlacementConfirmed, setPokerHighLowPlacementConfirmed] =
    useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerHighLowPlacementConfirmed`, false);
  const [pokerHighLowPlacementAnimation, setPokerHighLowPlacementAnimation] =
    useState<{
      mode: "hold" | "release";
      styleType: PlacementStyle;
      zone: HighLowZoneName;
    } | null>(null);
  const [pokerHighLowDraggingCardId, setPokerHighLowDraggingCardId] =
    useState<string | null>(null);
  const [pokerHighLowDragPreviewPoint, setPokerHighLowDragPreviewPoint] =
    useState<{ x: number; y: number } | null>(null);
  const [pokerBlackjackPhase, setPokerBlackjackPhase] = useSessionState<
    "idle" | "opening-card" | "first-card" | "second-card" | "result"
  >(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerBlackjackPhase`, "idle");
  const [pokerBlackjackPlacedCardIds, setPokerBlackjackPlacedCardIds] =
    useSessionState<string[]>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerBlackjackPlacedCardIds`, []);
  const [pokerBlackjackSecondPlacementPending, setPokerBlackjackSecondPlacementPending] =
    useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerBlackjackSecondPlacementPending`, false);
  const [pokerBlackjackPlacementAnimation, setPokerBlackjackPlacementAnimation] =
    useState<PlacementStyle | null>(null);
  const [
    pokerBlackjackPlacementAnimationMode,
    setPokerBlackjackPlacementAnimationMode,
  ] = useState<"hold" | "release">("release");
  const [pokerBlackjackDraggingCardId, setPokerBlackjackDraggingCardId] =
    useState<string | null>(null);
  const [pokerBlackjackDragPreviewPoint, setPokerBlackjackDragPreviewPoint] =
    useState<{ x: number; y: number } | null>(null);
  const [showPokerBlackjackDeclaration, setShowPokerBlackjackDeclaration] =
    useState(false);
  const [showPokerRobotPunchDialog, setShowPokerRobotPunchDialog] =
    useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:showPokerRobotPunchDialog`, false);
  const [targetSelectionAbility, setTargetSelectionAbility] =
    useSessionState<TargetSelectionAbility | null>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:targetSelectionAbility`, null);
  const [copyPasteStep, setCopyPasteStep] = useSessionState<"source" | "target">(
    `stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:copyPasteStep`, "source",
  );
  const [copiedTargetId, setCopiedTargetId] = useSessionState<string | null>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:copiedTargetId`, null);
  const [pasteTargetId, setPasteTargetId] = useSessionState<string | null>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pasteTargetId`, null);
  const [selectedBlueTexts, setSelectedBlueTexts] = useSessionState<Record<string, { id: string; label: string; text: string }>>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:selectedBlueTexts`, {});
  const [copyPasteFormat, setCopyPasteFormat] =
    useSessionState<CopyPasteFormat>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:copyPasteFormat`, "hiragana");
  const [isCopyPasteApplied, setIsCopyPasteApplied] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:isCopyPasteApplied`, false);
  const [copyPasteUseCount, setCopyPasteUseCount] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:copyPasteUseCount`, 0);
  const [isCopyPasteRiddleSolved, setIsCopyPasteRiddleSolved] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:isCopyPasteRiddleSolved`, robotId === "all-games-last");
  const [pastedBlueTexts, setPastedBlueTexts] = useSessionState<Record<string, string>>(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pastedBlueTexts`, {});
  const [copyPasteError, setCopyPasteError] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:copyPasteError`, "");
  const [copyPasteSuccessMessage, setCopyPasteSuccessMessage] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:copyPasteSuccessMessage`, "");
  const [showPokerHighLowDeclaration, setShowPokerHighLowDeclaration] = useState(false);
  const maxExchanges = config ? config.maxExchanges : 1;
  const maxExchangeCardSelections = 2;
  const confirmedPokerExchangeCardIds = confirmedPokerExchangePairs.flatMap((pair) => [pair.firstCardId, pair.secondCardId]);
  const confirmedPokerExchangeColors = Object.fromEntries(confirmedPokerExchangePairs.flatMap((pair, index) => [
    [pair.firstCardId, index % 2 === 0 ? "green" : "blue"],
    [pair.secondCardId, index % 2 === 0 ? "green" : "blue"],
  ]));
  const scanRequirements =
    config && "scanRequirements" in config ? [...config.scanRequirements] : [];
  const maxScans =
    config && "maxScans" in config ? config.maxScans : scanRequirements.length;
  const remainingScans = Math.max(0, maxScans - scannedPokerCardIds.length);
  const remainingExchanges = Math.max(
    0,
    maxExchanges - confirmedPokerExchangePairs.length,
  );
  const isPokerSecondBattle = robotId === "poker-3-2";
  const [showPokerScanRiddlesDialog, setShowPokerScanRiddlesDialog] = useSessionState(
    `stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:showPokerScanRiddlesDialog`, robotId === "poker-3-2",
  );
  const pokerScanRiddles = [
        { src: "/riddles/riddle_1.png", label: "①" },
        { src: "/riddles/riddle_1-2.png", label: "" },
        { src: "/riddles/riddle_2.png", label: "②" },
        { src: "/riddles/riddle_3.png", label: "③" },
        { src: "/riddles/riddle_4.png", label: "④" },
      ].filter((riddle) => robotId !== "poker-3-1" || scanRiddleImages.some((image) => image.src === riddle.src));
  if (isCopyPasteRiddleSolved) {
    pokerScanRiddles.push({ src: "/riddles/riddle_5.png", label: "⑤" });
  }
  const isPokerThirdBattle = robotId === "poker-3-3";
  const [showCopyPasteUnlockDialog, setShowCopyPasteUnlockDialog] = useSessionState(
    `stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:showCopyPasteUnlockDialog`, robotId === "poker-3-3",
  );
  const isFinalAllGamesBattle = robotId === "all-games-last";
  const pokerLearningRestriction = !isPokerSecondBattle && !isPokerThirdBattle && !isFinalAllGamesBattle
    ? "勝利後条件追加：ハイ＆ローのロボットとエクスチェンジ不可"
    : isPokerSecondBattle
      ? "勝利後条件追加：プレイヤー・ブラックジャックの手札も交換不可"
      : null;
  const nextPokerBattleLabel = isPokerThirdBattle
    ? "ファイナルゲームへ"
    : isPokerSecondBattle
      ? "3戦目へ"
      : "2戦目へ";
  const samePrintTimingLabel = isRiddleExchangeTimingRevealed
    ? "小謎の紙"
    : "対象が同じ紙面上の場合";
  const maxCopyPastes =
    config && "maxCopyPastes" in config ? config.maxCopyPastes : 0;
  const remainingCopyPastes = Math.max(0, maxCopyPastes - copyPasteUseCount);
  const copyPasteTargets = [
    ...(config && "copyPasteTargets" in config ? [...config.copyPasteTargets] : []),
    ...Object.values(selectedBlueTexts),
  ];
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
  const isFinalBlackjackExchange = isFinalAllGamesBattle && pastedBlueTexts["exchange-start-timing"] === "ブラックジャック";
  // Preparation previews the reservation; declaration-covered cards stay visually unchanged until poker.
  const visibleExchangePairs = shouldShowReservedExchange({
    deferred: isFinalBlackjackExchange,
    preparation: showPreparation,
    triggered: hasFinalExchangeTriggered,
    game: activePokerGame,
  }) ? confirmedPokerExchangePairs : [];
  const playerHandIds =
    config && isExchangeApplied
      ? applyExchangePairs([...config.initialPlayerHandIds], visibleExchangePairs)
      : config
        ? [...config.initialPlayerHandIds]
        : hand.map((card) => card.id);
  const blackjackRobotHandIds =
    config && isPokerThirdBattle && isCopyPasteApplied &&
      pastedBlueTexts["paste-blackjack-ace"] === "0"
      ? [...config.blackjackRobotHandIds].map((cardId) =>
          cardId === "A-spade" ? "scan-0" : cardId,
        )
      : config && isExchangeApplied
      ? applyExchangePairs([...config.blackjackRobotHandIds], visibleExchangePairs)
      : config
        ? [...config.blackjackRobotHandIds]
        : [];
  const playerHand = getCardsById(playerHandIds, generatedScanCards);
  const robotHand = getCardsById(
    config
      ? applyExchangePairs([...config.initialRobotHandIds], visibleExchangePairs)
      : robotId === "poker-3-2"
        ? ["K-crub", "Q-heart"]
        : ["Q-crub", "J-heart"],
    generatedScanCards,
  );
  const fieldCards = getCardsById(
    config
      ? applyExchangePairs([...config.fieldCardIds], visibleExchangePairs)
      : ["A-spade", "K-heart", "Q-daia", "J-crub", "A-daia"],
    generatedScanCards,
  );
  const highLowRobotHand = config
    ? getCardsById(applyExchangePairs([...config.highLowRobotHandIds], visibleExchangePairs), generatedScanCards)
    : [];
  const blackjackRobotHand = getCardsById(blackjackRobotHandIds, generatedScanCards);
  const orderedPokerBlackjackRobotHand = [...blackjackRobotHand].sort((a, b) => getBlackjackOrderValue(b.rank, pastedBlueTexts["blackjack-ace-value"] === "0") - getBlackjackOrderValue(a.rank, pastedBlueTexts["blackjack-ace-value"] === "0"));
  const scannedPokerCards = getCardsById(scannedPokerCardIds.filter((id) => !consumedPokerScanCardIds.includes(id)), generatedScanCards);
  const pokerGuaranteedWinOpening = getGuaranteedWinOpening(playerHand.map(getHighLowCardValue), highLowRobotHand.map(getHighLowCardValue));
  const pokerHighLowRobotZone: HighLowZoneName = pokerGuaranteedWinOpening !== null ? "LOW" : "HIGH";
  const pokerHighLowRobotPlacedCard =
    activePokerGame === "high-low" ? highLowRobotHand[pokerGuaranteedWinOpening ?? 0] ?? null : null;
  const pokerHighLowPlayerPlacedCard =
    playerHand.find((card) => card.id === pokerHighLowPlayerCardId) ?? null;
  const pokerHighLowVisiblePlayerHand =
    activePokerGame === "high-low" && pokerHighLowPlayerPlacedCard
      ? playerHand.filter((card) => card.id !== pokerHighLowPlayerPlacedCard.id)
      : playerHand;
  const pokerHighLowVisibleRobotHand =
    activePokerGame === "high-low" && pokerHighLowRobotPlacedCard
      ? highLowRobotHand.filter(
          (card) => card.id !== pokerHighLowRobotPlacedCard.id,
        )
      : highLowRobotHand;
  const pokerHighLowDraggableCardIds =
    activePokerGame === "high-low" && !pokerHighLowPlayerZone
      ? playerHand.map((card) => card.id)
      : [];
  const pokerHighLowDraggingCard =
    playerHand.find((card) => card.id === pokerHighLowDraggingCardId) ?? null;
  const pokerHighLowHighCard =
    pokerHighLowRobotZone === "HIGH"
      ? pokerHighLowRobotPlacedCard
      : pokerHighLowPlayerZone === "HIGH"
        ? pokerHighLowPlayerPlacedCard
        : null;
  const pokerHighLowLowCard =
    pokerHighLowRobotZone === "LOW"
      ? pokerHighLowRobotPlacedCard
      : pokerHighLowPlayerZone === "LOW"
        ? pokerHighLowPlayerPlacedCard
        : null;
  const pokerHighLowResult =
    isFinalAllGamesBattle && settledFinalHighLowResult !== null ? settledFinalHighLowResult : pokerHighLowPlacementConfirmed &&
    pokerHighLowHighCard &&
    pokerHighLowLowCard
      ? getHighLowResult(pokerHighLowHighCard, pokerHighLowLowCard)
      : null;
  const pokerBlackjackStarted =
    activePokerGame === "blackjack" && pokerBlackjackPhase !== "idle";
  const pokerBlackjackFirstCardPlaced =
    pokerBlackjackPhase === "first-card" ||
    pokerBlackjackPhase === "second-card" ||
    pokerBlackjackPhase === "result";
  const pokerBlackjackSecondCardPlaced =
    pokerBlackjackPhase === "second-card" ||
    pokerBlackjackPhase === "result";
  const pokerBlackjackFirstPlacedCard =
    playerHand.find((card) => card.id === pokerBlackjackPlacedCardIds[0]) ??
    null;
  const pokerBlackjackSecondPlacedCard =
    playerHand.find((card) => card.id === pokerBlackjackPlacedCardIds[1]) ??
    null;
  const pokerBlackjackRobotFieldCards =
    orderedPokerBlackjackRobotHand[0] && pokerBlackjackFirstCardPlaced
      ? [
          orderedPokerBlackjackRobotHand[0],
          ...(pokerBlackjackSecondCardPlaced &&
          !pokerBlackjackSecondPlacementPending &&
          orderedPokerBlackjackRobotHand[1]
            ? [orderedPokerBlackjackRobotHand[1]]
            : []),
        ]
      : [];
  const pokerBlackjackPlayerFieldCards =
    pokerBlackjackFirstPlacedCard && pokerBlackjackFirstCardPlaced
      ? [
          pokerBlackjackFirstPlacedCard,
          ...(pokerBlackjackSecondCardPlaced && pokerBlackjackSecondPlacedCard
            ? [pokerBlackjackSecondPlacedCard]
            : []),
        ]
      : [];
  const pokerBlackjackPlayerValueCards =
    pokerBlackjackPlayerFieldCards.length > 0
      ? pokerBlackjackSecondPlacementPending
        ? pokerBlackjackPlayerFieldCards.slice(0, 1)
        : pokerBlackjackPlayerFieldCards
      : [];
  const pokerBlackjackPlayerFieldValue =
    pokerBlackjackPlayerValueCards.length > 0
      ? getBlackjackScore(pokerBlackjackPlayerValueCards, pastedBlueTexts["blackjack-ace-value"] === "0" ? 0 : 11)
      : null;
  const pokerBlackjackRobotFieldValue =
    pokerBlackjackRobotFieldCards.length > 0
      ? getBlackjackScore(pokerBlackjackRobotFieldCards, pastedBlueTexts["blackjack-ace-value"] === "0" ? 0 : 11)
      : null;
  const pokerBlackjackVisiblePlayerHand = pokerBlackjackStarted
    ? playerHand.filter(
        (card) => !pokerBlackjackPlacedCardIds.includes(card.id),
      )
    : playerHand;
  const pokerBlackjackVisibleRobotHand = pokerBlackjackFirstCardPlaced
    ? orderedPokerBlackjackRobotHand.slice(
        pokerBlackjackSecondCardPlaced &&
          !pokerBlackjackSecondPlacementPending
          ? 2
          : 1,
      )
    : orderedPokerBlackjackRobotHand;
  const pokerBlackjackDraggableCardIds =
    pokerBlackjackFirstPlacementPending ? [] : pokerBlackjackStarted && pokerBlackjackPhase === "opening-card"
      ? playerHand.map((card) => card.id)
      : pokerBlackjackStarted && pokerBlackjackPhase === "first-card"
        ? playerHand
            .filter(
              (card) => !pokerBlackjackPlacedCardIds.includes(card.id),
            )
            .map((card) => card.id)
      : [];
  const pokerBlackjackDraggingCard =
    playerHand.find((card) => card.id === pokerBlackjackDraggingCardId) ?? null;
  const pokerBlackjackResult =
    pokerBlackjackPhase === "result"
      ? settledFinalBlackjackResult ?? getBlackjackResult(playerHand, blackjackRobotHand, pastedBlueTexts["blackjack-ace-value"] === "0" ? 0 : 11)
      : null;
  const pokerPlayerHasBlackjack = getBlackjackScore(playerHand, pastedBlueTexts["blackjack-ace-value"] === "0" ? 0 : 11) === 21;
  const playerHandCardIds = playerHand.map((card) => card.id);
  const selectedFieldCards = selectedCardIds
    .map((cardId) => fieldCards.find((card) => card.id === cardId))
    .filter((card): card is PlayingCard => Boolean(card));
  const selectedPokerHand = [...playerHand, ...selectedFieldCards];
  const isPokerHandReady = selectedCardIds.length === 2;
  const playerPokerEvaluation = isPokerHandReady
    ? evaluatePokerHand(selectedPokerHand)
    : null;
  const robotPokerSelection = getBestPokerSelection(robotHand, fieldCards);
  const [pokerResultOverlayDismissed, setPokerResultOverlayDismissed] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:pokerResultOverlayDismissed`, false);
  const [showPokerZeroBetDialog, setShowPokerZeroBetDialog] = useSessionState(`stage-${robotId === "all-games-last" ? 4 : 3}:PokerBattle:${robotId}:showPokerZeroBetDialog`, false);
  const pokerOutcome =
    playerPokerEvaluation && robotPokerSelection
      ? comparePokerHands(playerPokerEvaluation, robotPokerSelection.evaluation)
      : 0;
  const pokerResult =
    activePokerGame === "result"
      ? pokerOutcome > 0
        ? "win"
        : pokerOutcome === 0
          ? "draw"
          : "lose"
      : null;
  const finalRobotChips = pokerResult === "win" ? 100 - finalRobotBet : 100;
  const finalGameCleared = isFinalGameClear({ highLow: pokerHighLowResult, blackjack: pokerBlackjackResult, poker: pokerResult, robotChips: finalRobotChips });
  const isPokerGameStarted = activePokerGame !== "ready";
  const pokerBattleLost =
    (activePokerGame === "high-low" && pokerHighLowResult !== null && pokerHighLowResult !== "win") ||
    (activePokerGame === "blackjack" && pokerBlackjackResult !== null && pokerBlackjackResult !== "win") ||
    (activePokerGame === "result" && pokerResult !== "win") ||
    activePokerGame === "lose";
  const isPokerSelectionActive = activePokerGame === "poker";
  const showPokerSelectedHand =
    activePokerGame === "poker" || activePokerGame === "result";
  const showHighLowSection =
    !isPokerGameStarted || activePokerGame === "high-low";
  const showBlackjackSection =
    !isPokerGameStarted || activePokerGame === "blackjack";
  const showPokerSection =
    !isPokerGameStarted ||
    activePokerGame === "poker" ||
    activePokerGame === "result";
  const isInstantPokerLoseExchangeSelected =
    isExchangeApplied &&
    [...robotHand, ...fieldCards].some((card) =>
      confirmedPokerExchangeCardIds.includes(card.id),
    );
  const exchangeSections: ExchangeCardSection[] = isPokerSecondBattle
    ? [
        {
          cards: playerHand,
          id: "player-hand",
          label: "プレイヤーの手札",
        },
        ...(highLowRobotHand.length > 0
          ? [
              {
                cards: highLowRobotHand,
                disabled: true,
                id: "high-low-robot-hand",
                label: "ハイ＆ローのロボット手札",
              },
            ]
          : []),
        {
          cards: blackjackRobotHand,
          id: "blackjack-robot-hand",
          label: "ブラックジャックのロボット手札",
        },
        {
          cards: robotHand,
          id: "poker-robot-hand",
          label: "ポーカーロボットの手札",
        },
        {
          cards: scannedPokerCards,
          id: "scan-generated",
          label: "スキャン生成カード",
        },
      ]
    : [
        {
          cards: playerHand,
          disabled: isPokerThirdBattle,
          id: "player-hand",
          label: "プレイヤーの手札",
        },
        ...(highLowRobotHand.length > 0
          ? [
              {
                cards: highLowRobotHand,
                disabled: isPokerThirdBattle,
                id: "high-low-robot-hand",
                label: "ハイ＆ローのロボット手札",
              },
            ]
          : []),
        ...(blackjackRobotHand.length > 0
          ? [
              {
                cards: blackjackRobotHand,
                disabled: isPokerThirdBattle,
                id: "blackjack-robot-hand",
                label: "ブラックジャックのロボット手札",
              },
            ]
          : []),
        {
          cards: robotHand,
          id: "poker-robot-hand",
          label: "ポーカーロボットの手札",
        },
        {
          cards: fieldCards,
          id: "field",
          label: "フィールド",
        },
      ];

  function startFinalPhysicalScan(cardIds: string[]) {
    const cards = scannedPokerCards.filter((card) => cardIds.includes(card.id));
    const reading = getFinalPhysicalScanReading(cards.map((card) => card.rank), pastedBlueTexts["scan-poker"], pastedBlueTexts["scan-role-name"]);
    if (!isFinalAllGamesBattle || !reading || remainingScans === 0) {
      setPokerScanMessage("上手くいかないようだ...");
      return;
    }
    setFinalPhysicalScanIds(cardIds);
    setFinalPhysicalScanReading(reading);
    setFinalPhysicalScanSplitIndexes([]);
    setPokerScanMessage("");
  }

  function runFinalPhysicalScan() {
    const cards = scannedPokerCards.filter((card) => finalPhysicalScanIds.includes(card.id));
    const reading = getFinalPhysicalScanReading(cards.map((card) => card.rank), pastedBlueTexts["scan-poker"], pastedBlueTexts["scan-role-name"]);
    const cardId = resolveFinalPhysicalScanSplit(normalizeScanIllustrationName(finalPhysicalScanReading));
    if (!isFinalAllGamesBattle || !reading || !cardId || remainingScans === 0 || scannedPokerCardIds.includes(cardId)) {
      setPokerScanMessage("上手くいかないようだ...");
      return;
    }
    setConsumedPokerScanCardIds((current) => [...new Set([...current, ...finalPhysicalScanIds])]);
    setScannedPokerCardIds((current) => [...current, cardId]);
    setFinalPhysicalScanIds([]);
    setFinalPhysicalScanReading("");
    setPokerScanPreviewSrc(null);
    setPokerScanMessage("現物スキャン成功。2 + 11 = 13でKのカードを生成しました。使用したAとJは消費されます。");
  }

  function resolvePokerScan() {
    const answer = normalizeRiddleAnswer(pokerScanAnswer);
    const illustration = normalizeScanIllustrationName(pokerScanIllustration);
    const requirement = scanRequirements.find(
      (item) =>
        normalizeRiddleAnswer(item.answer) === answer &&
        normalizeScanIllustrationName(item.illustration) === illustration,
    );

    if (!requirement) {
      setPokerScanPreviewSrc(null);
      setPokerScanMessage("上手くいかないようだ...");
      return;
    }

    if (isFinalAllGamesBattle && requirement.riddleSrc === "/riddles/riddle_4.png" &&
        pastedBlueTexts["riddle-four-game"] !== "ハイ＆ロー") {
      setPokerScanPreviewSrc(null);
      setPokerScanMessage("上手くいかないようだ...");
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
    setPokerScanSplitIndexes([]);
    setPokerScanMessage(
      `${generatedScanCards[requirement.cardId].rank}のカードを生成しました。エクスチェンジの候補に追加されます。`,
    );
  }

  function toggleSelectedCard(cardId: string) {
    if (!fieldCards.some((card) => card.id === cardId)) {
      return;
    }

    setSelectedCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      return [...current, cardId].slice(-2);
    });
  }


  function toggleExchangeCard(cardId: string) {
    if (remainingExchanges === 0 || targetSelectionAbility !== "exchange" || confirmedPokerExchangeCardIds.includes(cardId)) {
      return;
    }

    setExchangeCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      return [...current, cardId].slice(-maxExchangeCardSelections);
    });
  }

  function handleCopyPasteTargetSelect(targetId: string) {
    if (targetSelectionAbility !== "copy-paste") return;
    setCopyPasteError("");
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
  }

  function executeCopyPaste() {
    if (!isCopyPasteRiddleSolved) return;
    if (!copiedTarget || !pasteTarget || copiedTarget.id === pasteTarget.id ||
        (isCopyPasteApplied && !isFinalAllGamesBattle) || copyPasteUseCount >= maxCopyPastes) return;
    const text = resolvePaste(copiedTarget, pasteTarget.id, copyPasteFormat);
    if (text === null) {
      setCopyPasteSuccessMessage("");
      setCopyPasteError("文章の意味が通らないため、ペーストできません。");
      return;
    }
    setCopyPasteError("");
    setCopyPasteSuccessMessage(`ペースト実行しました。${pasteTarget.label} を「${text}」に上書きしました。`);
    setPastedBlueTexts((current) => ({ ...current, [pasteTarget.id]: text }));
    setTargetSelectionAbility(null);
    setIsCopyPasteApplied(true);
    setCopyPasteUseCount((count) => count + 1);
  }

  function startPokerSequence() {
    setHasFinalExchangeTriggered(false);
    setSettledFinalHighLowResult(null);
    setSettledFinalBlackjackResult(null);
    if (isFinalAllGamesBattle && config) {
      const deferredExchange = pastedBlueTexts["exchange-start-timing"] === "ブラックジャック";
      const bettingRobotHand = deferredExchange ? getCardsById([...config.initialRobotHandIds], generatedScanCards) : robotHand;
      const bettingField = deferredExchange ? getCardsById([...config.fieldCardIds], generatedScanCards) : fieldCards;
      setFinalRobotBet(Math.floor(100 * getPokerRobotWinRate(bettingRobotHand, bettingField)));
    }
    setPokerResultOverlayDismissed(false);
    setShowPreparation(false);
    resetPokerHighLowPlacement();
    resetPokerBlackjackPlacement();
    if (isInstantPokerLoseExchangeSelected) {
      setActivePokerGame("lose");
      setShowPokerRobotPunchDialog(true);
      return;
    }

    if (highLowRobotHand.length > 0) {
      setActivePokerGame("high-low");
      return;
    }

    setActivePokerGame("blackjack");
    startPokerBlackjack();
  }

  function advancePokerSequence() {
    if (activePokerGame === "high-low" && pokerHighLowResult === "win") {
      if (isFinalAllGamesBattle) setSettledFinalHighLowResult(pokerHighLowResult);
      if (blackjackRobotHand.length > 0) {
        setActivePokerGame("blackjack");
        startPokerBlackjack();
        return;
      }

      setActivePokerGame("poker");
      return;
    }

    if (activePokerGame === "blackjack" && pokerBlackjackResult === "win") {
      setActivePokerGame("poker");
      return;
    }

    if (activePokerGame === "poker" && isPokerHandReady) {
      setPokerResultOverlayDismissed(false);
      setActivePokerGame("result");
    }
  }

  function placePokerHighLowCard(
    zone: HighLowZoneName,
    cardId = playerHand[0]?.id,
  ) {
    if (
      activePokerGame !== "high-low" ||
      zone === pokerHighLowRobotZone ||
      pokerHighLowPlayerZone ||
      pokerHighLowPlacementPending ||
      pokerHighLowPlacementConfirmed
    ) {
      return;
    }

    setPokerHighLowDragPreviewPoint(null);
    setPokerHighLowPlayerZone(zone);
    setPokerHighLowPlayerCardId(cardId ?? null);
    setPokerHighLowPlacementAnimation({
      mode: "hold",
      styleType: "gentle",
      zone,
    });
    setPokerHighLowPlacementPending(true);
    setPokerHighLowPlacementConfirmed(false);
  }

  function confirmPokerHighLowPlacement() {
    if (!pokerHighLowPlacementAnimation) {
      return;
    }

    const zone = pokerHighLowPlacementAnimation.zone;
    setPokerHighLowPlacementPending(false);
    setPokerHighLowPlacementAnimation({
      mode: "release",
      styleType: "gentle",
      zone,
    });
    window.setTimeout(() => {
      setPokerHighLowPlacementAnimation((current) =>
        current?.zone === zone ? null : current,
      );
      setShowPokerHighLowDeclaration(true);
      window.setTimeout(() => {
        setShowPokerHighLowDeclaration(false);
        setPokerHighLowPlacementConfirmed(true);
      }, 1000);
    }, 760);
  }

  function resetPokerHighLowPlacement() {
    setShowPokerHighLowDeclaration(false);
    setPokerHighLowPlayerZone(null);
    setPokerHighLowPlayerCardId(null);
    setPokerHighLowPlacementAnimation(null);
    setPokerHighLowPlacementPending(false);
    setPokerHighLowPlacementConfirmed(false);
    setPokerHighLowDraggingCardId(null);
    setPokerHighLowDragPreviewPoint(null);
  }

  function dropPokerHighLowCard(zone: HighLowZoneName) {
    if (
      !pokerHighLowDraggingCardId ||
      !pokerHighLowDraggableCardIds.includes(pokerHighLowDraggingCardId)
    ) {
      return;
    }

    placePokerHighLowCard(zone, pokerHighLowDraggingCardId);
    setPokerHighLowDraggingCardId(null);
    setPokerHighLowDragPreviewPoint(null);
  }

  function startPokerHighLowDraggingCard(
    cardId: string,
    point: { x: number; y: number } | null,
  ) {
    setPokerHighLowDraggingCardId(cardId);
    setPokerHighLowDragPreviewPoint(point);
  }

  function movePokerHighLowDraggingCard(
    point: { x: number; y: number } | null,
  ) {
    if (!point) {
      return;
    }

    setPokerHighLowDragPreviewPoint(point);
  }

  function endPokerHighLowDraggingCard() {
    setPokerHighLowDraggingCardId(null);
    setPokerHighLowDragPreviewPoint(null);
  }

  function startPokerBlackjack() {
    setPokerBlackjackFirstPlacementPending(false);
    setPokerBlackjackPhase("opening-card");
    setPokerBlackjackPlacedCardIds([]);
    setPokerBlackjackSecondPlacementPending(false);
    setPokerBlackjackPlacementAnimation(null);
    setPokerBlackjackPlacementAnimationMode("release");
    setPokerBlackjackDraggingCardId(null);
    setPokerBlackjackDragPreviewPoint(null);
    setShowPokerBlackjackDeclaration(false);
  }

  function placePokerBlackjackSecondCard() {
    setPokerBlackjackDraggingCardId(null);
    setPokerBlackjackDragPreviewPoint(null);
    setPokerBlackjackPhase("second-card");
    setPokerBlackjackSecondPlacementPending(true);
    setPokerBlackjackPlacementAnimation("gentle");
    setPokerBlackjackPlacementAnimationMode("hold");
  }

  function confirmPokerBlackjackSecondPlacement() {
    setPokerBlackjackPlacementAnimation("gentle");

    if (pokerPlayerHasBlackjack || pastedBlueTexts["blackjack-declaration"]) {
      setPokerBlackjackPlacementAnimationMode("hold");
      setShowPokerBlackjackDeclaration(true);
      if (isFinalBlackjackExchange && (pastedBlueTexts["blackjack-declaration"] ?? "ブラックジャック") === "ブラックジャック") {
        setSettledFinalBlackjackResult(getBlackjackResult(playerHand, blackjackRobotHand, pastedBlueTexts["blackjack-ace-value"] === "0" ? 0 : 11));
        window.setTimeout(() => setHasFinalExchangeTriggered(true), 500);
      }
      window.setTimeout(() => {
        setShowPokerBlackjackDeclaration(false);
        setPokerBlackjackSecondPlacementPending(false);
        setPokerBlackjackPlacementAnimationMode("release");
      }, 1000);
      window.setTimeout(() => {
        setPokerBlackjackPlacementAnimation(null);
        setPokerBlackjackPhase("result");
      }, 1760);
      return;
    }

    setPokerBlackjackSecondPlacementPending(false);
    setPokerBlackjackPlacementAnimationMode("release");
    window.setTimeout(() => {
      setPokerBlackjackPlacementAnimation(null);
      setPokerBlackjackPhase("result");
    }, 760);
  }

  function resetPokerBlackjackSecondPlacement() {
    setPokerBlackjackSecondPlacementPending(false);
    setPokerBlackjackDraggingCardId(null);
    setPokerBlackjackDragPreviewPoint(null);
    setPokerBlackjackPlacedCardIds((current) => current.slice(0, 1));
    setPokerBlackjackPlacementAnimation(null);
    setPokerBlackjackPlacementAnimationMode("release");
    setShowPokerBlackjackDeclaration(false);
    setPokerBlackjackPhase("first-card");
  }

  function resetPokerBlackjackPlacement() {
    setPokerBlackjackFirstPlacementPending(false);
    setPokerBlackjackPhase("idle");
    setPokerBlackjackPlacedCardIds([]);
    setPokerBlackjackSecondPlacementPending(false);
    setPokerBlackjackPlacementAnimation(null);
    setPokerBlackjackPlacementAnimationMode("release");
    setPokerBlackjackDraggingCardId(null);
    setPokerBlackjackDragPreviewPoint(null);
    setShowPokerBlackjackDeclaration(false);
  }

  function dropPokerBlackjackPlayerCard(
    droppedCardId = pokerBlackjackDraggingCardId,
  ) {
    if (activePokerGame !== "blackjack" || !droppedCardId) {
      return;
    }

    if (
      pokerBlackjackPhase === "opening-card" &&
      playerHand.some((card) => card.id === droppedCardId)
    ) {
      setPokerBlackjackPlacedCardIds([droppedCardId]);
      setPokerBlackjackDraggingCardId(null);
      setPokerBlackjackDragPreviewPoint(null);
      setPokerBlackjackPhase("first-card");
      setPokerBlackjackPlacementAnimation("gentle");
      setPokerBlackjackPlacementAnimationMode("hold");
      setPokerBlackjackFirstPlacementPending(true);
      return;
    }

    if (
      pokerBlackjackPhase === "first-card" &&
      !pokerBlackjackFirstPlacementPending &&
      playerHand.some((card) => card.id === droppedCardId) &&
      !pokerBlackjackPlacedCardIds.includes(droppedCardId)
    ) {
      setPokerBlackjackPlacedCardIds((current) =>
        [...current, droppedCardId].slice(0, 2),
      );
      placePokerBlackjackSecondCard();
    }
  }

  function confirmPokerBlackjackFirstPlacement() {
    const card = playerHand.find((item) => item.id === pokerBlackjackPlacedCardIds[0]);
    if (!card || !isLargestBlackjackCard(card.rank, playerHand.map((item) => item.rank), pastedBlueTexts["blackjack-ace-value"] === "0")) {
      setPokerBlackjackOrderError(true);
      return;
    }
    setPokerBlackjackFirstPlacementPending(false);
    setPokerBlackjackPlacementAnimationMode("release");
    window.setTimeout(() => setPokerBlackjackPlacementAnimation(null), 760);
  }

  function resetPokerBlackjackFirstPlacement() {
    setPokerBlackjackFirstPlacementPending(false);
    setPokerBlackjackPlacedCardIds([]);
    setPokerBlackjackPhase("opening-card");
    setPokerBlackjackPlacementAnimation(null);
  }

  function startPokerBlackjackDraggingCard(
    cardId: string,
    point: { x: number; y: number } | null,
  ) {
    setPokerBlackjackDraggingCardId(cardId);
    setPokerBlackjackDragPreviewPoint(point);
  }

  function movePokerBlackjackDraggingCard(
    point: { x: number; y: number } | null,
  ) {
    if (!point) {
      return;
    }

    setPokerBlackjackDragPreviewPoint(point);
  }

  function endPokerBlackjackDraggingCard() {
    setPokerBlackjackDraggingCardId(null);
    setPokerBlackjackDragPreviewPoint(null);
  }

  function togglePokerExchangeMode() {
    if (remainingExchanges === 0) {
      return;
    }

    setTargetSelectionAbility((current) =>
      current === "exchange" ? null : "exchange",
    );
  }

  function confirmPokerExchangeSelection() {
    if (exchangeCardIds.length !== 2 || remainingExchanges === 0 || exchangeCardIds.some((id) => confirmedPokerExchangeCardIds.includes(id))) {
      return;
    }

    setConfirmedPokerExchangePairs((current) => [...current, { firstCardId: exchangeCardIds[0], secondCardId: exchangeCardIds[1] }]);
    setExchangeCardIds([]);
    setIsExchangeApplied(true);
    setTargetSelectionAbility(null);
  }

  function resetPokerExchangeSelection({
    reactivateExchangeMode = false,
  }: {
    reactivateExchangeMode?: boolean;
  } = {}) {
    setIsExchangeApplied(false);
    setHasFinalExchangeTriggered(false);
    setSettledFinalHighLowResult(null);
    setSettledFinalBlackjackResult(null);
    setConfirmedPokerExchangePairs([]);
    setExchangeCardIds([]);
    setTargetSelectionAbility(reactivateExchangeMode ? "exchange" : null);
  }

  function resetPokerInstantLose() {
    setPokerResultOverlayDismissed(false);
    setSelectedCardIds([]);
    resetPokerExchangeSelection();
    setActivePokerGame("ready");
    setShowPreparation(false);
    setShowPokerRobotPunchDialog(false);
    resetPokerHighLowPlacement();
    resetPokerBlackjackPlacement();
  }

  return (
    <BlueTextSelectionContext.Provider value={{
      active: (isPokerThirdBattle || isFinalAllGamesBattle) && targetSelectionAbility === "copy-paste",
      selectedId: copiedTargetId,
      replacements: pastedBlueTexts,
      allowRiddleCopy: isFinalAllGamesBattle,
      onSelect: (id, text) => {
        setSelectedBlueTexts((current) => ({ ...current, [id]: { id, label: text, text } }));
        handleCopyPasteTargetSelect(id);
      },
    }}>
    <div
      className={`relative min-h-[620px] bg-[#071b12] text-white ${
        targetSelectionAbility === "copy-paste"
            ? "ring-4 ring-inset ring-casinoRed"
            : ""
      }`}
    >
      {(pokerResult === "win" || pokerBattleLost) && !showPokerRobotPunchDialog && !pokerResultOverlayDismissed ? (
        <BattleResultOverlay
          result={pokerBattleLost ? "lose" : "win"}
          onDismiss={() => {
            setPokerResultOverlayDismissed(true);
            if (isPokerThirdBattle && pokerResult === "win") {
              setShowPokerZeroBetDialog(true);
            }
          }}
        />
      ) : null}
      {expandedPokerRiddle ? (
        <RiddleImageModal alt={expandedPokerRiddle.alt} src={expandedPokerRiddle.src} onClose={() => setExpandedPokerRiddle(null)} />
      ) : null}
      {showPokerScanRiddlesDialog ? (
        <TutorialDialog
          onDismiss={() => setShowPokerScanRiddlesDialog(false)}
          text={'スキャンで使える小謎を追加で渡そう。エクスチェンジ無しで"A"と"もう一枚"スキャンで生成すると良い'}
          tone="hands"
        />
      ) : null}
      {showSituationReviewHint ? (
        <TutorialDialog
          onDismiss={() => setShowSituationReviewHint(false)}
          text="まずは状況整理した方が良さそうだな"
          tone="quick"
        />
      ) : null}
      {showCopyPasteUnlockDialog ? (
        <TutorialDialog
          onDismiss={() => setShowCopyPasteUnlockDialog(false)}
          text={<>最後の機能「コピーペースト機能」を開示<br />小謎の紙も追加する</>}
          tone="hands"
        />
      ) : null}
      {showCopyPasteHint ? (
        <TutorialDialog
          onDismiss={() => setShowCopyPasteHint(false)}
          text="1枚もエクスチェンジできない状況で、ルールを変えることで勝ちにできないだろうか..."
          tone="hands"
        />
      ) : null}
      {showPokerZeroBetDialog ? (
        <PlayerCutInDialog
          onDismiss={() => setShowPokerZeroBetDialog(false)}
          text="なぜ賭けたチップが0なんだ...。ロボットの手札とフィールドから算出される勝率は8.9%だったはず...。"
        />
      ) : null}
      {showPokerHighLowDeclaration ? (
        <BlackjackDeclarationOverlay text={pastedBlueTexts["high-low-declaration"] ?? "ハイ＆ロー"} />
      ) : null}
      {showPokerRiddleHint ? (
        <TutorialDialog
          onDismiss={() => setShowPokerRiddleHint(false)}
          text="ポーカーの役一覧を見ると、④で1(ワン)は生成できそうだな"
          tone="hands"
        />
      ) : null}
      {showPokerRobotPunchDialog ? (
        <TutorialDialog
          onDismiss={() => setShowPokerRobotPunchDialog(false)}
          text="ポーカーロボットに殴られ、意識を失った"
          tone="hands"
        />
      ) : null}
      {pokerHighLowDraggingCard && pokerHighLowDragPreviewPoint ? (
        <DraggingCardPreview
          card={pokerHighLowDraggingCard}
          point={pokerHighLowDragPreviewPoint}
        />
      ) : null}
      {pokerBlackjackDraggingCard && pokerBlackjackDragPreviewPoint ? (
        <DraggingCardPreview
          card={pokerBlackjackDraggingCard}
          point={pokerBlackjackDragPreviewPoint}
        />
      ) : null}
      {targetSelectionAbility === "exchange" ? (
        <div className="pointer-events-none fixed inset-0 z-[60] border-[10px] border-red-500/80 shadow-[inset_0_0_42px_rgba(239,68,68,0.75)]" />
      ) : null}
      {targetSelectionAbility === "copy-paste" ? (
        <div
          className="fixed inset-x-3 top-3 z-50 rounded border border-red-200 bg-red-950 px-4 py-3 text-sm font-black text-red-50 shadow-2xl"
          aria-live="polite"
        >
          <p>{copyPasteStep === "source"
            ? "コピー元の青字を押してください。"
            : "上書き先の青字を押してください。"}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <p className={`min-w-0 rounded border px-2 py-1 break-words ${copyPasteStep === "source" ? "border-yellow-200 bg-yellow-200/15 motion-safe:animate-pulse" : "border-white/20"}`}>
              コピー元：{copiedTarget?.text ?? "未選択"}
              {copyPasteStep === "source" ? <span className="ml-2 text-yellow-200">選択中</span> : null}
            </p>
            <p className={`min-w-0 rounded border px-2 py-1 break-words ${copyPasteStep === "target" ? "border-yellow-200 bg-yellow-200/15 motion-safe:animate-pulse" : "border-white/20"}`}>
              コピー先：{pasteTarget?.text ?? "未選択"}
              {copyPasteStep === "target" ? <span className="ml-2 text-yellow-200">選択中</span> : null}
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/28 p-4">
        <a
          aria-label="ゲーム会場へ"
          title="ゲーム会場へ"
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

      {isFinalAllGamesBattle ? (
        <div hidden={!showSituationReview}>
          <FinalSituationReview onBack={() => {
            setShowSituationReview(false);
            window.scrollTo({ top: 0, behavior: "instant" });
          }} />
        </div>
      ) : null}
      <div
        className={`${showSituationReview ? "hidden" : "grid"} gap-3 p-4 ${
          showPreparation ? "" : "sm:grid-cols-[1fr_220px]"
        }`}
      >
        {!showPreparation && activePokerGame === "ready" ? (
          <div className="grid gap-3 sm:col-span-2">
            <GameStartRow robotId={robotId}>
              <button
                className="min-h-12 rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
                onClick={startPokerSequence}
                type="button"
              >
                ゲームスタート
              </button>
            </GameStartRow>
            <div className="flex justify-end">
              <button
                className="min-h-12 rounded border border-brass bg-black/35 px-4 py-3 text-sm font-black text-brass hover:bg-brass/10"
                onClick={() => {
                  setShowPreparation(true);
                  if (isFinalAllGamesBattle && !hasShownSituationReviewHint.current) {
                    hasShownSituationReviewHint.current = true;
                    setShowSituationReviewHint(true);
                  }
                }}
                type="button"
              >
                車内で準備
              </button>
            </div>
          </div>
        ) : null}
        <section
          className={`rounded border border-white/12 bg-black/28 p-3 ${
            showPreparation ? "hidden" : activePokerGame === "ready" ? "sm:col-span-2" : ""
          }`}
        >
          {activePokerGame === "high-low" ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <HighLowZone
                  canPlace={
                    !pokerHighLowPlacementConfirmed &&
                    pokerHighLowPlayerZone === null
                  }
                  label="HIGH"
                  onDropCard={() => dropPokerHighLowCard("HIGH")}
                  onPlace={() => placePokerHighLowCard("HIGH")}
                  placeDisabled={pokerHighLowRobotZone === "HIGH"}
                  placementAnimation={
                    pokerHighLowPlacementAnimation?.zone === "HIGH"
                      ? pokerHighLowPlacementAnimation
                      : null
                  }
                  playerCard={
                    pokerHighLowPlayerZone === "HIGH"
                      ? pokerHighLowPlayerPlacedCard
                      : null
                  }
                  playerPlaced={pokerHighLowPlayerZone === "HIGH"}
                  robotCard={
                    pokerHighLowRobotZone === "HIGH"
                      ? pokerHighLowRobotPlacedCard
                      : null
                  }
                  robotPlaced={pokerHighLowRobotZone === "HIGH"}
                  spotlight={false}
                  tone="high"
                />
                <HighLowZone
                  canPlace={
                    !pokerHighLowPlacementConfirmed &&
                    pokerHighLowPlayerZone === null
                  }
                  label="LOW"
                  onDropCard={() => dropPokerHighLowCard("LOW")}
                  onPlace={() => placePokerHighLowCard("LOW")}
                  placeDisabled={pokerHighLowRobotZone === "LOW"}
                  placementAnimation={
                    pokerHighLowPlacementAnimation?.zone === "LOW"
                      ? pokerHighLowPlacementAnimation
                      : null
                  }
                  playerCard={
                    pokerHighLowPlayerZone === "LOW"
                      ? pokerHighLowPlayerPlacedCard
                      : null
                  }
                  playerPlaced={pokerHighLowPlayerZone === "LOW"}
                  robotCard={
                    pokerHighLowRobotZone === "LOW"
                      ? pokerHighLowRobotPlacedCard
                      : null
                  }
                  robotPlaced={pokerHighLowRobotZone === "LOW"}
                  spotlight={false}
                  tone="low"
                />
              </div>
              {pokerHighLowPlacementPending ? (
                <div className="grid grid-cols-2 gap-2 rounded border border-brass/45 bg-black/35 p-3">
                  <button
                    className="min-h-11 rounded bg-brass px-4 text-sm font-black text-stone-950 hover:bg-yellow-300"
                    onClick={confirmPokerHighLowPlacement}
                    type="button"
                  >
                    確定
                  </button>
                  <button
                    className="min-h-11 rounded border border-white/15 bg-white/8 px-4 text-sm font-black text-white hover:bg-white/14"
                    onClick={resetPokerHighLowPlacement}
                    type="button"
                  >
                    選び直し
                  </button>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <HandPanel
                  cards={pokerHighLowVisiblePlayerHand}
                  draggableCardIds={pokerHighLowDraggableCardIds}
                  onCardDragEnd={endPokerHighLowDraggingCard}
                  onCardDragMove={movePokerHighLowDraggingCard}
                  onCardDragStart={startPokerHighLowDraggingCard}
                  owner="Player"
                />
                <HandPanel
                  actions={
                    <GameInfoButtons
                      gameType="high-low"
                      onOpenModal={onOpenModal}
                      robot={robot}
                    />
                  }
                  cards={pokerHighLowVisibleRobotHand}
                  owner="Robot"
                />
              </div>
              {pokerHighLowResult ? (
                <div
                  className={`rounded border p-3 text-sm font-bold leading-6 ${
                    pokerHighLowResult === "win"
                      ? "border-emerald-300 bg-emerald-950/55 text-emerald-100"
                      : "border-casinoRed bg-red-950/55 text-red-100"
                  }`}
                >
                  {getHighLowResultText(
                    pokerHighLowHighCard,
                    pokerHighLowLowCard,
                    pokerHighLowResult,
                  )}
                </div>
              ) : (
                <p className="rounded border border-sky-300/35 bg-sky-950/25 p-3 text-sm font-black leading-6 text-sky-100">
                  ロボットが{pokerHighLowRobotZone}にカードを置きました。プレイヤーの手札を{pokerHighLowRobotZone === "HIGH" ? "LOW" : "HIGH"}へ出してください。
                </p>
              )}
            </div>
          ) : activePokerGame === "blackjack" ? (
            <div className="grid gap-3">
              {pokerBlackjackOrderError ? <PlayerCutInDialog text="こちらは数字の小さい方だ。ルール通り大きい方から置こう" onDismiss={() => setPokerBlackjackOrderError(false)} /> : null}
              <BlackjackFieldArea
                canDropPlayerCard={pokerBlackjackDraggableCardIds.length > 0}
                onDropPlayerCard={dropPokerBlackjackPlayerCard}
                placementAnimation={pokerBlackjackPlacementAnimation}
                placementAnimationMode={pokerBlackjackPlacementAnimationMode}
                playerCards={pokerBlackjackPlayerFieldCards}
                playerValue={pokerBlackjackPlayerFieldValue}
                robotCards={pokerBlackjackRobotFieldCards}
                robotValue={pokerBlackjackRobotFieldValue}
              />
              {showPokerBlackjackDeclaration ? (
                <BlackjackDeclarationOverlay text={pastedBlueTexts["blackjack-declaration"]} />
              ) : null}
              {pokerBlackjackFirstPlacementPending || pokerBlackjackSecondPlacementPending ? (
                <div className="grid grid-cols-2 gap-2 rounded border border-brass/45 bg-black/35 p-3">
                  <button
                    className="min-h-11 rounded bg-brass px-4 text-sm font-black text-stone-950 hover:bg-yellow-300"
                    onClick={pokerBlackjackFirstPlacementPending ? confirmPokerBlackjackFirstPlacement : confirmPokerBlackjackSecondPlacement}
                    type="button"
                  >
                    確定
                  </button>
                  <button
                    className="min-h-11 rounded border border-white/15 bg-white/8 px-4 text-sm font-black text-white hover:bg-white/14"
                    onClick={pokerBlackjackFirstPlacementPending ? resetPokerBlackjackFirstPlacement : resetPokerBlackjackSecondPlacement}
                    type="button"
                  >
                    選び直し
                  </button>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <BlackjackField
                  cards={pokerBlackjackVisiblePlayerHand}
                  draggableCardIds={pokerBlackjackDraggableCardIds}
                  isBlackjack={false}
                  label="プレイヤーの手札"
                  onCardDragEnd={endPokerBlackjackDraggingCard}
                  onCardDragMove={movePokerBlackjackDraggingCard}
                  onCardDragStart={startPokerBlackjackDraggingCard}
                  revealSecond
                  score={null}
                />
                <BlackjackField
                  actions={
                    <GameInfoButtons
                      gameType="blackjack"
                      onOpenModal={onOpenModal}
                      robot={robot}
                    />
                  }
                  cards={pokerBlackjackVisibleRobotHand}
                  isBlackjack={false}
                  label="ブラックジャックのロボット手札"
                  revealSecond
                  score={null}
                />
              </div>
              {pokerBlackjackResult ? (
                <div
                  className={`rounded border p-3 text-sm font-bold leading-6 ${
                    pokerBlackjackResult === "win"
                      ? "border-emerald-300 bg-emerald-950/55 text-emerald-100"
                      : "border-casinoRed bg-red-950/55 text-red-100"
                  }`}
                >
                  {pokerBlackjackResult === "win"
                    ? "YOU WIN。ブラックジャックに勝利しました。"
                    : pokerBlackjackResult === "draw"
                      ? "引き分けのため、あなたの負けです。"
                      : "YOU LOSE。ロボットの勝利です。"}
                </div>
              ) : (
                <p className="rounded border border-sky-300/35 bg-sky-950/25 p-3 text-sm font-black leading-6 text-sky-100">
                  プレイヤーの手札をフィールドへ出してください。1枚目のあと、2枚目を重ねて出します。
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {activePokerGame === "ready" && (isExchangeApplied || isFinalAllGamesBattle) ? <GameStartHandNotice /> : null}
              {showPokerSelectedHand ? (
              <PokerSelectableGroup
                disabled
                cards={playerHand}
                label="プレイヤーの手札"
                onToggle={toggleSelectedCard}
                selectedCardIds={showPokerSelectedHand ? playerHandCardIds : []}
              />
              ) : (
                <PokerCardGroup cards={playerHand} label="プレイヤーの手札" notice={isPokerThirdBattle ? "エクスチェンジ不可" : undefined} />
              )}
              {highLowRobotHand.length > 0 && showHighLowSection ? (
                <PokerCardGroup
                  actions={
                    <GameInfoButtons
                      gameType="high-low"
                      onOpenModal={onOpenModal}
                      robot={robot}
                    />
                  }
                  cards={highLowRobotHand}
                  label="ハイ＆ローのロボット手札"
                  notice={isPokerSecondBattle || isPokerThirdBattle ? "エクスチェンジ不可" : undefined}
                />
              ) : null}
              {blackjackRobotHand.length > 0 && showBlackjackSection ? (
                isPokerThirdBattle ? (
                  <PokerCardGroup
                    actions={
                      <GameInfoButtons
                        gameType="blackjack"
                        onOpenModal={onOpenModal}
                        robot={robot}
                      />
                    }
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
                    label="ブラックジャックのロボット手札"
                    notice="エクスチェンジ不可"
                  />
                ) : (
                  <PokerCardGroup
                    actions={
                      <GameInfoButtons
                        gameType="blackjack"
                        onOpenModal={onOpenModal}
                        robot={robot}
                      />
                    }
                    cards={blackjackRobotHand}
                    label="ブラックジャックのロボット手札"
                  />
                )
              ) : null}
              {showPokerSection ? (
                <>
                  {(isPokerThirdBattle || isFinalAllGamesBattle) && showPokerSelectedHand ? (
                    <section className="border-y border-brass/40 py-3">
                      <p className="text-[11px] font-black text-brass">チップの賭け</p>
                      <div className="mt-2 grid grid-cols-2 gap-3 text-sm font-bold leading-7">
                        <div>
                          <h3 className="text-brass">プレイヤー</h3>
                          <p>所持：100chip</p>
                          <p>ベット：100chip（オールイン）</p>
                        </div>
                        <div>
                          <h3 className="text-brass">ポーカーロボット</h3>
                          <p>所持：100chip</p>
                          <p>ベット：{isFinalAllGamesBattle ? finalRobotBet : 0}chip</p>
                          {isFinalAllGamesBattle && pokerResult === "win" ? <p>対戦後：{finalRobotChips}chip</p> : null}
                        </div>
                      </div>
                    </section>
                  ) : null}
                  {showPokerSelectedHand ? (
                    <PokerSelectedHandPanel
                      cards={selectedPokerHand}
                      evaluation={playerPokerEvaluation}
                    />
                  ) : null}
                  {activePokerGame === "result" &&
                  playerPokerEvaluation &&
                  robotPokerSelection ? (
                    <div
                      className={`rounded border p-4 ${
                        pokerResult === "win"
                          ? "border-emerald-300/60 bg-emerald-950/40"
                          : "border-casinoRed/60 bg-red-950/35"
                      }`}
                    >
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                        ポーカー判定
                      </p>
                      <div className="mt-3 grid gap-3">
                        <div className="rounded border border-white/10 bg-black/25 p-3">
                          <p className="text-xs font-black text-stone-300">
                            あなたの4枚
                          </p>
                          <div className="mt-2 flex flex-wrap justify-center gap-2">
                            {selectedPokerHand.map((card) => (
                              <PlayingCardView
                                card={card}
                                key={`player-result-${card.id}`}
                                size="hand"
                              />
                            ))}
                          </div>
                          <p className="mt-2 text-sm font-black text-sky-200">
                            {playerPokerEvaluation.label}
                          </p>
                        </div>
                        <div className="rounded border border-white/10 bg-black/25 p-3">
                          <p className="text-xs font-black text-stone-300">
                            ポーカーロボットの4枚
                          </p>
                          <div className="mt-2 flex flex-wrap justify-center gap-2">
                            {robotPokerSelection.cards.map((card) => (
                              <PlayingCardView
                                card={card}
                                key={`robot-result-${card.id}`}
                                size="hand"
                              />
                            ))}
                          </div>
                          <p className="mt-2 text-sm font-black text-sky-200">
                            {robotPokerSelection.evaluation.label}
                          </p>
                          <p className="mt-2 text-sm font-bold leading-6 text-stone-100">
                            ポーカーロボットは手札の
                            {formatPokerRankList(robotHand)}
                            にフィールドの
                            {formatPokerRankList(robotPokerSelection.fieldCards)}
                            を組み合わせて、
                            {robotPokerSelection.evaluation.label}
                            を作ります。
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <PokerCardGroup
                    actions={
                      <GameInfoButtons
                        gameType="poker"
                        onOpenModal={onOpenModal}
                        robot={robot}
                      />
                    }
                    cards={robotHand}
                    label="ポーカーロボットの手札"
                  />
                  <PokerSelectableGroup
                    cards={fieldCards}
                    disabled={!isPokerSelectionActive}
                    label="フィールド"
                    onToggle={toggleSelectedCard}
                    selectedCardIds={selectedCardIds}
                  />
                </>
              ) : null}
            </div>
          )}

        </section>

        <section className={`${!showPreparation && activePokerGame === "ready" ? "hidden" : "flex"} flex-col gap-3 rounded border border-white/12 bg-black/28 p-3`}>
          <div
            className={`rounded border border-brass/45 bg-brass/10 p-3 ${
              showPreparation ? "" : "hidden"
            }`}
          >
            {showPreparation ? (
              <div className="mb-4 flex flex-wrap items-stretch gap-3">
                <GameTableReturnButton onClick={() => setShowPreparation(false)} />
                {isFinalAllGamesBattle ? (
                  <button
                    className={`min-h-14 flex-1 rounded border-2 border-red-200 bg-casinoRed px-5 py-3 text-lg font-black text-white transition-colors hover:bg-red-600 ${hasOpenedSituationReview ? "" : "ring-4 ring-yellow-300 ring-offset-2 ring-offset-[#071b12] shadow-[0_0_24px_rgba(250,204,21,0.55)]"}`}
                    onClick={() => {
                      setHasOpenedSituationReview(true);
                      setShowSituationReview(true);
                      setShowSituationReviewHint(false);
                      window.scrollTo({ top: 0, behavior: "instant" });
                    }}
                    type="button"
                  >状況整理</button>
                ) : null}
              </div>
            ) : null}
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              事前準備
            </p>
            {isPokerThirdBattle || isFinalAllGamesBattle ? (
              <>
                <AbilityUsageTabs
                  activeAbility={pokerPreparationAbility}
                  counts={{
                    "copy-paste": remainingCopyPastes,
                    exchange: remainingExchanges,
                    scan: remainingScans,
                  }}
                  onSelect={(ability) => {
                    setPokerPreparationAbility(ability);
                    if (ability === "copy-paste" && isPokerThirdBattle && !hasShownCopyPasteHint.current) {
                      hasShownCopyPasteHint.current = true;
                      setShowCopyPasteHint(true);
                    }
                  }}
                />
                {pokerPreparationAbility === "exchange" ? (
                  <>
                  <ExchangeSpecToggle />
                  <ExchangeRuleList samePrintTimingLabel={samePrintTimingLabel} />
                  {isFinalAllGamesBattle ? <ExchangeModeToggleButton className="mt-3" isActive={targetSelectionAbility === "exchange"} isCompleted={remainingExchanges === 0} onClick={togglePokerExchangeMode} /> : null}
                  <div className="my-3"><GameStartHandNotice timing={isFinalAllGamesBattle ? pastedBlueTexts["exchange-start-timing"] ?? "ゲームスタート" : "ゲームスタート"} /></div>
                  <ExchangeCardSectionPicker
                    onToggleCard={toggleExchangeCard}
                    sections={[
                      ...exchangeSections,
                      {
                        cards: scannedPokerCards,
                        id: "scan-generated",
                        label: "スキャン生成カード",
                      },
                    ].map((section) => ({ ...section, disabled: isFinalAllGamesBattle ? false : section.disabled, interactionDisabled: !isFinalAllGamesBattle || targetSelectionAbility !== "exchange" || remainingExchanges === 0 }))}
                    selectedCardIds={isFinalAllGamesBattle ? exchangeCardIds : []}
                    showEmptySections
                  />
                  {isFinalAllGamesBattle ? (
                    <>
                      <button className="mt-3 min-h-11 w-full rounded bg-brass px-3 text-sm font-black text-stone-950 disabled:bg-stone-700 disabled:text-stone-400" disabled={remainingExchanges === 0 || targetSelectionAbility !== "exchange" || exchangeCardIds.length !== maxExchangeCardSelections} onClick={confirmPokerExchangeSelection} type="button">エクスチェンジ決定 ({exchangeCardIds.length}/{maxExchangeCardSelections})</button>
                      {isExchangeApplied ? <ExchangeRedoButton onClick={() => resetPokerExchangeSelection({ reactivateExchangeMode: true })} /> : null}
                    </>
                  ) : null}
                  </>
                ) : null}
                {pokerPreparationAbility === "scan" ? (
                  <>
                  <ScanSpecToggle
                    isVisible={pokerScanSpecVisible}
                    onToggle={() => setPokerScanSpecVisible((current) => !current)}
                  />
                  {(isFinalAllGamesBattle || isPokerThirdBattle) ? (
                    <>
                      <details className="mt-3 rounded border border-white/12 bg-black/25 p-3">
                        <summary className="cursor-pointer text-sm font-black text-brass">小謎の紙</summary>
                        <ScanRiddleImages images={pokerScanRiddles} onOpen={setExpandedPokerRiddle} />
                      </details>
                      <ScanSolvedSummary hasFourthScanResult additionalRows={[
                        { question: "③", answer: "フエ", illustrationName: "れい/ん", generatedNumber: "0", imageSrc: scanTargetImages.rain },
                        { question: "④", answer: "ツーペア", illustrationName: "わん/ぺあ", generatedNumber: "1", imageSrc: scanTargetImages.onepair },
                      ]} />
                      <ScanAnswerPanel
                        answer={pokerScanAnswer} illustration={pokerScanIllustration} splitIndexes={pokerScanSplitIndexes}
                        inventoryCards={scannedPokerCards}
                        onPhysicalScan={isFinalAllGamesBattle ? startFinalPhysicalScan : undefined}
                        onAnswerChange={setPokerScanAnswer}
                        onIllustrationChange={(value) => { setPokerScanIllustration(value); setPokerScanSplitIndexes([]); }}
                        onSplitChange={(indexes, value) => { setPokerScanSplitIndexes(indexes); setPokerScanIllustration(value); }}
                        onSubmit={resolvePokerScan} message={pokerScanMessage} disabled={remainingScans === 0}
                        physicalScanDisabled={remainingScans === 0}
                      >
                        {pokerScanPreviewSrc ? <ScanTargetPreview alt="今回スキャンした対象" src={pokerScanPreviewSrc} /> : null}
                      </ScanAnswerPanel>
                      {isFinalAllGamesBattle && finalPhysicalScanReading ? (
                        <section className="mt-3 rounded border border-sky-300/35 bg-sky-950/20 p-3">
                          <p className="text-sm font-black text-sky-100">ブラックジャック：21（にじゅういち）</p>
                          <div className="my-3 flex justify-center gap-2">
                            {scannedPokerCards.filter((card) => finalPhysicalScanIds.includes(card.id)).map((card) => <PlayingCardView key={card.id} card={card} size="hand" />)}
                          </div>
                          <IllustrationSplitSelector
                            value={finalPhysicalScanReading}
                            selectedIndexes={finalPhysicalScanSplitIndexes}
                            onChange={(indexes, value) => {
                              setFinalPhysicalScanSplitIndexes(indexes);
                              setFinalPhysicalScanReading(value);
                            }}
                          />
                          <button className="mt-3 min-h-11 w-full rounded bg-brass px-3 text-sm font-black text-stone-950 disabled:bg-stone-700" disabled={remainingScans === 0} onClick={runFinalPhysicalScan} type="button">現物スキャン発動</button>
                        </section>
                      ) : null}
                    </>
                  ) : null}
                  </>
                ) : null}
                {pokerPreparationAbility === "copy-paste" ? (
                  <>
                  {!isCopyPasteRiddleSolved ? (
                    <CopyPasteUnlockRiddle
                      isSolved={false}
                      onUnlock={() => setIsCopyPasteRiddleSolved(true)}
                      onOpen={setExpandedPokerRiddle}
                    />
                  ) : null}
                  <CopyPastePreparationPanel
                    copiedTarget={copiedTarget}
                    format={copyPasteFormat}
                    formatLabel={copyPasteFormatLabel[copyPasteFormat]}
                    isApplied={isCopyPasteApplied && (!isFinalAllGamesBattle || copyPasteUseCount >= maxCopyPastes)}
                    maxCopyPastes={remainingCopyPastes}
                    onPaste={executeCopyPaste}
                    error={copyPasteError}
                    successMessage={copyPasteSuccessMessage}
                    appliedText={pasteTarget ? pastedBlueTexts[pasteTarget.id] : undefined}
                    onReset={() => {
                      setPastedBlueTexts({});
                      setCopyPasteError("");
                      setCopyPasteSuccessMessage("");
                      setSelectedBlueTexts({});
                      setCopiedTargetId(null);
                      setPasteTargetId(null);
                      setIsCopyPasteApplied(false);
                      setCopyPasteUseCount(0);
                      setCopyPasteStep("source");
                      setTargetSelectionAbility(null);
                    }}
                    onChooseFormat={setCopyPasteFormat}
                    isSelecting={targetSelectionAbility === "copy-paste"}
                    onStart={() => {
                      const wasSelecting = targetSelectionAbility === "copy-paste";
                      setCopyPasteError("");
                      setCopyPasteSuccessMessage("");
                      setCopyPasteStep("source");
                      setCopiedTargetId(null);
                      setPasteTargetId(null);
                      setIsCopyPasteApplied(false);
                      setTargetSelectionAbility(wasSelecting ? null : "copy-paste");
                    }}
                    pasteTarget={pasteTarget}
                  />
                  <CopyPasteGameSpecifications
                    onOpenGuideImage={setExpandedPokerRiddle}
                  />
                  </>
                ) : null}
              </>
            ) : (
              <>
                <AbilityUsageTabs
                  abilities={["exchange", "scan"]}
                  activeAbility={pokerPreparationAbility}
                  counts={{
                    "copy-paste": maxCopyPastes,
                    exchange: remainingExchanges,
                    scan: remainingScans,
                  }}
                  onSelect={setPokerPreparationAbility}
                />
                <p className="mt-2 text-sm font-black text-stone-100">
                  エクスチェンジ使用可能回数: {remainingExchanges}回 / スキャン使用可能回数:{" "}
                  {remainingScans}回
                </p>
                {pokerPreparationAbility === "exchange" && maxExchanges > 0 ? (
                  <ExchangeModeToggleButton
                    className="mt-3"
                    isActive={targetSelectionAbility === "exchange"}
                    isCompleted={remainingExchanges === 0}
                    onClick={togglePokerExchangeMode}
                  />
                ) : null}
              </>
            )}
            {!isPokerThirdBattle && !isFinalAllGamesBattle ? (
              <>
                {pokerPreparationAbility === "exchange" ? <div className="my-3"><GameStartHandNotice /></div> : null}
                {pokerPreparationAbility === "exchange" ? (
                  <ExchangeSpecToggle />
                ) : null}
                {pokerPreparationAbility === "exchange" ? (
                <ExchangeRuleList
                  disabledTargets={
                    isPokerSecondBattle
                      ? ["deck", "field"]
                      : ["robot-hand", "field"]
                  }
                  samePrintTimingLabel={samePrintTimingLabel}
                  showDeckTarget
                  showFieldTarget
                  targetLabels={{
                    deck: "フィールド",
                    field: "フィールド",
                    "robot-hand": "ポーカーのロボットの手札",
                  }}
                />
                ) : null}
            {config ? (
              <>
                {pokerPreparationAbility === "scan" && scanRequirements.length > 0 ? (
                  <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
                    <ScanSpecToggle isVisible={pokerScanSpecVisible} onToggle={() => setPokerScanSpecVisible((current) => !current)} />
                    <details
                      className="mt-3 rounded border border-white/12 bg-black/25 p-3"
                      onToggle={(event) => {
                        if (event.currentTarget.open && isPokerSecondBattle && !hasShownPokerRiddleHint.current) {
                          hasShownPokerRiddleHint.current = true;
                          setShowPokerRiddleHint(true);
                        }
                      }}
                    >
                      <summary className="cursor-pointer text-sm font-black leading-6 text-brass">小謎の紙</summary>
                      <ScanRiddleImages images={pokerScanRiddles} onOpen={setExpandedPokerRiddle} />
                    </details>
                    <ScanSolvedSummary hasFourthScanResult additionalRows={scanRequirements
                      .filter((requirement) => scannedPokerCardIds.includes(requirement.cardId))
                      .map((requirement) => ({
                        answer: requirement.answer,
                        imageSrc: requirement.targetImageSrc,
                        generatedNumber: String(generatedScanCards[requirement.cardId].rank),
                        illustrationName: requirement.illustration.replace(/[\s\u3000]+/g, "/"),
                        question: pokerScanRiddles.find((riddle) => riddle.src === requirement.riddleSrc)?.label ?? "",
                      }))}
                    />
                    <ScanAnswerPanel
                      answer={pokerScanAnswer}
                      inventoryCards={scannedPokerCards}
                      physicalScanDisabled={remainingScans === 0}
                      illustration={pokerScanIllustration}
                      splitIndexes={pokerScanSplitIndexes}
                      onAnswerChange={setPokerScanAnswer}
                      onIllustrationChange={(value) => {
                        setPokerScanIllustration(value);
                        setPokerScanSplitIndexes([]);
                      }}
                      onSplitChange={(indexes, value) => {
                        setPokerScanSplitIndexes(indexes);
                        setPokerScanIllustration(value);
                      }}
                      onSubmit={resolvePokerScan}
                      message={pokerScanMessage}
                    >
                      {pokerScanPreviewSrc ? <ScanTargetPreview alt="今回スキャンした対象" src={pokerScanPreviewSrc} /> : null}
                    </ScanAnswerPanel>
                  </div>
                ) : null}
                {pokerPreparationAbility === "exchange" ? (
                  <>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                          交換対象
                        </p>
                        <h3 className="mt-1 text-xl font-black">
                          交換対象を{maxExchangeCardSelections}枚選択
                        </h3>
                      </div>
                      <span className="rounded bg-white px-2 py-1 text-xs font-black text-stone-950">
                        {exchangeCardIds.length}/{maxExchangeCardSelections}
                      </span>
                    </div>
                    <ExchangeCardSectionPicker
                      onToggleCard={toggleExchangeCard}
                      sections={exchangeSections.map((section) => ({
                        ...section,
                        interactionDisabled:
                          targetSelectionAbility !== "exchange" ||
                          remainingExchanges === 0,
                      }))}
                      selectedCardIds={exchangeCardIds}
                      confirmedCardColors={confirmedPokerExchangeColors}
                    />
                  </>
                ) : null}
                {pokerPreparationAbility === "exchange" ? (
                  <>
                    <button
                      className={`mt-3 min-h-12 w-full rounded px-4 py-3 text-sm font-black ${
                        remainingExchanges === 0
                          ? "cursor-not-allowed bg-emerald-500 text-stone-950 opacity-80"
                          : exchangeCardIds.length === maxExchangeCardSelections
                            ? "bg-brass text-stone-950 hover:bg-yellow-300"
                            : "cursor-not-allowed bg-stone-700 text-stone-400"
                      }`}
                      disabled={
                        remainingExchanges === 0 || targetSelectionAbility !== "exchange" ||
                        exchangeCardIds.length !== maxExchangeCardSelections
                      }
                      onClick={confirmPokerExchangeSelection}
                      type="button"
                    >
                      {remainingExchanges === 0
                        ? `交換済み: ${confirmedPokerExchangePairs.length}回`
                        : `エクスチェンジ決定 (${exchangeCardIds.length}/${maxExchangeCardSelections})`}
                    </button>
                    {isExchangeApplied ? (
                      <ExchangeRedoButton
                        onClick={() =>
                          resetPokerExchangeSelection({
                            reactivateExchangeMode: true,
                          })
                        }
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
              </>
            ) : null}
          </div>
          {showPreparation ? (
            <GameTableReturnButton
              className="w-full"
              onClick={() => setShowPreparation(false)}
            />
          ) : null}
          {!showPreparation ? (
            activePokerGame === "ready" ? (
              null
            ) : activePokerGame === "high-low" ? (
              pokerHighLowResult === "win" ? (
                <button
                  className="min-h-12 rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
                  onClick={advancePokerSequence}
                  type="button"
                >
                  {blackjackRobotHand.length > 0
                    ? "ブラックジャックへ"
                    : "ポーカーへ"}
                </button>
              ) : pokerHighLowResult ? (
                <BattleDefeatNotice message="ハイ＆ローに勝利できませんでした。" onRetry={resetPokerInstantLose} />
              ) : (
                <p className="rounded border border-sky-300/35 bg-sky-950/25 p-3 text-sm font-black leading-6 text-sky-100">
                  プレイヤーの手札を出してください。
                </p>
              )
            ) : activePokerGame === "blackjack" ? (
              pokerBlackjackResult === "win" ? (
                <button
                  className="min-h-12 rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
                  onClick={advancePokerSequence}
                  type="button"
                >
                  ポーカーへ
                </button>
              ) : pokerBlackjackResult ? (
                <BattleDefeatNotice message="ブラックジャックに勝利できませんでした。" onRetry={resetPokerInstantLose} />
              ) : (
                <p className="rounded border border-sky-300/35 bg-sky-950/25 p-3 text-sm font-black leading-6 text-sky-100">
                  プレイヤーの手札をフィールドへ出してください。
                </p>
              )
            ) : activePokerGame === "poker" ? (
              <button
                className={`min-h-12 rounded px-4 py-3 text-sm font-black ${
                  isPokerHandReady
                    ? "bg-brass text-stone-950 hover:bg-yellow-300"
                    : "cursor-not-allowed bg-stone-700 text-stone-400"
                }`}
                disabled={!isPokerHandReady}
                onClick={advancePokerSequence}
                type="button"
              >
                役を決定
              </button>
            ) : activePokerGame === "result" ? (
              pokerResult === "win" ? (
                <>
                  <div className="rounded border border-emerald-400/45 bg-emerald-950/35 p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                      テーブルメッセージ
                    </p>
                    <p className="mt-3 text-base font-black leading-7 text-emerald-100">
                      ポーカーまで勝利しました。
                    </p>
                    <p className="mt-4 text-3xl font-black uppercase tracking-[0.08em] text-brass">
                      YOU WIN
                    </p>
                    {pokerLearningRestriction ? (
                      <VictoryConditionNotice message={pokerLearningRestriction} />
                    ) : null}
                  </div>
                    <button
                      className="min-h-12 rounded bg-brass px-4 py-3 text-sm font-black text-stone-950 hover:bg-yellow-300"
                      onClick={() => {
                        if (!isFinalAllGamesBattle || finalGameCleared) onWin();
                        else {
                          setActivePokerGame("ready");
                          setShowPreparation(true);
                        }
                      }}
                      type="button"
                    >
                      {isFinalAllGamesBattle ? finalGameCleared ? "クリア画面へ" : "事前準備へ" : isPokerSecondBattle ? "賭けチュートリアルへ" : nextPokerBattleLabel}
                    </button>
                    {isFinalAllGamesBattle && !finalGameCleared ? <p className="text-sm font-bold leading-6 text-red-300">全勝しましたが、ロボットに{finalRobotChips}chip残っています。チップを0にして、もう一度全勝しよう。</p> : null}
                </>
              ) : (
                <BattleDefeatNotice
                  message={pokerResult === "draw"
                      ? "同じ強さの役のため、勝利できませんでした。"
                      : "この組み合わせではポーカーロボットに勝てません。"}
                  onRetry={resetPokerInstantLose}
                />
              )
            ) : (
              <BattleDefeatNotice
                message="ポーカーロボットに殴られ、意識を失った"
                onRetry={resetPokerInstantLose}
              />
            )
          ) : null}
        </section>
      </div>
    </div>
    </BlueTextSelectionContext.Provider>
  );
}

function AbilityUsageTabs({
  activeAbility,
  abilities = ["exchange", "scan", "copy-paste"],
  counts,
  onSelect,
}: {
  activeAbility: PreparationAbility;
  abilities?: PreparationAbility[];
  counts: Record<PreparationAbility, number | string>;
  onSelect: (ability: PreparationAbility) => void;
}) {
  const labels: Record<PreparationAbility, string> = {
    "copy-paste": "コピーペースト",
    exchange: "エクスチェンジ",
    scan: "スキャン",
  };

  return (
    <div
      className={`mt-3 grid gap-2 ${
        abilities.length === 2 ? "grid-cols-2" : "grid-cols-3"
      }`}
    >
      {abilities.map((ability) => {
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
            <span className="block text-[11px]">
              {typeof counts[ability] === "number" ? `残${counts[ability]}` : counts[ability]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CopyPasteGameSpecifications({
  onOpenGuideImage,
}: {
  onOpenGuideImage: (image: { alt: string; src: string }) => void;
}) {
  const games: Array<{ label: string; rules: ReactNode; spec: ReactNode }> = [
    {
      label: "ハイ＆ロー",
      rules: <HighlightedHighLowRuleText />,
      spec: <HighlightedHighLowSpecText />,
    },
    {
      label: "ブラックジャック",
      rules: <HighlightedBlackjackRuleText />,
      spec: <HighlightedBlackjackSpecText />,
    },
    {
      label: "ポーカー",
      rules: (
        <PokerRuleContent
          onOpenGuideImage={onOpenGuideImage}
          ruleText={pokerRuleText}
          showRobotWinRate
        />
      ),
      spec: <PokerRobotSpecContent specText={pokerSpecText} showBettingSpec />,
    },
  ];

  return (
    <div className="mt-3 flex flex-col gap-3">
      {games.map((game) => (
        <details
          className="rounded border border-white/15 bg-black/30 p-3"
          key={game.label}
        >
          <summary className="cursor-pointer text-sm font-black text-brass">
            {game.label}の仕様
          </summary>
          <div className="mt-3 text-sm font-bold leading-7 text-stone-100">
            <h3 className="mb-2 text-amber-200">ゲーム仕様</h3>
            {game.rules}
            <h3 className="mb-2 mt-4 border-t border-white/15 pt-3 text-emerald-200">
              ロボット仕様
            </h3>
            {game.spec}
          </div>
        </details>
      ))}
    </div>
  );
}

function CopyPasteUnlockRiddle({ isSolved, onUnlock, onOpen }: {
  isSolved: boolean;
  onUnlock: () => void;
  onOpen: (image: { alt: string; src: string }) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  return (
    <details className="mt-3 rounded border border-white/15 bg-black/30 p-3" open={isSolved ? undefined : true}>
      <summary className="cursor-pointer text-sm font-black text-brass">⑤ コピーペースト解放謎</summary>
      <div className="mt-3 rounded bg-white p-3">
        <ZoomableRiddleImage alt="コピーペースト解放謎" badge="⑤" src="/riddles/riddle_5.png" onOpen={onOpen} />
      </div>
      {isSolved ? <p className="mt-3 text-sm font-black text-emerald-200">回答済み：はる</p> : (
        <>
          <label className="mt-3 grid gap-2 text-sm font-bold">小謎の答え
            <input className="min-h-11 min-w-0 w-full rounded border border-brass bg-white px-3 py-2 text-base font-bold text-stone-950" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="答えを入力" />
          </label>
          <button className="mt-3 min-h-11 w-full rounded bg-brass px-3 text-sm font-black text-stone-950" type="button" onClick={() => {
            if (normalizeRiddleAnswer(answer) === "はる") {
              setError("");
              onUnlock();
            } else {
              setError("答えが違います。");
            }
          }}>回答</button>
          {error ? <p className="mt-2 text-sm font-bold text-red-300" role="alert">{error}</p> : null}
        </>
      )}
    </details>
  );
}

function CopyPastePreparationPanel({
  appliedText,
  error,
  successMessage,
  copiedTarget,
  format,
  formatLabel,
  isApplied,
  isSelecting,
  maxCopyPastes,
  onChooseFormat,
  onPaste,
  onReset,
  onStart,
  pasteTarget,
}: {
  appliedText?: string;
  error: string;
  successMessage?: string;
  copiedTarget?: { label: string; text: string };
  format: CopyPasteFormat;
  formatLabel: string;
  isApplied: boolean;
  isSelecting: boolean;
  maxCopyPastes: number;
  onChooseFormat: (format: CopyPasteFormat) => void;
  onPaste: () => void;
  onReset: () => void;
  onStart: () => void;
  pasteTarget?: { label: string; text: string };
}) {
  const [isSpecVisible, setIsSpecVisible] = useState(true);
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
          コピーペースト
        </p>
        <p className="text-xs font-black text-red-100">残{maxCopyPastes}</p>
      </div>
      <AbilitySpecToggleButton label="コピーペースト機能について" isVisible={isSpecVisible} onToggle={() => setIsSpecVisible((current) => !current)} />
      {isSpecVisible ? <p className="mt-3 rounded border border-sky-300/35 bg-sky-950/25 p-3 text-sm font-bold leading-6 text-sky-50">
        青字をコピーし、別の青字へ上書きペーストできる。ペースト時の書式は自由に選択できるが、
        <span className="font-black text-red-300">文章の意味が通る場合のみ</span>
        実行できる。
        ルールが変更された場合、ロボットはそのルールに従い勝利判定まで行う。
      </p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {formatOptions.map((option) => (
          <button
            className={`min-h-10 rounded border px-3 py-2 text-sm font-black ${
              format === option.id
                ? "border-red-100 bg-red-200 text-stone-950"
                : "border-white/10 bg-white/8 text-white hover:bg-white/14"
            }`}
            key={option.id}
            disabled={isApplied}
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
        aria-pressed={isSelecting}
        onClick={onStart}
        type="button"
      >
        {isSelecting ? "対象選択を解除" : "対象選択を開始"}
      </button>
      <div className="mt-3 grid gap-2 text-sm font-bold leading-6 text-stone-100">
        <p>コピー元: {copiedTarget ? copiedTarget.label : "未選択"}</p>
        <p>上書き先: {pasteTarget ? pasteTarget.label : "未選択"}</p>
        <p>書式: {formatLabel}</p>
      </div>
      <button
        className="mt-3 min-h-11 w-full rounded bg-brass px-4 text-sm font-black text-stone-950 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
        disabled={!copiedTarget || !pasteTarget || isApplied || maxCopyPastes === 0}
        onClick={onPaste}
        type="button"
      >
        ペースト実行
      </button>
      {successMessage || (isApplied && copiedTarget && pasteTarget) ? (
        <p className="mt-3 rounded border border-emerald-300/45 bg-emerald-950/40 p-3 text-sm font-black leading-6 text-emerald-100" role="status" aria-live="polite">
          {successMessage ?? `${appliedText ?? copiedTarget?.text} を ${formatLabel} として ${pasteTarget?.text} に上書きしました。`}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded border border-red-400 bg-red-950/50 p-3 text-sm font-black text-red-100" role="alert">
          {error}
        </p>
      ) : null}
      {isApplied ? (
        <button
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded border border-white/20 px-4 text-sm font-black text-white hover:bg-white/10"
          onClick={onReset}
          type="button"
        >
          <RotateCcw size={16} />
          やり直し
        </button>
      ) : null}
    </div>
  );
}


function PokerCardGroup({
  actions,
  cards,
  copyPasteTarget,
  label,
  notice,
}: {
  actions?: ReactNode;
  cards: PlayingCard[];
  copyPasteTarget?: {
    active: boolean;
    cardId: string;
    isSelected: boolean;
    label: string;
    onSelect: () => void;
  };
  label: string;
  notice?: string;
}) {
  return (
    <BlackjackField
      actions={actions}
      cards={cards}
      label={label}
      notice={notice}
      isBlackjack={false}
      revealSecond
      score={null}
      cardContent={copyPasteTarget ? cards.map((card) =>
        card.id === copyPasteTarget.cardId ? (
          <CopyPasteCardTarget card={card} key={card.id} target={copyPasteTarget} />
        ) : (
          <PlayingCardView card={card} key={card.id} size="hand" />
        ),
      ) : undefined}
    />
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
      <PlayingCardView card={card} size="hand" />
    </button>
  );
}

function PokerSelectableGroup({
  cards,
  disabled = false,
  label,
  onToggle,
  selectedCardIds,
}: {
  cards: PlayingCard[];
  disabled?: boolean;
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
                  : disabled
                    ? "cursor-default bg-transparent"
                    : "bg-transparent hover:bg-white/10"
              }`}
              disabled={disabled}
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
  confirmedCardColors = {},
  longPressMode = false,
  onToggleCard,
  sections,
  selectedCardIds,
  showEmptySections = false,
}: {
  confirmedCardColors?: Record<string, string>;
  longPressMode?: boolean;
  onToggleCard: (cardId: string) => void;
  sections: ExchangeCardSection[];
  selectedCardIds: string[];
  showEmptySections?: boolean;
}) {
  const visibleSections = sections.filter(
    (section) => showEmptySections || section.cards.length > 0,
  );

  return (
    <div className="mt-4 grid gap-3">
      {visibleSections.map((section) => (
        <section
          className={`rounded border p-3 ${
            section.disabled || section.interactionDisabled
              ? "border-white/8 bg-black/35 opacity-60"
              : "border-white/10 bg-black/25"
          }`}
          key={section.id}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              {section.label}
            </p>
            <p className="text-xs font-bold text-stone-400">
              {section.disabled ? "選択不可" : `${section.cards.length}枚`}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {section.cards.length === 0 ? (
              <p className="text-sm text-stone-400">カードなし</p>
            ) : null}
            {section.cards.map((card) => (
              <ExchangeCardButton
                card={card}
                disabled={
                  Boolean(confirmedCardColors[card.id]) ||
                  section.disabled ||
                  section.interactionDisabled ||
                  section.displayOnly
                }
                key={`${section.id}-${card.id}`}
                longPressMode={longPressMode}
                onSelect={() => onToggleCard(card.id)}
                selected={selectedCardIds.includes(card.id)}
                confirmedColor={confirmedCardColors[card.id]}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ExchangeCardButton({
  confirmedColor,
  card,
  disabled = false,
  longPressMode,
  onSelect,
  selected,
}: {
  confirmedColor?: string;
  card: PlayingCard;
  disabled?: boolean;
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
    if (disabled) {
      return;
    }

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
      aria-disabled={disabled}
      aria-pressed={selected}
      className={`rounded border p-1 transition ${
        confirmedColor
          ? confirmedColor === "green"
            ? "cursor-not-allowed border-emerald-300 bg-emerald-400/20 ring-4 ring-emerald-300/45"
            : "cursor-not-allowed border-sky-300 bg-sky-400/20 ring-4 ring-sky-300/45"
          : disabled
          ? "cursor-not-allowed border-white/5 bg-stone-900/70 grayscale opacity-65"
          : selected
          ? "border-brass bg-brass/20 ring-4 ring-brass/45"
          : longPressMode
            ? "border-cyan-300 bg-cyan-300/15 hover:bg-cyan-300/25"
            : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
      onClick={() => {
        if (disabled) {
          return;
        }

        if (!longPressMode) {
          onSelect();
        }
      }}
      onPointerCancel={clearLongPress}
      onPointerDown={startLongPress}
      onPointerLeave={clearLongPress}
      onPointerUp={clearLongPress}
      disabled={disabled}
      type="button"
    >
      <PlayingCardView card={card} size="hand" />
    </button>
  );
}

function HighLowBattle({
  backHref,
  exchangePreparation,
  hand,
  isRiddleExchangeTimingRevealed,
  onAdvanceToSecondStage,
  onNextBattle,
  onBack,
  onOpenModal,
  onSaveExchangePreparation,
  onTutorialLosePartReached,
  robot,
  robotId,
  stageId,
}: {
  backHref: string;
  exchangePreparation?: HighLowExchangePreparation;
  hand: PlayingCard[];
  isRiddleExchangeTimingRevealed: boolean;
  onAdvanceToSecondStage: () => void;
  onNextBattle: (robotId: string) => void;
  onBack: () => void;
  onOpenModal: (kind: ModalKind, gameType: GameType) => void;
  onSaveExchangePreparation: (preparation: HighLowExchangePreparation) => void;
  onTutorialLosePartReached: () => void;
  robot: Robot;
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
  const [draggingCardId, setDraggingCardId] = useSessionState<string | null>(`stage-${stageId}:HighLowBattle:${robotId}:draggingCardId`, null);
  const [dragPreviewPoint, setDragPreviewPoint] = useSessionState<{
    x: number;
    y: number;
  } | null>(`stage-${stageId}:HighLowBattle:${robotId}:dragPreviewPoint`, null);
  const [playerPlacedCardId, setPlayerPlacedCardId] = useSessionState<string | null>(
    `stage-${stageId}:HighLowBattle:${robotId}:playerPlacedCardId`, null,
  );
  const [battleStarted, setBattleStarted] = useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:battleStarted`, false);
  const [robotZone, setRobotZone] = useSessionState<HighLowZoneName | null>(`stage-${stageId}:HighLowBattle:${robotId}:robotZone`, null);
  const [playerZone, setPlayerZone] = useSessionState<HighLowZoneName | null>(`stage-${stageId}:HighLowBattle:${robotId}:playerZone`, null);
  const [showPreparationVehicle, setShowPreparationVehicle] = useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:showPreparationVehicle`, false);
  const [showPreparation, setShowPreparation] = useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:showPreparation`, false);
  const [showPreparationIntro, setShowPreparationIntro] = useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:showPreparationIntro`, isTutorial);
  const [showExchangeWarning, setShowExchangeWarning] = useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:showExchangeWarning`, false);
  const [showPostExchangeStartDialog, setShowPostExchangeStartDialog] =
    useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:showPostExchangeStartDialog`, false);
  const [winOverlayDismissed, setWinOverlayDismissed] = useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:winOverlayDismissed`, false);
  const [hasEnteredPreparation, setHasEnteredPreparation] = useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:hasEnteredPreparation`, false);
  const [exchangeCardIds, setExchangeCardIds] = useSessionState<string[]>(
    `stage-${stageId}:HighLowBattle:${robotId}:exchangeCardIds`, exchangePreparation?.cardIds ?? [],
  );
  const [exchangeConfirmed, setExchangeConfirmed] = useSessionState(
    `stage-${stageId}:HighLowBattle:${robotId}:exchangeConfirmed`, exchangePreparation?.confirmed ?? false,
  );
  const [isHighLowExchangeModeActive, setIsHighLowExchangeModeActive] = useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:isHighLowExchangeModeActive`, false);
  const [exchangeApplied, setExchangeApplied] = useSessionState(
    `stage-${stageId}:HighLowBattle:${robotId}:exchangeApplied`, exchangePreparation?.applied ?? false,
  );
  const [placementAnimation, setPlacementAnimation] = useState<{
    mode: "hold" | "release";
    styleType: PlacementStyle;
    zone: HighLowZoneName;
  } | null>(null);
  const [placementPendingConfirm, setPlacementPendingConfirm] = useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:placementPendingConfirm`, false);
  const [placementConfirmed, setPlacementConfirmed] = useSessionState(`stage-${stageId}:HighLowBattle:${robotId}:placementConfirmed`, false);
  const isSelectedExchangeCorrect =
    Boolean(highLowConfig) &&
    highLowConfig?.correctExchangePairs.some((pair) =>
      pair.every((cardId) => exchangeCardIds.includes(cardId)),
    ) === true;
  const isExchangeCorrect = exchangeConfirmed && isSelectedExchangeCorrect;
  const isExchangeApplied = isExchangeCorrect && exchangeApplied;
  const canPlaceCard = battleStarted;
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
  const preExchangeRobotOpening =
    highLowConfig && !isExchangeApplied && "robotOpeningCardId" in highLowConfig
      ? highLowConfig
      : null;
  const configuredRobotOpeningCard = preExchangeRobotOpening
    ? robotHand.find((card) => card.id === preExchangeRobotOpening.robotOpeningCardId) ??
      null
    : null;
  const configuredRobotOpeningZone =
    preExchangeRobotOpening?.robotOpeningZone ?? null;
  const guaranteedWinOpening = getGuaranteedWinOpening(playerHand.map(getHighLowCardValue), robotHand.map(getHighLowCardValue));
  const defaultRobotCard = guaranteedWinOpening !== null ? robotHand[guaranteedWinOpening] :
    isFinalHighLowBattle
      ? robotHand.find((card) => card.rank === "K") ?? robotHand[0]
      :
    configuredRobotHighCard ??
    configuredRobotOpeningCard ??
    (isTutorial ? initialRobotHand.find((card) => card.rank === "K") : robotHand[0]);
  const defaultPlayerCard = isTutorial
    ? tutorialPlayerCard
    : playerHand[0];
  const robotPlacedCard = robotZone ? defaultRobotCard ?? null : null;
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
  const tutorialStepText =
    isTutorial && isExchangeApplied && tutorialStep.target === "player-card"
      ? `エクスチェンジ発動後、ロボットが先にAを${robotZone}ゾーンへ置きました。手札の${robotZone === "LOW" ? "A" : "K"}を${robotZone === "LOW" ? "HIGH" : "LOW"}ゾーンへドラッグして置いて勝利しましょう。`
      : tutorialStep.text;
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
      label: "ハイ＆ローのロボット手札",
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

  const showResultOverlay =
    (highLowResult === "win" || highLowResult === "lose") &&
    !winOverlayDismissed;
  const samePrintTimingLabel = isRiddleExchangeTimingRevealed
    ? "小謎の紙"
    : "対象が同じ紙面上の場合";
  useEffect(() => {
    if (isTutorial && !isExchangeApplied && canPlaceCard) {
      onTutorialLosePartReached();
    }
  }, [canPlaceCard, isExchangeApplied, isTutorial, onTutorialLosePartReached]);

  function startBattle() {
    setBattleStarted(true);
    setRobotZone(
      guaranteedWinOpening !== null ? "LOW" : configuredRobotOpeningZone ??
        getRobotOpeningZone({
          isExchangeCorrect,
          isFinalHighLowBattle,
          isTutorial,
        }),
    );
    setShowPostExchangeStartDialog(isTutorial && isExchangeCorrect);
  }

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

  function resetBattleAttempt() {
    setDraggingCardId(null);
    setDragPreviewPoint(null);
    setPlayerPlacedCardId(null);
    setPlayerZone(null);
    setPlacementAnimation(null);
    setPlacementPendingConfirm(false);
    setPlacementConfirmed(false);
    setWinOverlayDismissed(false);
    setShowExchangeWarning(false);
    setBattleStarted(false);
    setRobotZone(null);
    setShowPostExchangeStartDialog(false);
  }

  function returnFromPreparationToBattle() {
    setDraggingCardId(null);
    setDragPreviewPoint(null);
    setPlayerPlacedCardId(null);
    setPlayerZone(null);
    setPlacementAnimation(null);
    setPlacementPendingConfirm(false);
    setPlacementConfirmed(false);
    setWinOverlayDismissed(false);
    setShowExchangeWarning(false);
    setShowPreparation(false);

    setBattleStarted(false);
    setRobotZone(null);
    setShowPostExchangeStartDialog(false);
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
    if (!isHighLowExchangeModeActive || exchangeConfirmed) return;
    const nextCardIds = exchangeCardIds.includes(cardId)
      ? exchangeCardIds.filter((id) => id !== cardId)
      : exchangeCardIds.length >= 2
        ? [exchangeCardIds[1], cardId]
        : [...exchangeCardIds, cardId];

    setExchangeCardIds(nextCardIds);
    setExchangeConfirmed(false);
    setExchangeApplied(false);
    onSaveExchangePreparation({
      applied: false,
      cardIds: nextCardIds,
      confirmed: false,
    });
  }

  useEffect(() => {
    function handleGlobalNav(event: Event) {
      const action = (event as CustomEvent<{ action?: GlobalNavAction }>).detail
        ?.action;

      if (action === "battle") {
        setShowPreparationVehicle(false);
        setShowPreparation(false);
        return;
      }

      if (action === "preparation" && requiresExchangeBeforeStart) {
        setShowPreparationVehicle(false);
        setShowPreparation(true);
        setShowPreparationIntro(false);
        setHasEnteredPreparation(true);
      }
    }

    window.addEventListener(GLOBAL_NAV_EVENT, handleGlobalNav);

    return () => {
      window.removeEventListener(GLOBAL_NAV_EVENT, handleGlobalNav);
    };
  }, [requiresExchangeBeforeStart]);

  if (showPreparationVehicle) {
    return (
      <div className="min-h-[680px] bg-[#120d09] text-white">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/45 p-3 sm:p-4">
          <button
            className="grid h-10 w-10 place-items-center rounded border border-white/14 bg-white/8 hover:bg-white/14"
            onClick={() => setShowPreparationVehicle(false)}
            type="button"
            aria-label="ハイ＆ローに戻る"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-black">車内で準備</h2>
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
                事前準備
              </p>
              <h3 className="mt-2 text-xl font-black">車内で準備</h3>
              <p className="mt-4 text-sm font-bold leading-7 text-stone-100">
                <span className="block">
                  このままではプレイヤーが勝つことはできません。
                </span>
                <span className="mt-2 block font-black">
                  車内に用意した能力の内、一つを解放します。
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
            aria-label="ハイ＆ローに戻る"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-black">車内で準備</h2>
          <div className="h-10 w-10" />
        </div>

        <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
          <div className="hidden">
          <TutorialBubble>
            <span className="block">
              このままではプレイヤーが勝つことはできません。
            </span>
            <span className="mt-2 block font-black">
              車内に用意した能力の内、一つを解放します。
            </span>
          </TutorialBubble>
          </div>

          <section className="mt-4 rounded border border-white/12 bg-black/35 p-3 sm:p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
              能力 01
            </p>
            <h3 className="mt-1 text-2xl font-black">エクスチェンジ</h3>
            <p className="mt-3 text-sm font-bold leading-7 text-stone-200">
              数字の書かれたカードの印刷面のみを入れ替える。発動後は、交換後の数字のカードとして扱われる
            </p>
            <ExchangeSpecToggle />
            <ExchangeRuleList samePrintTimingLabel={samePrintTimingLabel} />
          </section>

          <section className="mt-4 rounded border border-white/12 bg-black/35 p-3 sm:p-5">
            <ExchangeModeToggleButton
              className="mb-4"
              isActive={isHighLowExchangeModeActive}
              isCompleted={exchangeConfirmed}
              onClick={() => {
                if (isHighLowExchangeModeActive || exchangeConfirmed) {
                  setIsHighLowExchangeModeActive(false);
                  setExchangeCardIds([]);
                  setExchangeConfirmed(false);
                  setExchangeApplied(false);
                  onSaveExchangePreparation({ applied: false, cardIds: [], confirmed: false });
                } else {
                  setIsHighLowExchangeModeActive(true);
                }
              }}
            />
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
                  交換対象
                </p>
                <h3 className="mt-1 text-xl font-black">交換対象を2枚選択</h3>
              </div>
              <p className="rounded bg-white px-2 py-1 text-xs font-black text-stone-950">
                {exchangeCardIds.length}/2
              </p>
            </div>

            <div className="my-3"><GameStartHandNotice /></div>
            <ExchangeCardSectionPicker
              sections={exchangeSections.map((section) => ({
                ...section,
                interactionDisabled: !isHighLowExchangeModeActive || exchangeConfirmed,
              }))}
              selectedCardIds={exchangeCardIds}
              onToggleCard={toggleExchangeCard}
            />

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {exchangeConfirmed ? (
                <p className="text-sm font-bold text-emerald-200">
                  エクスチェンジ対象を決定しました。
                </p>
              ) : null}
              {exchangeConfirmed ? (
                <button
                  className="min-h-11 rounded bg-sky-500 px-5 text-sm font-black text-white hover:bg-sky-400"
                  onClick={returnFromPreparationToBattle}
                  type="button"
                >
                  ゲームスタートへ
                </button>
              ) : null}
              <button
                className={`min-h-11 rounded px-5 text-sm font-black ${
                  isHighLowExchangeModeActive && exchangeCardIds.length === 2 && !exchangeConfirmed
                    ? "bg-brass text-stone-950 hover:bg-yellow-300"
                    : "cursor-not-allowed bg-stone-700 text-stone-400"
                }`}
                disabled={!isHighLowExchangeModeActive || exchangeCardIds.length !== 2 || exchangeConfirmed}
                onClick={() => {
                  const nextPreparation = {
                    applied: isSelectedExchangeCorrect,
                    cardIds: exchangeCardIds,
                    confirmed: true,
                  };
                  setExchangeConfirmed(true);
                  setIsHighLowExchangeModeActive(false);
                  setExchangeApplied(isSelectedExchangeCorrect);
                  onSaveExchangePreparation(nextPreparation);
                }}
                type="button"
              >
                エクスチェンジ決定
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
          onClick={(event) => {
            event.preventDefault();
            onBack();
          }}
          aria-label="ゲーム会場へ"
          title="ゲーム会場へ"
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
                エクスチェンジ確認
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

        {showPostExchangeStartDialog ? (
          <PlayerCutInDialog
            onDismiss={() => setShowPostExchangeStartDialog(false)}
            text="ゲームスタート宣言時にエクスチェンジが発動後、ロボットはカードを選ぶのか"
          />
        ) : null}

        {showResultOverlay ? (
          <button
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 text-center backdrop-blur-[2px]"
            onClick={() => setWinOverlayDismissed(true)}
            type="button"
            aria-label="結果表示を閉じる"
          >
            <span className="relative inline-grid place-items-center">
              <span
                className={`absolute h-44 w-44 rounded-full blur-3xl sm:h-64 sm:w-64 ${
                  highLowResult === "win"
                    ? "bg-emerald-400/25"
                    : "bg-casinoRed/30"
                }`}
              />
              <span
                className={`absolute h-28 w-72 rounded-full border sm:h-40 sm:w-[34rem] ${
                  highLowResult === "win"
                    ? "border-brass/70 shadow-[0_0_48px_rgba(246,195,92,0.75)]"
                    : "border-casinoRed/75 shadow-[0_0_48px_rgba(180,31,44,0.72)]"
                }`}
              />
              <span
                className={`relative scale-105 text-5xl font-black drop-shadow-[0_6px_0_rgba(0,0,0,0.8)] sm:text-8xl ${
                  highLowResult === "win" ? "text-brass" : "text-casinoRed"
                }`}
              >
                {highLowResult === "win" ? "YOU WIN" : "YOU LOSE"}
              </span>
            </span>
          </button>
        ) : null}

        {draggingCard && dragPreviewPoint ? (
          <DraggingCardPreview card={draggingCard} point={dragPreviewPoint} />
        ) : null}

        {!battleStarted ? (
          <div className="mx-auto mb-4 max-w-4xl">
            <GameStartRow robotId={robotId}>
            <button
              className="min-h-11 rounded bg-casinoRed px-5 text-sm font-black text-white hover:bg-red-700"
              onClick={startBattle}
              type="button"
            >
              ゲームスタート
            </button>
            </GameStartRow>
          </div>
        ) : null}

        {requiresExchangeBeforeStart && !exchangeApplied ? (
          <div className="mx-auto mb-4 flex max-w-4xl justify-end">
            <button
              className={`grid min-h-11 place-items-center rounded border border-brass bg-black/35 px-4 text-sm font-black text-brass ${
                battleStarted
                  ? "cursor-not-allowed opacity-45"
                  : "hover:bg-brass/10"
              }`}
              data-high-low-prepare
              disabled={battleStarted}
              onClick={() => {
                if (!battleStarted) {
                  setShowPreparationVehicle(true);
                }
              }}
              onPointerDown={() => {
                if (!battleStarted) {
                  setShowPreparationVehicle(true);
                }
              }}
              type="button"
            >
              車内で準備
            </button>
          </div>
        ) : null}

        <section className="mx-auto max-w-4xl rounded border border-emerald-200/20 bg-emerald-950/45 p-3 shadow-[inset_0_0_70px_rgba(0,0,0,0.35)] sm:p-5">
          {battleStarted ? (
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
                spotlight={isTutorial && tutorialStep.target === "player-card" && robotZone === "LOW"}
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
                spotlight={isTutorial && tutorialStep.target === "player-card" && robotZone !== "LOW"}
                onDropCard={() => dropPlayerCard("LOW")}
                robotPlaced={robotZone === "LOW"}
                robotCard={robotZone === "LOW" ? robotPlacedCard : null}
                tone="low"
              />
            </div>
          ) : null}

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
            {isExchangeApplied && !battleStarted ? (
              <p className="rounded border border-brass/45 bg-brass/10 px-3 py-2 text-sm font-black text-brass sm:col-span-2 sm:w-fit">
                ゲームスタート後
              </p>
            ) : null}
            <HandPanel
              cards={visiblePlayerHand}
              draggableCardIds={draggableCardIds}
              highlightedCardId={
                isTutorial && !isExchangeApplied && tutorialStep.target === "player-card"
                  ? tutorialPlayerCard?.id
                  : null
              }
              onCardDragEnd={endDraggingCard}
              onCardDragMove={moveDraggingCard}
              onCardDragStart={startDraggingCard}
              owner="Player"
            />
            <HandPanel
              actions={
                <GameInfoButtons
                  gameType="high-low"
                  onOpenModal={onOpenModal}
                  robot={robot}
                />
              }
              cards={visibleRobotHand}
              owner="Robot"
            />
          </div>

          {isTutorial && tutorialStep.target === "player-card" ? (
            <TutorialBubble className="mt-3">{tutorialStepText}</TutorialBubble>
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

          {highLowResult === "lose" && !isTutorial ? (
            <div className="mt-3 flex justify-end">
              <button
                className="min-h-11 rounded bg-casinoRed px-5 text-sm font-black text-white hover:bg-red-700"
                onClick={resetBattleAttempt}
                type="button"
              >
                やり直し
              </button>
            </div>
          ) : null}

          {isTutorial && highLowResult === "lose" ? (
            <div className="mt-3 flex justify-end">
              <button
                className="min-h-11 rounded bg-brass px-5 text-sm font-black text-stone-950 hover:bg-yellow-300"
                onClick={() => {
                  setShowPreparationVehicle(true);
                  setShowPreparation(false);
                  setShowPreparationIntro(isTutorial);
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
              <button
                className="grid min-h-11 place-items-center rounded bg-brass px-5 text-sm font-black text-stone-950 hover:bg-yellow-300"
                onClick={() => onNextBattle("high-low-1-2")}
                type="button"
              >
                2戦目へ
              </button>
            </div>
          ) : null}

          {robotId === "high-low-1-2" && highLowResult === "win" ? (
            <div className="mt-3 flex justify-end">
              <button
                className="grid min-h-11 place-items-center rounded bg-brass px-5 text-sm font-black text-stone-950 hover:bg-yellow-300"
                onClick={() => onNextBattle("high-low-1-3")}
                type="button"
              >
                3戦目へ
              </button>
            </div>
          ) : null}

          {robotId === "high-low-1-3" && highLowResult === "win" ? (
            <div className="mt-3 flex justify-end">
              <button
                className="min-h-11 rounded bg-brass px-5 text-sm font-black text-stone-950 hover:bg-yellow-300"
                onClick={onAdvanceToSecondStage}
                type="button"
              >
                第2ステージへ
              </button>
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
              : "ハイ＆ロー画面に入ると、ロボットが先にカードを置きます。"}
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

function getModalText(modal: {
  gameType: GameType;
  kind: ModalKind;
  robot: Robot;
}) {
  if (modal.gameType === "blackjack") {
    return modal.kind === "rules" ? blackjackRuleText : blackjackSpecText;
  }

  if (modal.gameType === "high-low") {
    return modal.kind === "rules" ? highLowRuleText : highLowSpecText;
  }

  if (modal.gameType === "poker") {
    return modal.kind === "rules" ? pokerRuleText : pokerSpecText;
  }

  return modal.kind === "rules" ? modal.robot.ruleText : modal.robot.specText;
}

function getBlackjackCardValue(card: PlayingCard, aceValue = 11) {
  const numericRank = Number(card.rank);

  if (Number.isFinite(numericRank)) {
    return numericRank;
  }

  return card.rank === "A" ? aceValue : 10;
}

function getBlackjackScore(cards: PlayingCard[], aceValue = 11) {
  return cards.reduce((total, card) => total + getBlackjackCardValue(card, aceValue), 0);
}

function getBlackjackResult(playerCards: PlayingCard[], robotCards: PlayingCard[], aceValue = 11) {
  if (getBlackjackScore(playerCards, aceValue) === 21) {
    return "win";
  }

  const playerDistance = Math.abs(21 - getBlackjackScore(playerCards, aceValue));
  const robotDistance = Math.abs(21 - getBlackjackScore(robotCards, aceValue));

  if (playerDistance < robotDistance) {
    return "win";
  }

  if (playerDistance === robotDistance) {
    return "draw";
  }

  return "lose";
}

function getPokerRankValue(rank: string) {
  if (rank === "A") {
    return 14;
  }

  if (rank === "K") {
    return 13;
  }

  if (rank === "Q") {
    return 12;
  }

  if (rank === "J") {
    return 11;
  }

  return Number(rank);
}

function evaluatePokerHand(cards: PlayingCard[]): PokerHandEvaluation {
  const rankCounts = cards.reduce<Record<string, number>>((counts, card) => {
    counts[card.rank] = (counts[card.rank] ?? 0) + 1;
    return counts;
  }, {});
  const groups = Object.entries(rankCounts)
    .map(([rank, count]) => ({
      count,
      rank,
      value: getPokerRankValue(rank),
    }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const counts = groups.map((group) => group.count);

  if (counts[0] === 4) {
    return {
      category: "four-card",
      label: "フォーカード",
      score: 4,
      tiebreakers: groups.map((group) => group.value),
    };
  }

  if (counts[0] === 3) {
    return {
      category: "three-card",
      label: "スリーカード",
      score: 3,
      tiebreakers: groups.map((group) => group.value),
    };
  }

  if (counts[0] === 2 && counts[1] === 2) {
    return {
      category: "two-pair",
      label: "ツーペア",
      score: 2,
      tiebreakers: groups.map((group) => group.value),
    };
  }

  if (counts[0] === 2) {
    return {
      category: "one-pair",
      label: "ワンペア",
      score: 1,
      tiebreakers: groups.map((group) => group.value),
    };
  }

  return {
    category: "none",
    label: "ワンペア未満",
    score: 0,
    tiebreakers: groups
      .map((group) => group.value)
      .sort((a, b) => b - a),
  };
}

function comparePokerHands(
  first: PokerHandEvaluation,
  second: PokerHandEvaluation,
) {
  if (first.score !== second.score) {
    return first.score - second.score;
  }

  const maxLength = Math.max(first.tiebreakers.length, second.tiebreakers.length);
  for (let index = 0; index < maxLength; index += 1) {
    const firstValue = first.tiebreakers[index] ?? 0;
    const secondValue = second.tiebreakers[index] ?? 0;

    if (firstValue !== secondValue) {
      return firstValue - secondValue;
    }
  }

  return 0;
}

function getBestPokerSelection(handCards: PlayingCard[], fieldCards: PlayingCard[]) {
  if (handCards.length < 2 || fieldCards.length < 2) {
    return null;
  }

  return fieldCards.reduce<{
    cards: PlayingCard[];
    evaluation: PokerHandEvaluation;
    fieldCards: PlayingCard[];
  } | null>((best, firstFieldCard, firstIndex) => {
    const candidates = fieldCards.slice(firstIndex + 1).map((secondFieldCard) => {
      const selectedFieldCards = [firstFieldCard, secondFieldCard];
      const cards = [...handCards, ...selectedFieldCards];

      return {
        cards,
        evaluation: evaluatePokerHand(cards),
        fieldCards: selectedFieldCards,
      };
    });

    return candidates.reduce((currentBest, candidate) => {
      if (
        !currentBest ||
        comparePokerHands(candidate.evaluation, currentBest.evaluation) > 0
      ) {
        return candidate;
      }

      return currentBest;
    }, best);
  }, null);
}

function getPokerRobotWinRate(robotCards: PlayingCard[], fieldCards: PlayingCard[]) {
  const robotSelection = getBestPokerSelection(robotCards, fieldCards);
  if (!robotSelection) return 0;
  const visibleIds = new Set([...robotCards, ...fieldCards].map((card) => card.id));
  const unseenCards = deck.filter((card) => !visibleIds.has(card.id));
  let wins = 0;
  let total = 0;
  // The robot knows its own cards and the field, but not the player's hand.
  for (let first = 0; first < unseenCards.length; first += 1) {
    for (let second = first + 1; second < unseenCards.length; second += 1) {
      const playerSelection = getBestPokerSelection(
        [unseenCards[first], unseenCards[second]], fieldCards,
      );
      if (!playerSelection) continue;
      total += 1;
      if (comparePokerHands(robotSelection.evaluation, playerSelection.evaluation) >= 0) {
        wins += 1;
      }
    }
  }
  return total === 0 ? 0 : wins / total;
}

function formatPokerRankList(cards: PlayingCard[]) {
  return cards.map((card) => card.rank).join("・");
}

function BlackjackFieldArea({
  canDropPlayerCard = false,
  onDropPlayerCard,
  placementAnimation = null,
  placementAnimationMode = "release",
  playerCards,
  playerValue,
  robotCards,
  robotValue,
}: {
  canDropPlayerCard?: boolean;
  onDropPlayerCard?: (cardId?: string) => void;
  placementAnimation?: PlacementStyle | null;
  placementAnimationMode?: "hold" | "release";
  playerCards: PlayingCard[];
  playerValue: number | null;
  robotCards: PlayingCard[];
  robotValue: number | null;
}) {
  return (
    <div className="rounded border border-white/10 bg-black/35 p-2">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
        ブラックジャックフィールド
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <BlackjackFieldSlot
          cards={robotCards}
          label="ロボット"
          stackCards
          value={robotValue}
        />
        <BlackjackFieldSlot
          canDropCard={canDropPlayerCard}
          cards={playerCards}
          label="プレイヤー"
          onDropCard={onDropPlayerCard}
          placementAnimation={placementAnimation}
          placementAnimationMode={placementAnimationMode}
          stackCards
          value={playerValue}
        />
      </div>
    </div>
  );
}

function BlackjackFieldSlot({
  canDropCard = false,
  cards,
  label,
  onDropCard,
  placementAnimation = null,
  placementAnimationMode = "release",
  stackCards = false,
  value,
}: {
  canDropCard?: boolean;
  cards: PlayingCard[];
  label: string;
  onDropCard?: (cardId?: string) => void;
  placementAnimation?: PlacementStyle | null;
  placementAnimationMode?: "hold" | "release";
  stackCards?: boolean;
  value: number | null;
}) {
  return (
    <div
      className={`relative flex min-h-32 flex-col rounded border bg-emerald-950/25 p-2 sm:min-h-36 ${
        canDropCard
          ? "border-brass/70 ring-2 ring-brass/25"
          : "border-white/8"
      }`}
      onDragOver={(event) => {
        if (canDropCard) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        if (!canDropCard) {
          return;
        }

        event.preventDefault();
        onDropCard?.(event.dataTransfer.getData("text/plain"));
      }}
    >
      <p className="shrink-0 rounded bg-black/35 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-stone-200">
        {label}
      </p>
      {value !== null ? <BlackjackFieldValue value={value} /> : null}
      <div className="flex flex-1 items-center justify-center gap-2 px-2 pb-1 pl-10 pt-2 sm:pl-12">
        {cards.length > 0 && stackCards ? (
          <div className="relative h-20 w-14 sm:h-24 sm:w-16">
            {cards.map((card, index) => (
              <div
                className="absolute inset-0"
                key={`${label}-${card.id}`}
                style={{ zIndex: index + 1 }}
              >
                <PlayingCardView card={card} size="hand" />
              </div>
            ))}
          </div>
        ) : cards.length > 0 ? (
          cards.map((card) => (
            <PlayingCardView card={card} key={`${label}-${card.id}`} size="hand" />
          ))
        ) : null}
      </div>
      {placementAnimation ? (
        <CardPlacementAnimation
          className="translate-x-4 sm:translate-x-5"
          mode={placementAnimationMode}
          styleType={placementAnimation}
        />
      ) : null}
    </div>
  );
}

function BlackjackFieldValue({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (value <= displayValue) {
      const timer = window.setTimeout(() => setDisplayValue(value), 0);
      return () => window.clearTimeout(timer);
    }

    const stepMs = 42;
    const timer = window.setInterval(() => {
      setDisplayValue((current) => {
        if (current >= value) {
          window.clearInterval(timer);
          return value;
        }

        return current + 1;
      });
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [displayValue, value]);

  return (
    <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-3xl font-black leading-none text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] sm:left-4 sm:text-5xl">
      {displayValue}
    </div>
  );
}

function BlackjackField({
  actions,
  cards,
  cardContent,
  draggableCardIds = [],
  highlightedCardId = null,
  isBlackjack,
  label,
  notice,
  onCardDragEnd,
  onCardDragMove,
  onCardDragStart,
  placementAnimation = null,
  revealSecond,
  score,
}: {
  actions?: ReactNode;
  cards: PlayingCard[];
  cardContent?: ReactNode;
  draggableCardIds?: string[];
  highlightedCardId?: string | null;
  isBlackjack: boolean;
  label: string;
  notice?: string;
  onCardDragEnd?: () => void;
  onCardDragMove?: (point: { x: number; y: number } | null) => void;
  onCardDragStart?: (cardId: string, point: { x: number; y: number } | null) => void;
  placementAnimation?: PlacementStyle | null;
  revealSecond: boolean;
  score: number | null;
}) {
  const firstCard = cards[0] ?? null;
  const secondCard = cards[1] ?? null;

  return (
    <div className="rounded border border-white/10 bg-black/35 p-2">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[11px] font-black uppercase tracking-[0.18em] text-brass">
          {label}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          {score !== null ? (
            <span className="rounded bg-white px-2 py-1 text-xs font-black text-stone-950">
              {score}
            </span>
          ) : null}
        </div>
      </div>
      <div className={`relative mt-2 flex min-h-24 flex-wrap items-center justify-center gap-2 rounded border border-white/8 bg-emerald-950/25 p-2 sm:min-h-28 ${notice ? "pt-7" : ""}`}>
        {notice ? (
          <span className="absolute left-1 top-1 z-10 rounded border border-red-300/60 bg-red-950/85 px-1.5 py-0.5 text-[9px] font-black leading-3 text-red-100 shadow-lg">
            {notice}
          </span>
        ) : null}
        {cardContent ?? <>
        {firstCard ? (
          <PlayingCardView
            card={firstCard}
            draggable={draggableCardIds.includes(firstCard.id)}
            highlighted={highlightedCardId === firstCard.id}
            onDragEnd={onCardDragEnd}
            onDragMove={onCardDragMove}
            onDragStart={(point) => onCardDragStart?.(firstCard.id, point)}
            size="hand"
          />
        ) : null}
        {revealSecond && secondCard ? (
          <PlayingCardView
            card={secondCard}
            draggable={draggableCardIds.includes(secondCard.id)}
            highlighted={highlightedCardId === secondCard.id}
            onDragEnd={onCardDragEnd}
            onDragMove={onCardDragMove}
            onDragStart={(point) => onCardDragStart?.(secondCard.id, point)}
            size="hand"
          />
        ) : null}
        </>}
        {placementAnimation ? (
          <CardPlacementAnimation styleType={placementAnimation} />
        ) : null}
      </div>
      {score !== null && revealSecond && isBlackjack ? (
        <p className="mt-2 text-center text-sm font-black text-brass">
          ブラックジャック
        </p>
      ) : null}
    </div>
  );
}

const riddlePrintTargets = [
  {
    id: "riddle-1-middle-left",
    label: "中央行左側",
    style: "left-[8%] top-[36%] h-[44%] w-[26%]",
  },
  {
    id: "riddle-1-center",
    label: "ど真ん中",
    style: "left-[39%] top-[36%] h-[44%] w-[22%]",
  },
] as const;

function RiddlePrintTargetLayer({
  disabled = false,
  onToggleTarget,
  selectedIds,
}: {
  disabled?: boolean;
  onToggleTarget: (targetId: string) => void;
  selectedIds: string[];
}) {
  function selectTarget(
    event:
      | ReactMouseEvent<HTMLButtonElement>
      | ReactPointerEvent<HTMLButtonElement>,
    targetId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) {
      onToggleTarget(targetId);
    }
  }

  return (
    <>
      {riddlePrintTargets.map((target) => {
          const selected = selectedIds.includes(target.id);

          return (
            <button
              aria-pressed={selected}
              className={`absolute z-20 ${target.style} rounded border-2 transition ${
                disabled
                  ? "cursor-not-allowed border-transparent bg-transparent"
                  : selected
                  ? "border-emerald-400 bg-emerald-300/25 shadow-[0_0_0_4px_rgba(16,185,129,0.32)]"
                  : "border-transparent bg-transparent"
              }`}
              key={target.id}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onPointerDown={(event) => selectTarget(event, target.id)}
              type="button"
            />
          );
        })}
    </>
  );
}

function RiddlePrintTargetPicker({
  disabled = false,
  isExchanged = false,
  onOpen,
  onToggleTarget,
  selectedIds,
}: {
  disabled?: boolean;
  isExchanged?: boolean;
  onOpen: (image: { alt: string; src: string }) => void;
  onToggleTarget: (targetId: string) => void;
  selectedIds: string[];
}) {
  const imageSrc = isExchanged
    ? "/riddles/riddle_1ex.png"
    : "/riddles/riddle_1.png";

  return (
    <div className="mt-3 rounded border border-white/12 bg-white p-3 text-stone-950">
      <span className="mb-1 inline-grid h-8 min-w-8 place-items-center rounded border border-brass/70 bg-black/80 px-2 text-sm font-black text-brass shadow-lg">
        ①
      </span>
      <div className="relative overflow-hidden rounded border border-stone-300 bg-white">
        <button
          className="block w-full text-left"
          onClick={() =>
            onOpen({
              alt: "小謎 1/2",
              src: imageSrc,
            })
          }
          type="button"
        >
          <Image
            alt="エクスチェンジ対象を選択する小謎"
            className="h-auto w-full"
            height={900}
            src={imageSrc}
            width={1600}
          />
        </button>
        {isExchanged ? null : (
          <RiddlePrintTargetLayer
            disabled={disabled}
            onToggleTarget={onToggleTarget}
            selectedIds={selectedIds}
          />
        )}
      </div>
    </div>
  );
}

function ExchangeRuleList({
  disabledTargets = [],
  rankRestrictions = [],
  samePrintTimingLabel = "対象が同じ紙面上の場合",
  showDeckTarget = false,
  showFieldTarget = false,
  showTargetList = false,
  showVisiblePrintTarget = false,
  targetLabels = {},
  visiblePrintRemaining,
}: {
  disabledTargets?: ExchangeTargetId[];
  rankRestrictions?: string[];
  samePrintTimingLabel?: "対象が同じ紙面上の場合" | "小謎の紙";
  showDeckTarget?: boolean;
  showFieldTarget?: boolean;
  showTargetList?: boolean;
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
      {showTargetList ? (
        <>
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
        </>
      ) : null}
      <div
        className={`text-sm font-bold leading-6 text-stone-100 ${
          showTargetList ? "mt-3 border-t border-white/10 pt-3" : ""
        }`}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
          エクスチェンジの発動タイミング
        </p>
        <p className="mt-2">・{samePrintTimingLabel}→即時</p>
        <p>
          ・それ以外→
          <SelectableBlueText id="exchange-start-timing">ゲームスタート</SelectableBlueText>宣言時
        </p>
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
    "3": 0,
    "5": 0,
    "9": 0,
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
      : "ハイ＆ロー画面に入ると、ロボットが先にカードを置きます。";
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

  return "ハイ＆ロー画面に入ると、ロボットが先にカードを置きます。";
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
    text: "ハイ＆ロー画面に入ると、ロボットが先にカードを置きます。",
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
    text: "ハイ＆ロー画面に入ると、ロボットが先にカードを置きます。",
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
      <span className="absolute left-2 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center text-lg font-black leading-none text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] sm:left-5 sm:text-4xl">
        {label.split("").map((letter, index) => (
          <span key={`${label}-${letter}-${index}`}>{letter}</span>
        ))}
      </span>
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
        {placedCard ? <PlayingCardView card={placedCard} size="zone" /> : null}
      </div>
      {placementAnimation ? (
        <CardPlacementAnimation
          cardSize="zone"
          mode={placementAnimation.mode}
          styleType={placementAnimation.styleType}
        />
      ) : null}
      <div className="absolute inset-x-2 bottom-2 z-30 flex items-center justify-between gap-1 sm:inset-x-3 sm:bottom-3 sm:gap-2">
        {robotPlaced ? (
          <span className="rounded bg-brass px-2 py-1 text-xs font-black text-stone-950">
            ロボット
          </span>
        ) : (
          <span />
        )}
        {playerPlaced ? (
          <span
            className="rounded bg-emerald-500 px-2 py-2 text-xs font-black text-stone-950 sm:px-3"
          >
            配置済み
          </span>
        ) : null}
      </div>
    </div>
  );
}

function HandPanel({
  actions,
  cards,
  draggableCardIds = [],
  highlightedCardId = null,
  onCardDragEnd,
  onCardDragMove,
  onCardDragStart,
  owner,
}: {
  actions?: ReactNode;
  cards: PlayingCard[];
  draggableCardIds?: string[];
  highlightedCardId?: string | null;
  onCardDragEnd?: () => void;
  onCardDragMove?: (point: { x: number; y: number } | null) => void;
  onCardDragStart?: (cardId: string, point: { x: number; y: number } | null) => void;
  owner: "Player" | "Robot";
}) {
  return (
    <div className="relative rounded border border-white/10 bg-black/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brass">
          {owner === "Player" ? "プレイヤーの手札" : "ロボットの手札"}
        </p>
        {actions}
      </div>
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
          unoptimized
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
        <Metric icon={<CircleDollarSign size={18} />} label="プレイヤー" value={chips} />
        <Metric
          icon={<Trophy size={18} />}
          label="対戦"
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
