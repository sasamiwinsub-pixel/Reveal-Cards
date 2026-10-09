export function getGuaranteedWinOpening(playerValues: number[], robotValues: number[]): number | null {
  if (!playerValues.length || !robotValues.length) return null;
  const playerLow = Math.min(...playerValues);
  const playerHigh = Math.max(...playerValues);
  if (!robotValues.every((value) => playerLow <= value && playerHigh >= value)) return null;
  return robotValues.indexOf(Math.max(...robotValues));
}
