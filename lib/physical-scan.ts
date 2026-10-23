export function getAvailablePhysicalScanCards<T extends { id: string }>(cards: readonly T[], consumedIds: readonly string[]): T[] {
  const consumed = new Set(consumedIds);
  return cards.filter((card) => !consumed.has(card.id));
}

export function isPhysicalScanSelectionValid(
  selectedIds: string[],
  inventory: { id: string; rank: string }[],
  requiredRank: string,
  requiredCount: number,
): boolean {
  return selectedIds.length === requiredCount &&
    new Set(selectedIds).size === requiredCount &&
    selectedIds.every((id) => inventory.some((card) => card.id === id && card.rank === requiredRank));
}

export function getFinalPhysicalScanReading(ranks: string[], game: string | undefined, role: string | undefined): string | null {
  if (ranks.length !== 2 || !ranks.includes("A") || !ranks.includes("J")) return null;
  if (role === "ブラックジャック" && (game === undefined || game === "ポーカー" || game === "ブラックジャック")) return "ブラックジャック";
  if (game !== "ブラックジャック" || role !== "じゅういち") return null;
  return "にじゅういち";
}

export function resolveFinalPhysicalScanSplit(reading: string): string | null {
  if (reading === "ブラック ジャック" || reading === "ぶらっく じゃっく") return "scan-J";
  return reading === "に じゅういち" || reading === "に じゅう いち" ? "scan-K" : null;
}

export function getFinalSingleCardScan(ranks: string[], game: string | undefined, role: string | undefined): "A" | "J" | null {
  if (game !== "ブラックジャック" || !["11", "ジュウイチ", "十一"].includes(role ?? "") || ranks.length !== 1) return null;
  return ranks[0] === "A" || ranks[0] === "J" ? ranks[0] : null;
}
