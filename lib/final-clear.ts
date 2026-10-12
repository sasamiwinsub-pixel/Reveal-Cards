export function isFinalGameClear(results: {
  highLow: string | null;
  blackjack: string | null;
  poker: string | null;
}) {
  return results.highLow === "win" && results.blackjack === "win" &&
    results.poker === "win";
}
