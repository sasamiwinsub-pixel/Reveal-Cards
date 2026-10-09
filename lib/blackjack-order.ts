export function getBlackjackOrderValue(rank: string, aceIsZero = false): number {
  if (rank === "A") return aceIsZero ? 0 : 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  return Number(rank);
}

export function isLargestBlackjackCard(rank: string, handRanks: string[], aceIsZero = false): boolean {
  return getBlackjackOrderValue(rank, aceIsZero) === Math.max(...handRanks.map((value) => getBlackjackOrderValue(value, aceIsZero)));
}
