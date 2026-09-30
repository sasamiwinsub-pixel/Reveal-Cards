export type GameType = "blackjack" | "poker" | "high-low";
export type Seat = "right" | "top" | "left";
export type CardRank = "0" | "1" | "3" | "5" | "10" | "A" | "J" | "Q" | "K";
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

export const highLowRuleText =
  "お互いに手札2枚ずつ用意。プレイヤーの勝利条件はカードの大小関係が成り立つこと。\n①ロボットが大小関係成り立たないよう先に置く\n②プレイヤーが置く\n③ハイアンドローと宣言して判定する。";

export const highLowSpecText =
  "ユニークスキル：プレイヤーの手札を透視\n結果に差がない場合は、大きい数字を優先して出す";

export const blackjackRuleText =
  "JQKは10、Aは11として扱い、それ以外は数字通り\n①1枚目を置き、2枚目を重ねて置く\n②合計21になる場合、ブラックジャックと宣言して判定を開始\n③1枚目と2枚目の合計がブラックジャック（21の役）に近い方の勝ち";

export const blackjackSpecText =
  "ユニークスキル：引き分けとなった瞬間、プレイヤーを物理的に倒す\n置かれたカードのカウントを目視で行い、公平な判定を行う";

export const pokerRuleText =
  "手札は2枚。フィールドに4枚トランプを置く。手札2枚とフィールド4枚の中から好きな2枚の合計4枚を選び役を作る。相手と同じカードを選んでもよい。成立した役名を宣言し、役が強い方の勝ち。流れ ①手札2枚に加えて、フィールド4枚の中から好きな2枚を組み合わせて役を作る ②4枚で出来上がった役名を宣言して判定する。";

export const pokerSpecText =
  "自分の手札とフィールドを常に見ているため、イカサマは許さない。カードが判明したら即座に勝率を計算する。";

export const pokerBettingSpecText =
  "カード勝率×所持チップの分だけ賭ける。ポーカーでは賭ける要素が発生し、プレイヤーは問答無用でオールインになる。";

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
    clearText: "ポーカーを3戦します。",
    robots: [
      {
        id: "poker-3-1",
        name: "PK-01",
        gameType: "poker",
        seat: "left",
        ruleText: pokerRuleText,
        specText: pokerSpecText,
      },
      {
        id: "poker-3-2",
        name: "PK-02",
        gameType: "poker",
        seat: "left",
        ruleText: pokerRuleText,
        specText: pokerSpecText,
      },
      {
        id: "poker-3-3",
        name: "PK-03",
        gameType: "poker",
        seat: "left",
        ruleText: pokerRuleText,
        specText: pokerSpecText,
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
    3: ["A_daia", "Q_heart"],
    4: ["A_crub", "J_heart"],
  };
  const cardIds = openingHands[stageId] ?? openingHands[1];

  return cardIds
    .map((id) => deck.find((card) => card.id === id.replace("_", "-")))
    .filter((card): card is PlayingCard => Boolean(card));
}
