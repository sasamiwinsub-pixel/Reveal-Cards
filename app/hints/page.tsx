import type { Metadata } from "next";
import { ChevronRight, Lightbulb } from "lucide-react";
import { hintStages } from "@/lib/hints";
import styles from "./hints.module.css";

export const metadata: Metadata = {
  title: "ヒント | Reveal Cards",
  description: "Reveal Cardsのステージ別ヒント。",
  alternates: { canonical: "/hints" },
  robots: { index: false, follow: false },
};

export default function HintsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.brand}>Reveal Cards</a>
        <h1><Lightbulb aria-hidden="true" size={24} />ヒントページ</h1>
      </header>
      <div className={styles.stages}>
        {hintStages.map((stage) => (
          <details className={`${styles.accordion} ${styles.stage}`} key={stage.title}>
            <summary><ChevronRight aria-hidden="true" className={styles.chevron} size={22} /><h2>{stage.title}</h2></summary>
            <div className={styles.nested}>
              {stage.description ? <p className={styles.answer}>{stage.description}</p> : null}
              {stage.battles.map((battle) => (
                <details className={`${styles.accordion} ${styles.battle}`} key={battle.title}>
                  <summary><ChevronRight aria-hidden="true" className={styles.chevron} size={20} /><h3>{battle.title}</h3></summary>
                  <div className={styles.nested}>
                    {battle.groups.map((group) => (
                      <details className={`${styles.accordion} ${styles.group}`} key={group.title}>
                        <summary><ChevronRight aria-hidden="true" className={styles.chevron} size={18} /><h4>{group.title}</h4></summary>
                        <div className={styles.nested}>
                          {group.lines.map((line, index) => (
                            <details className={`${styles.accordion} ${styles.line}`} key={index}>
                              <summary><ChevronRight aria-hidden="true" className={styles.chevron} size={16} /><span>ヒント{index + 1}</span></summary>
                              <p className={styles.answer}>{line}</p>
                            </details>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
