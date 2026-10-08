"use client";

import { useLang, useStrings } from "./LangContext";
import { useEffect, useRef, useState } from "react";
import { daysBetween } from "@/lib/orbitClock";
import { daysLeft, previewFrame, showsTheDay, type PreviewFrame } from "@/lib/cometPreview";
import type { ClientCard } from "@/lib/clientCard";

/**
 * The words over the first-launch intro (`lib/cometPreview`).
 *
 * First the promise in plain numbers — あと X 日で、また会えます — alone in
 * the middle of the screen. Then, over the dashed way home, the same number
 * counting down as the ghost runs it, and at zero, what that day is for: the
 * words put on the comet arrive with it. Only then does the sheet ask for any.
 *
 * It owns the timeline's end, because it is the half that can be skipped.
 */
export function CometIntro({
  card,
  reducedMotion,
  onDay,
  onDone,
}: {
  card: ClientCard;
  reducedMotion: boolean;
  /**
   * The intro is showing the reunion morning itself, so the scene can put on
   * what it wears that day — the warm light, the meteors — and take it off
   * again as it rewinds.
   */
  onDay: (day: boolean) => void;
  onDone: () => void;
}) {
  const t = useStrings();
  const lang = useLang();
  const comet = card.comet;
  const days = comet ? Math.max(0, daysBetween(card.today, comet.returnsOn)) : 0;

  const [frame, setFrame] = useState<PreviewFrame>(() => previewFrame(0, reducedMotion));
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let finished = false;
    const tick = () => {
      const next = previewFrame(performance.now() - start, reducedMotion);
      setFrame(next);
      if (next.done) {
        if (!finished) {
          finished = true;
          done.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const day = showsTheDay(frame);
  useEffect(() => {
    onDay(day);
  }, [day, onDay]);

  if (!comet) return null;

  const left = daysLeft(days, frame.run);
  /*
   * The promise in the sender's own words, as entered in the editor — the
   * same line the chart and the hub caption carry — rather than a sentence
   * of the card's own. Only a card with no promise falls back to one.
   */
  const promise = comet.promise?.trim() || t.intro.fallbackPromise;

  return (
    <div className="comet-intro" data-out={frame.out > 0} data-started={frame.started} lang={lang}>
      {/* The promise, alone, before anything moves. */}
      <div className="comet-intro__announce" aria-hidden={frame.started}>
        <p className="chart-head__label">{t.intro.label}</p>
        <p className="comet-intro__count">
          {t.intro.daysBefore}
          <span className="comet-intro__days">{days}</span>
          {t.intro.daysAfter(days)}
        </p>
        <p className="comet-intro__promise">{promise}</p>
      </div>

      <header className="chart-head comet-intro__head" aria-hidden={!frame.started}>
        <p className="chart-head__label">{t.intro.label}</p>
        <p className="comet-intro__lead" data-visible={!frame.arrived}>
          {t.intro.untilBack}
        </p>
        <p className="comet-intro__count" aria-live="polite">
          {frame.arrived ? (
            t.intro.arrived
          ) : (
            <>
              {t.intro.daysBefore}
              <span className="comet-intro__days">{left}</span>
              {t.intro.daysAfter(left)}
            </>
          )}
        </p>
        <p className="comet-intro__note" data-visible={frame.arrived}>
          {comet.capsule
            ? t.intro.wordsArrive(card.from)
            : t.intro.promiseOpens(card.from)}
        </p>
      </header>

      <button className="button button--quiet comet-intro__skip" onClick={onDone}>
        {t.intro.skip}
      </button>
    </div>
  );
}
