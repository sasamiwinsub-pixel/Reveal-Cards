export type GameType = "blackjack" | "poker" | "high-low";
export type Seat = "right" | "top" | "left";
export type CardRank = "A" | "J" | "Q" | "K";

export type Robot = {
  id: string;
  name: string;
  gameType: GameType;
  seat: Seat;
  chips: number;
  ruleText: string;
  specText: string;
};

export type Stage = {
  id: number;
  label: string;
  title: string;
  startingChips: number;
  robots: Robot[];
};

export type PlayingCard = {
  id: string;
  rank: CardRank;
};

const gameLabels: Record<GameType, string> = {
  blackjack: "ブラックジャック",
  poker: "ポーカー",
  "high-low": "ハイアンドロー",
};

export const stages: Stage[] = [
  {
    id: 1,
    label: "1st",
    title: "Single Bet",
    startingChips: 20,
    robots: [
      {
        id: "blackjack-1",
        name: "BJ-01",
        gameType: "blackjack",
        seat: "right",
        chips: 35,
        ruleText: "ダミー",
        specText: "ダミー",
      },
    ],
  },
  {
    id: 2,
    label: "2nd",
    title: "Split Table",
    startingChips: 55,
    robots: [
      {
        id: "blackjack-2",
        name: "BJ-02",
        gameType: "blackjack",
        seat: "right",
        chips: 35,
        ruleText: "ダミー",
        specText: "ダミー",
      },
      {
        id: "poker-2",
        name: "PK-02",
        gameType: "poker",
        seat: "top",
        chips: 45,
        ruleText: "ダミー",
        specText: "ダミー",
      },
    ],
  },
  {
    id: 3,
    label: "3rd",
    title: "Full Casino",
    startingChips: 80,
    robots: [
      {
        id: "blackjack-3",
        name: "BJ-03",
        gameType: "blackjack",
        seat: "right",
        chips: 35,
        ruleText: "ダミー",
        specText: "ダミー",
      },
      {
        id: "poker-3",
        name: "PK-03",
        gameType: "poker",
        seat: "top",
        chips: 45,
        ruleText: "ダミー",
        specText: "ダミー",
      },
      {
        id: "high-low-3",
        name: "HL-03",
        gameType: "high-low",
        seat: "left",
        chips: 55,
        ruleText: "ダミー",
        specText: "ダミー",
      },
    ],
  },
];

export function getGameLabel(gameType: GameType) {
  return gameLabels[gameType];
}

export function createDeck(): PlayingCard[] {
  const ranks: CardRank[] = ["A", "J", "Q", "K"];

  return ranks.flatMap((rank) =>
    Array.from({ length: 4 }, (_, index) => ({
      id: `${rank}-${index + 1}`,
      rank,
    })),
  );
}

export function drawOpeningHand(stageId: number): PlayingCard[] {
  const deck = createDeck();
  const firstIndex = (stageId * 3) % deck.length;
  const secondIndex = (firstIndex + 7) % deck.length;

  return [deck[firstIndex], deck[secondIndex]];
}
