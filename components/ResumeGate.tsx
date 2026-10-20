"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { clearGameProgress } from "@/lib/session-state";
import { consumeInternalNavigation, getResumeCheckpoint, markInternalNavigation, normalizeGameUrl, type ResumeCheckpoint } from "@/lib/resume-progress";

export default function ResumeGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [checkpoint, setCheckpoint] = useState<ResumeCheckpoint | null>(null);
  const checked = useRef(false);
  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (disposed || checked.current) return;
      checked.current = true;
      const current = normalizeGameUrl(window.location.href);
      const internal = consumeInternalNavigation(window.location.href);
      const saved = current === null ? null : getResumeCheckpoint();
      if (saved && saved.url !== current && !internal) setCheckpoint(saved);
      else setReady(true);
    });
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (anchor && (!anchor.target || anchor.target === "_self") && !anchor.hasAttribute("download")) markInternalNavigation(anchor.href);
    };
    // In-page React links have already called preventDefault by this point.
    document.addEventListener("click", onClick);
    return () => {
      disposed = true;
      document.removeEventListener("click", onClick);
    };
  }, []);

  if (checkpoint) return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-labelledby="resume-heading" aria-describedby="resume-description">
      <section className="w-full max-w-lg rounded border border-brass bg-[#071b12] p-5 text-white shadow-2xl sm:p-6">
        <h2 id="resume-heading" className="text-xl font-black leading-8 text-brass">続きから再開しますか？</h2>
        <p id="resume-description" className="mt-3 text-sm font-bold leading-7">保存された進捗があります。「はい」で最も進んだところから再開します。「いいえ」を選ぶと保存済みの進捗をすべて破棄し、このページの初期状態から始めます。</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button autoFocus className="min-h-12 rounded bg-brass px-4 py-3 font-black text-stone-950" onClick={() => {
            markInternalNavigation(checkpoint.url);
            window.location.replace(checkpoint.url);
          }} type="button">はい</button>
          <button className="min-h-12 rounded border border-white/30 px-4 py-3 font-bold" onClick={() => {
            clearGameProgress();
            setCheckpoint(null);
            setReady(true);
          }} type="button">いいえ（進捗を破棄）</button>
        </div>
      </section>
    </div>
  );
  return ready ? children : <div className="min-h-screen bg-[#071b12]" />;
}
