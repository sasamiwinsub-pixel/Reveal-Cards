import Image from "next/image";
import Link from "next/link";
import { Check, Trophy, Share2, ArrowLeft, ChevronDown } from "lucide-react";

const shareUrl = "https://twitter.com/intent/tweet?text=WEB%E8%AC%8E%E3%80%8CReveal%20Cards%E3%80%8D%E3%80%81%E3%82%B2%E3%83%BC%E3%83%A0%E3%82%AF%E3%83%AA%E3%82%A2%EF%BC%81%0A%E8%AC%8E%E8%A7%A3%E3%81%8D%E5%8A%9B%E3%81%A83%E3%81%A4%E3%81%AE%E8%83%BD%E5%8A%9B%E3%82%92%E9%A7%86%E4%BD%BF%E3%81%97%E3%81%A6%E3%80%81%E5%85%A8%E3%81%A6%E3%81%AE%E3%82%AB%E3%83%BC%E3%83%89%E3%82%B2%E3%83%BC%E3%83%A0%E3%81%AB%E5%8B%9D%E5%88%A9%E3%81%97%E3%81%9F%EF%BC%81%0A%23RevealCards%E8%AC%8E%0Ahttps%3A%2F%2Freveal-cards-orpin.vercel.app%2F&openExternalBrowser=1";

export default function ClearScreen() {
  return (
    <main className="min-h-screen bg-[#071b12] text-white">
      <section className="relative flex min-h-[65svh] items-center justify-center overflow-hidden px-5 py-16">
        <Image alt="Reveal Cardsのトランプの裏面" className="object-cover" fill priority sizes="100vw" src="/card-back-background.png" />
        <div aria-hidden="true" className="absolute inset-0 bg-black/75" />
        <div className="relative text-center">
          <Trophy aria-hidden="true" className="mx-auto mb-5 text-brass" size={56} />
          <p className="mb-3 text-lg font-black text-brass">Reveal Cards</p>
          <h1 className="text-4xl font-black leading-tight sm:text-6xl">ゲームクリア！</h1>
          <p className="mt-6 text-lg font-black leading-8 text-yellow-200">全てのゲームで勝利しました。</p>
          <p className="mt-3 text-sm font-bold leading-7 sm:text-base">Reveal Cardsをプレイしていただき、<br />ありがとうございました。</p>
        </div>
      </section>
      <section className="mx-auto max-w-xl px-5 py-8">
        <div className="grid gap-3 border-y border-white/20 py-5">
          {["ハイ＆ロー 勝利", "ブラックジャック 勝利", "ポーカー 勝利"].map((result) => (
            <p className="flex items-center gap-3 font-bold" key={result}><Check className="shrink-0 text-emerald-300" size={20} />{result}</p>
          ))}
        </div>
        <div className="mt-6 divide-y divide-white/20 border-y border-white/20">
          <details className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-4 font-black text-brass [&::-webkit-details-marker]:hidden">
              ファイナルステージ解説
              <ChevronDown aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" size={20} />
            </summary>
            <div className="grid gap-3 pb-5 text-sm font-bold leading-7 text-stone-100">
              <p>ポーカーロボットがテーブルを監視していることにより、他ゲームでフィールドに置かれたカードも監視されていることが判明します。</p>
              <p>ただし、手で覆っている最中にエクスチェンジを発動すると、変化した瞬間を目視で捉えられず、イカサマがバレないことも判明しました。</p>
            </div>
          </details>
          <details className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-4 font-black text-brass [&::-webkit-details-marker]:hidden">
              ファイナルステージもう1戦解説
              <ChevronDown aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" size={20} />
            </summary>
            <div className="grid gap-3 pb-5 text-sm font-bold leading-7 text-stone-100">
              <p>小謎スキャンで生成できたのはAとJの2枚のみ。Kのフォーカード以外で勝ち目がなく、生成したKとエクスチェンジしないとイカサマがバレてしまいます。</p>
              <p>そこで、コピーペースト機能を用いて現物スキャンの仕様を改変することでKを生成することができました。その際、平仮名でのみ文章の区切れを変えることができ、「にじゅういち」と読むことができます。</p>
            </div>
          </details>
        </div>
        <a className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 rounded border border-white/30 bg-white/5 text-base font-black" href={shareUrl} target="_blank" rel="noopener noreferrer"><Share2 aria-hidden="true" size={20} />Xにポスト</a>
        <Link className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded border border-brass/50 text-sm font-black text-brass hover:bg-brass/10" href="/"><ArrowLeft aria-hidden="true" size={18} />トップへ</Link>
      </section>
      <footer className="mx-auto max-w-xl px-5 pb-12 text-center text-sm leading-7 text-stone-200">
        <div className="grid gap-6 border-t border-white/20 pt-8">
          <div>
            <h2 className="mb-2 font-black text-brass">制作</h2>
            <p>ささみカツ@謎解き</p>
          </div>
          <div>
            <h2 className="mb-2 font-black text-brass">テストプレイ協力</h2>
            <ul className="grid gap-1">
              <li>まいたけ 三度の謎と謎解きが好き</li>
              <li>Lexer</li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}
