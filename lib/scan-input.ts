export function normalizeScanIllustrationName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[／/]/g, " ")
    .replace(/[\s\u3000]+/g, " ")
    .replace(/[\u30a1-\u30f6]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60),
    )
    .toLowerCase();
}
