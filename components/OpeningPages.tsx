import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const startLinkClass = "flex min-h-14 w-full max-w-xs items-center justify-center gap-3 rounded border border-red-200 bg-casinoRed px-6 py-4 text-lg font-black text-white shadow-lg hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300";

export function OpeningScreen() {
  return (
    <main className="min-h-screen bg-[#071b12] text-white">
      <section className="relative flex h-[70svh] min-h-[480px] items-center justify-center overflow-hidden px-5">
        <Image alt="トランプ1枚の裏面" className="object-cover object-center" fill priority sizes="100vw" src="/card-back-background.png" />
        <div aria-hidden="true" className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
          <h1 className="text-5xl font-black leading-tight text-[#ffe8a3] [-webkit-text-stroke:1px_#25100e] [paint-order:stroke_fill] [text-shadow:0_3px_0_#25100e,0_5px_12px_#000] sm:text-7xl">Reveal Cards</h1>
        </div>
      </section>
      <section className="border-t border-white/20 px-5 py-8 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-lg font-black text-brass">注意事項</h2>
          <ul className="grid list-disc gap-3 pl-5 text-sm font-bold leading-7 text-stone-100 sm:text-base">
            <li>ヒントは画面右上のメニューボタンからいつでも閲覧可能です</li>
            <li>URLの変更やソースコードの閲覧は不要です</li>
            <li>配信での使用もご自由にどうぞ（連絡不要）</li>
            <li>LINEやXなどのアプリ内ブラウザでは動作しない可能性がございます</li>
          </ul>
          <Link className={`${startLinkClass} mx-auto mt-8`} href="/?screen=introduction">始める<ArrowRight aria-hidden="true" size={22} /></Link>
        </div>
      </section>
    </main>
  );
}

export function IntroductionScreen() {
  return (
    <main className="flex min-h-[100svh] items-center bg-[#071b12] px-6 py-12 text-white sm:py-20">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="mb-8 text-3xl font-black text-brass sm:text-4xl">Reveal Cards</h1>
        <div className="grid gap-6 text-base font-bold leading-8 sm:text-lg sm:leading-9">
          <p>これからブラウザゲーム「Reveal Cards」をプレイしていただきます。</p>
          <p>このゲームはAKQJの4種4枚ずつの16枚の山札で行われ、3つのゲームと3つの能力が登場します。</p>
          <p>特段ストーリーはないため、ゲームの運営を行う天の声に従いながら進めてください。ファイナルステージに勝利することが唯一の目標です。</p>
          <p className="text-red-300">ファイナルステージの内容と能力は1stStage～3rdStageで段々と明かされていきます。</p>
          <p>クリアを目指して頑張ってください。</p>
        </div>
        <Link className={`${startLinkClass} mt-10`} href="/?screen=title">タイトル画面へ<ArrowRight aria-hidden="true" size={22} /></Link>
      </div>
    </main>
  );
}
