"use client";

import { useLang, useStrings } from "./LangContext";
import { Panel } from "./Panel";

/**
 * What KARTA_SPACE is for, in a few lines (the orbit view's "?").
 *
 * A briefing, not a manual: the orbit view already shows what can be done,
 * and every feature in it is a real object that explains itself (spec v0.2 §2,
 * principle 3). What it cannot show is *why* — so this is the core idea and
 * the handful of values the whole card is built on, in the reader's language,
 * each one something they can see or feel in the card they are holding.
 *
 * Drawn from the design principles (spec v0.2 §2, amended by r7) rather than
 * written fresh, so the panel and the product say the same thing. The words
 * themselves are in `lib/i18n.ts`, in the card's language.
 */

export function AboutPanel({ onClose }: { onClose: () => void }) {
  const t = useStrings();
  const lang = useLang();
  return (
    <Panel title={t.about.title} place="high" divided onClose={onClose}>
      <div className="about" lang={lang}>
        <p className="about__lead">{t.about.lead}</p>
        <p className="about__intro">
          {t.about.intro}
          {t.about.more}<a href="https://karta.space/ja/spec" target="_blank" rel="noopener noreferrer"></a>
        </p>

        <ol className="about__values">
          {t.about.values.map((value, index) => (
            <li key={value.title} className="about__value">
              <span className="about__index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="about__title">{value.title}</h3>
                <p className="about__body">{value.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}
