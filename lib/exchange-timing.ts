export function shouldShowReservedExchange({ deferred, preparation, triggered, game }: {
  deferred: boolean;
  preparation: boolean;
  triggered: boolean;
  game: string;
}): boolean {
  if (!deferred || preparation) return true;
  return triggered && game !== "blackjack";
}
