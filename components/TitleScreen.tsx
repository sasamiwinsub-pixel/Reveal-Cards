import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function TitleScreen() {
  return (
    <main className="min-h-screen bg-[#071b12] text-white">
      <section className="relative flex min-h-[100svh] items-end justify-center overflow-hidden px-5 pb-12 sm:pb-16">
        <Image alt="カジノのテーブルで待つ3体のロボット" className="object-cover object-top" fill priority sizes="100vw" src="/robots-three.png" />
        <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
          <h1 className="text-5xl font-black leading-tight text-white [text-shadow:0_3px_12px_#000] sm:text-7xl">Reveal Cards</h1>
          <Link className="mt-7 flex min-h-14 w-full max-w-xs items-center justify-center gap-3 rounded border border-red-200 bg-casinoRed px-6 py-4 text-lg font-black text-white shadow-lg transition-colors hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300" href="/?stage=1&tutorial=venue">
            ゲームスタート<ArrowRight aria-hidden="true" size={22} />
          </Link>
        </div>
      </section>
    </main>
  );
}
