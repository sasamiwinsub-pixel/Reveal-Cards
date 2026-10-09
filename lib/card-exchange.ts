export function applyExchangePairs(
  cardIds: string[],
  exchangePairs: Array<{ firstCardId: string; secondCardId: string }>,
): string[] {
  return cardIds.map((cardId) => {
    const pair = exchangePairs.find(
      (item) => item.firstCardId === cardId || item.secondCardId === cardId,
    );
    if (!pair) return cardId;
    return pair.firstCardId === cardId ? pair.secondCardId : pair.firstCardId;
  });
}
