export function isFinalAllInPreparation(preparation: {
  exchangeTiming: string | undefined;
  declaration: string;
  riddleGame: string | undefined;
  scanGame: string | undefined;
  scanRole: string | undefined;
  playerRanks: string[];
  fieldRanks: string[];
  robotRanks: string[];
}) {
  return preparation.exchangeTiming === "ブラックジャック" &&
    preparation.declaration === "ブラックジャック" &&
    preparation.riddleGame === "ハイ＆ロー" &&
    preparation.scanGame === "ブラックジャック" &&
    preparation.scanRole === "じゅういち" &&
    preparation.playerRanks.length === 2 && preparation.playerRanks.every((rank) => rank === "K") &&
    preparation.fieldRanks.filter((rank) => rank === "K").length >= 2 &&
    preparation.robotRanks.length === 2 && preparation.robotRanks.every((rank) => rank === "A");
}

export function isFinalGameClear(results: {
  highLow: string | null;
  blackjack: string | null;
  poker: string | null;
  robotChips: number;
}) {
  return results.highLow === "win" && results.blackjack === "win" &&
    results.poker === "win" && results.robotChips === 0;
}
