"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useSessionState } from "@/lib/session-state";

const themes = [
  {
    title: "全勝する",
    questions: [
      { text: "何もせずにゲームスタートするとどこで負ける？", options: ["ハイ＆ロー", "ブラックジャック", "ポーカー"], answers: [2] },
      { text: "ポーカーロボットが出す役は何？", options: ["Aのツーペア", "Aのスリーカード", "Aのフォーカード"], answers: [1] },
      { text: "ゲームスタート宣言時にエクスチェンジできる対象は？", options: ["自分の手札", "ハイ＆ローロボットの手札", "ブラックジャックロボットの手札", "ポーカーロボットの手札", "フィールド"], answers: [0, 1, 2] },
      { text: "ポーカーロボットに勝利するには？", options: ["コピーペースト機能でポーカーのルールを変更する", "自分がフォーカードを出す"], answers: [1] },
      { text: "自分がフォーカードを出せる数字は？", options: ["A", "K", "Q", "J"], answers: [1] },
      { text: "Kのフォーカードを作るには、自分の手札へのエクスチェンジが何回必要？", options: ["0回", "1回", "2回"], answers: [1] },
    ],
  },
  {
    title: "チップを0にする",
    questions: [
      { text: "ロボットのチップを0にするには？", options: ["ロボットの勝率を100％にする", "ロボットの勝率を0％にする"], answers: [0] },
      { text: "ポーカーロボットが現状割り出した勝率はどのくらい？", options: ["約70%以上", "約50%", "約0%"], answers: [0] },
      { text: "直前の3rdStage最終戦ではゲームスタート前で8%の勝率のところ、いざ対戦すると何％だった？", options: ["0%"], answers: [0] },
    ],
  },
];

export default function FinalSituationReview({ onBack }: { onBack: () => void }) {
  const [activeTheme, setActiveTheme] = useSessionState("stage-4:FinalSituationReview:activeTheme", 0);
  const [progress, setProgress] = useSessionState("stage-4:FinalSituationReview:progress", [0, 0]);
  const [selections, setSelections] = useSessionState<Record<string, number[]>>("stage-4:FinalSituationReview:selections", {});
  const [errors, setErrors] = useSessionState<Record<string, boolean>>("stage-4:FinalSituationReview:errors", {});
  const theme = themes[activeTheme];

  return (
    <section className="min-w-0 p-4 text-white">
      <button className="mb-5 flex min-h-11 items-center gap-2 rounded border border-white/20 px-3 text-sm font-bold hover:bg-white/10" onClick={onBack} type="button">
        <ArrowLeft size={18} />事前準備へ
      </button>
      <h2 className="text-2xl font-black">
        状況整理<span className="inline-block text-base">（全て埋めなくてもクリア可能）</span>
      </h2>
      <div aria-label="状況整理のテーマ" className="my-5 grid grid-cols-2 gap-2" role="tablist">
        {themes.map((item, index) => (
          <button aria-selected={activeTheme === index} className={`min-h-14 min-w-0 rounded border px-2 py-2 text-sm font-black ${activeTheme === index ? "border-brass bg-brass text-stone-950" : "border-white/20 hover:bg-white/10"}`} id={`situation-tab-${index}`} key={item.title} onClick={() => setActiveTheme(index)} role="tab" type="button">
            {item.title}<span className="mt-1 block text-xs">{progress[index]}/{item.questions.length}</span>
          </button>
        ))}
      </div>
      <div aria-labelledby={`situation-tab-${activeTheme}`} className="grid gap-5" role="tabpanel">
        {theme.questions.slice(0, progress[activeTheme] + 1).map((question, questionIndex) => {
          const key = `${activeTheme}-${questionIndex}`;
          const solved = questionIndex < progress[activeTheme];
          const selected = selections[key] ?? [];
          const multiple = question.answers.length > 1;
          return (
            <form className="border-b border-white/20 pb-5" key={key} onSubmit={(event) => {
              event.preventDefault();
              const correct = selected.length === question.answers.length && question.answers.every((answer) => selected.includes(answer));
              setErrors((current) => ({ ...current, [key]: !correct }));
              if (correct) setProgress((current) => current.map((value, index) => index === activeTheme ? Math.max(value, questionIndex + 1) : value));
            }}>
              <fieldset disabled={solved}>
                <legend className="mb-3 text-base font-black leading-7">{questionIndex + 1}. {question.text}</legend>
                <div className="grid gap-2">
                  {question.options.map((option, optionIndex) => (
                    <label className={`flex min-h-12 items-center gap-3 rounded border px-3 py-2 text-sm font-bold leading-6 ${selected.includes(optionIndex) ? "border-brass bg-brass/15" : "border-white/20"} ${solved ? "" : "cursor-pointer hover:bg-white/10"}`} key={option}>
                      <input checked={selected.includes(optionIndex)} className="h-4 w-4 shrink-0 accent-[#d9ad4a]" name={key} onChange={() => {
                        setSelections((current) => ({ ...current, [key]: multiple ? selected.includes(optionIndex) ? selected.filter((value) => value !== optionIndex) : [...selected, optionIndex] : [optionIndex] }));
                        setErrors((current) => ({ ...current, [key]: false }));
                      }} type={multiple ? "checkbox" : "radio"} />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
              {solved ? <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-300"><Check size={18} />正解</p> : (
                <>
                  {errors[key] ? <p className="mt-3 text-sm font-bold text-red-300" role="alert">もう一度考えてみよう。</p> : null}
                  <button className="mt-3 min-h-11 w-full rounded bg-brass px-4 font-black text-stone-950 hover:bg-yellow-300 disabled:bg-stone-700 disabled:text-stone-400" disabled={selected.length === 0} type="submit">回答する</button>
                </>
              )}
            </form>
          );
        })}
        {progress[activeTheme] === theme.questions.length ? <p className="font-black text-emerald-300">「{theme.title}」の状況整理が完了しました。</p> : null}
      </div>
    </section>
  );
}
