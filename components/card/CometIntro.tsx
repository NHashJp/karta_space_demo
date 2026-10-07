"use client";

import { useEffect, useRef, useState } from "react";
import { daysBetween } from "@/lib/orbitClock";
import { daysLeft, previewFrame, type PreviewFrame } from "@/lib/cometPreview";
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
  onDone,
}: {
  card: ClientCard;
  reducedMotion: boolean;
  onDone: () => void;
}) {
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

  if (!comet) return null;

  const left = daysLeft(days, frame.run);

  return (
    <div className="comet-intro" data-out={frame.out > 0} data-started={frame.started} lang="ja">
      {/* The promise, alone, before anything moves. */}
      <div className="comet-intro__announce" aria-hidden={frame.started}>
        <p className="chart-head__label">約束の彗星</p>
        <p className="comet-intro__count">
          あと<span className="comet-intro__days">{days}</span>日で、また会えます
        </p>
      </div>

      <header className="chart-head comet-intro__head" aria-hidden={!frame.started}>
        <p className="chart-head__label">約束の彗星</p>
        <p className="comet-intro__lead" data-visible={!frame.arrived}>
          彗星が戻るまで
        </p>
        <p className="comet-intro__count" aria-live="polite">
          {frame.arrived ? (
            "また会えました"
          ) : (
            <>
              あと<span className="comet-intro__days">{left}</span>日
            </>
          )}
        </p>
        <p className="comet-intro__note" data-visible={frame.arrived}>
          {comet.capsule
            ? `その日、彗星にのせた言葉が${card.from}に届きます。`
            : `その日、${card.from}との約束がひらきます。`}
        </p>
      </header>

      <button className="button button--quiet comet-intro__skip" onClick={onDone}>
        スキップ
      </button>
    </div>
  );
}
