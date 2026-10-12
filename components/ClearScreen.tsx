import Image from "next/image";
import Link from "next/link";
import { Check, Trophy, Share2, ArrowLeft } from "lucide-react";

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
        <button className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 rounded border border-white/30 bg-white/5 text-base font-black" type="button"><Share2 aria-hidden="true" size={20} />Xにポスト</button>
        <Link className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded border border-brass/50 text-sm font-black text-brass hover:bg-brass/10" href="/"><ArrowLeft aria-hidden="true" size={18} />トップへ</Link>
      </section>
    </main>
  );
}
