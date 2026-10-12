export function shouldShowReservedExchange({ deferred, preparation, triggered, game }: {
  deferred: boolean;
  preparation: boolean;
  triggered: boolean;
  game: string;
}): boolean {
  if (!deferred || preparation) return true;
  return triggered && game !== "blackjack";
}

export function isBlackjackKingExchangeExposed({ finalStage, timing, declaration, pairs, playerCardIds, robotKingCardIds }: {
  finalStage: boolean;
  timing: string | undefined;
  declaration: string;
  pairs: { firstCardId: string; secondCardId: string }[];
  playerCardIds: readonly string[];
  robotKingCardIds: string[];
}): boolean {
  return finalStage && timing === "ブラックジャック" && declaration === "ブラックジャック" &&
    pairs.some(({ firstCardId, secondCardId }) =>
      (robotKingCardIds.includes(firstCardId) && playerCardIds.includes(secondCardId)) ||
      (robotKingCardIds.includes(secondCardId) && playerCardIds.includes(firstCardId)),
    );
}
