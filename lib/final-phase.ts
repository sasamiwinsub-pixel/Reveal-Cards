export function isFinalFirstPhaseComplete(pairs: readonly { firstCardId: string; secondCardId: string }[], timing: string | undefined): boolean {
  if (timing !== "ブラックジャック" || pairs.length !== 2) return false;
  const players = new Set<string>();
  const kings = new Set<string>();
  for (const { firstCardId, secondCardId } of pairs) {
    const player = [firstCardId, secondCardId].find((id) => id === "A-daia" || id === "J-heart");
    const king = [firstCardId, secondCardId].find((id) => id === "K-crub" || id === "K-heart");
    if (!player || !king) return false;
    players.add(player);
    kings.add(king);
  }
  return players.size === 2 && kings.size === 2;
}
