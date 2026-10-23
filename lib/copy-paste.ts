export type PasteFormat = "hiragana" | "katakana" | "kanji" | "number";

export function getCorrectCopyPasteChanges(changes: Record<string, string>, finalStage: boolean): Record<string, string> {
  const expected: Record<string, string> = finalStage ? {
    "exchange-start-timing": "ブラックジャック",
    "riddle-four-game": "ハイ＆ロー",
    "scan-poker": "ブラックジャック",
    "scan-role-name": "じゅういち",
  } : { "paste-blackjack-ace": "0" };
  return Object.fromEntries(Object.entries(changes).filter(([id, text]) => expected[id] === text));
}

const readings: Record<string, string> = {
  "例": "れい", "役名": "やくめい", "11": "じゅういち",
  "ゲームスタート": "げーむすたーと", "ポーカー": "ぽーかー",
  "ブラックジャック": "ぶらっくじゃっく", "ハイ＆ロー": "はい＆ろー",
};

export function getCopyFormatPreview(text: string, format: PasteFormat): string | null {
  const normalized = text.normalize("NFKC").replace(/&/g, "＆");
  const previewReadings: Record<string, string> = { ...readings, "0": "れい", "十一": "じゅういち", "零": "れい" };
  const reading = previewReadings[normalized] ?? normalized;
  const hiragana = reading.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  if (format === "hiragana" || format === "katakana") {
    if (!/^[ぁ-ゖー＆&\s]+$/.test(hiragana)) return null;
    return format === "hiragana" ? hiragana : hiragana.replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
  }
  const number = hiragana === "れい" ? "0" : hiragana === "じゅういち" ? "11" : /^\d+$/.test(normalized) ? normalized : null;
  if (format === "number") return number;
  if (/^[一-龯々]+$/.test(normalized)) return normalized;
  if (number === "11") return "十一";
  if (number === "0") return "零";
  return null;
}

const allowedPastes = [
  { source: "scan-example", target: "blackjack-ace-value", format: "number", text: "0" },
  { source: "copy-red-unlock-zero", target: "paste-blackjack-ace", format: "number", text: "0" },
  { source: "blackjack-declaration", target: "exchange-start-timing", format: "katakana", text: "ブラックジャック" },
  { source: "high-low-declaration", target: "exchange-start-timing", format: "katakana", text: "ハイ＆ロー" },
  { source: "high-low-declaration", target: "riddle-four-game", format: "katakana", text: "ハイ＆ロー" },
  { source: "blackjack-ace-value", target: "scan-role-name", format: "hiragana", text: "じゅういち" },
  { source: "blackjack-ace-value", target: "scan-role-name", format: "number", text: "11" },
  { source: "blackjack-ace-value", target: "scan-role-name", format: "katakana", text: "ジュウイチ" },
  { source: "blackjack-ace-value", target: "scan-role-name", format: "kanji", text: "十一" },
  { source: "blackjack-declaration", target: "scan-poker", format: "katakana", text: "ブラックジャック" },
  { source: "blackjack-declaration", target: "scan-role-name", format: "katakana", text: "ブラックジャック" },
] as const;

export function resolvePaste(source: { id: string; text: string }, targetId: string, format: PasteFormat): string | null {
  if (source.id === targetId) return null;
  if (targetId === "exchange-start-timing" && source.text !== "ブラックジャック" && source.text !== "ハイ＆ロー") return null;
  if (targetId === "riddle-four-game" && source.text !== "ハイ＆ロー") return null;
  if (targetId === "scan-role-name" && source.text !== "11" && source.text !== "ブラックジャック") return null;
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
