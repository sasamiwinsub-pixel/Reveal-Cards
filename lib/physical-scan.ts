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
  if (game !== "ブラックジャック" || role !== "じゅういち") return null;
  if (ranks.length !== 2 || !ranks.includes("A") || !ranks.includes("J")) return null;
  return "にじゅういち";
}

export function resolveFinalPhysicalScanSplit(reading: string): string | null {
  return reading === "に じゅういち" ? "scan-K" : null;
}
