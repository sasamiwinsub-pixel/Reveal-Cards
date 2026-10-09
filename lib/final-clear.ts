export function isFinalGameClear(results: {
  highLow: string | null;
  blackjack: string | null;
  poker: string | null;
  robotChips: number;
}) {
  return results.highLow === "win" && results.blackjack === "win" &&
    results.poker === "win" && results.robotChips === 0;
}
