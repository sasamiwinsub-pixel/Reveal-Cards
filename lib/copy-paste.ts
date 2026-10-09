export type PasteFormat = "hiragana" | "katakana" | "kanji" | "number";

const readings: Record<string, string> = {
  "例": "れい", "役名": "やくめい", "11": "じゅういち",
  "ゲームスタート": "げーむすたーと", "ポーカー": "ぽーかー",
  "ブラックジャック": "ぶらっくじゃっく", "ハイ＆ロー": "はい＆ろー",
};

const allowedPastes = [
  { source: "scan-example", target: "blackjack-ace-value", format: "number", text: "0" },
  { source: "copy-red-unlock-zero", target: "paste-blackjack-ace", format: "number", text: "0" },
  { source: "blackjack-declaration", target: "exchange-start-timing", format: "katakana", text: "ブラックジャック" },
  { source: "high-low-declaration", target: "riddle-four-game", format: "katakana", text: "ハイ＆ロー" },
  { source: "blackjack-ace-value", target: "scan-role-name", format: "hiragana", text: "じゅういち" },
  { source: "blackjack-declaration", target: "scan-poker", format: "katakana", text: "ブラックジャック" },
] as const;

export function resolvePaste(source: { id: string; text: string }, targetId: string, format: PasteFormat): string | null {
  if (source.id === targetId) return null;
  if (targetId === "exchange-start-timing" && source.text !== "ブラックジャック") return null;
  if (targetId === "riddle-four-game" && source.text !== "ハイ＆ロー") return null;
  if (targetId === "scan-role-name" && source.text !== "11") return null;
  if (targetId === "scan-poker" && source.text !== "ブラックジャック") return null;
  if (targetId === "high-low-declaration" || targetId === "blackjack-declaration") {
    const reading = readings[source.text] ?? source.text;
    if (format === "hiragana") {
      return reading.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
    }
    if (format === "katakana") {
      return reading.replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
    }
    if (format === "number" && source.text === "例") return "0";
    return source.text;
  }
  return allowedPastes.find((rule) => rule.source === source.id && rule.target === targetId && rule.format === format)?.text ?? null;
}
