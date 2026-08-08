export type GameType = "blackjack" | "poker" | "high-low";
export type Seat = "right" | "top" | "left";
export type CardRank = "A" | "J" | "Q" | "K";
export type CardSuit = "crub" | "daia" | "heart" | "spade";

export type Robot = {
  id: string;
  name: string;
  gameType: GameType;
  gameTypes?: GameType[];
  seat: Seat;
  chips?: number;
  rewardChips?: number;
  ruleText: string;
  specText: string;
};

export type Stage = {
  id: number;
  label: string;
  title: string;
  startingChips: number;
  clearText: string;
  robots: Robot[];
};

export type PlayingCard = {
  id: string;
  rank: CardRank;
  suit: CardSuit;
  imageSrc: string;
};

const gameLabels: Record<GameType, string> = {
  blackjack: "ブラックジャック",
  poker: "ポーカー",
  "high-low": "ハイアンドロー",
};

const gameSeats: Record<GameType, Seat> = {
  blackjack: "top",
  poker: "left",
  "high-low": "right",
};

const highLowRuleText =
  "お互いに手札2枚ずつ用意。銃声が鳴ったら、早いもの勝ちでHIGHゾーン or LOWゾーンに置ける。プレイヤーの勝利条件はカードの大小関係が成り立つこと。ロボットはそれが成り立たないようにカードをHIGHゾーン or LOWゾーンのどちらかに置いてくる。ロボットの方が反射神経が早いため、ロボットよりも先に置くことはできない。スタートの合図で用いる銃は2つだけ弾を装填しており、どのタイミングで銃声が鳴るかはランダムである。";

const highLowSpecText =
  "このロボットだけこちらの手札を透視してくる。ロボットは特殊能力こそ考慮できないが、一番勝率の良いプレイをする。";

export const stages: Stage[] = [
  {
    id: 1,
    label: "1st",
    title: "High And Low",
    startingChips: 0,
    clearText: "ハイアンドローを3戦します。勝利すると50チップ獲得します。",
    robots: [
      {
        id: "high-low-1-1",
        name: "HL-01",
        gameType: "high-low",
        seat: "right",
        rewardChips: 50,
        ruleText: highLowRuleText,
        specText: highLowSpecText,
      },
      {
        id: "high-low-1-2",
        name: "HL-02",
        gameType: "high-low",
        seat: "right",
        rewardChips: 50,
        ruleText: highLowRuleText,
        specText: highLowSpecText,
      },
      {
        id: "high-low-1-3",
        name: "HL-03",
        gameType: "high-low",
        seat: "right",
        rewardChips: 50,
        ruleText: highLowRuleText,
        specText: highLowSpecText,
      },
    ],
  },
  {
    id: 2,
    label: "2nd",
    title: "Blackjack",
    startingChips: 0,
    clearText:
      "ブラックジャックを3戦します。3戦目のみ、ブラックジャックとハイアンドローの両方をクリアします。",
    robots: [
      {
        id: "blackjack-2-1",
        name: "BJ-01",
        gameType: "blackjack",
        seat: "top",
        ruleText: "ダミー",
        specText: "ダミー",
      },
      {
        id: "blackjack-2-2",
        name: "BJ-02",
        gameType: "blackjack",
        seat: "top",
        ruleText: "ダミー",
        specText: "ダミー",
      },
      {
        id: "blackjack-high-low-2-3",
        name: "BJ/HL-03",
        gameType: "blackjack",
        gameTypes: ["blackjack", "high-low"],
        seat: "top",
        ruleText: highLowRuleText,
        specText: highLowSpecText,
      },
    ],
  },
  {
    id: 3,
    label: "3rd",
    title: "Poker",
    startingChips: 0,
    clearText: "ポーカーを2戦します。",
    robots: [
      {
        id: "poker-3-1",
        name: "PK-01",
        gameType: "poker",
        seat: "left",
        ruleText: "ダミー",
        specText: "ダミー",
      },
      {
        id: "poker-3-2",
        name: "PK-02",
        gameType: "poker",
        seat: "left",
        ruleText: "ダミー",
        specText: "ダミー",
      },
    ],
  },
  {
    id: 4,
    label: "Last",
    title: "All Games",
    startingChips: 0,
    clearText:
      "ラストステージは1戦のみです。ブラックジャック、ポーカー、ハイアンドローをすべてクリアします。",
    robots: [
      {
        id: "all-games-last",
        name: "LAST-01",
        gameType: "blackjack",
        gameTypes: ["blackjack", "poker", "high-low"],
        seat: "top",
        ruleText: highLowRuleText,
        specText: highLowSpecText,
      },
    ],
  },
];

export function getGameLabel(gameType: GameType) {
  return gameLabels[gameType];
}

export function getRobotGameTypes(robot: Robot) {
  return robot.gameTypes ?? [robot.gameType];
}

export function getGameSeat(gameType: GameType) {
  return gameSeats[gameType];
}

export function createDeck(): PlayingCard[] {
  const ranks: CardRank[] = ["A", "J", "Q", "K"];
  const suits: CardSuit[] = ["crub", "daia", "heart", "spade"];

  return ranks.flatMap((rank) =>
    suits.map((suit) => ({
      id: `${rank}-${suit}`,
      rank,
      suit,
      imageSrc: `/cards/cropped/${rank}_${suit}.png`,
    })),
  );
}

export function drawOpeningHand(stageId: number): PlayingCard[] {
  const deck = createDeck();
  const openingHands: Record<number, string[]> = {
    1: ["A_spade", "J_crub"],
    2: ["A_heart", "J_spade"],
    3: ["A_daia", "J_heart"],
    4: ["A_crub", "J_heart"],
  };
  const cardIds = openingHands[stageId] ?? openingHands[1];

  return cardIds
    .map((id) => deck.find((card) => card.id === id.replace("_", "-")))
    .filter((card): card is PlayingCard => Boolean(card));
}
