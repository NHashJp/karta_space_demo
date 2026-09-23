"use client";

import { formatFuzzyDate } from "@/lib/fuzzyDate";
import type { ClientMemory } from "@/lib/clientCard";

type Props = {
  memories: ClientMemory[];
  active: number;
  /** The memory's text appears only once the camera has arrived (§6.5). */
  revealed: boolean;
  onBack: () => void;
};

/**
 * The chrome along the trail: where you are in it, how to go further back, and
 * the way out (spec v0.2 §9.2).
 *
 * The progress dots run newest to oldest, left to right, because that is the
 * direction the reader travels — the trail is read backwards in time, and the
 * dots should not quietly disagree with the camera about which way that is.
 */
export function TrailOverlay({ memories, active, revealed, onBack }: Props) {
  const memory = memories[active];
  const oldest = active === memories.length - 1;

  return (
    <div className="trail-ui">
      <div className="trail-ui__progress" aria-hidden="true">
        {memories.map((_, index) => (
          <span key={index} className="trail-ui__dot" data-active={index === active} />
        ))}
      </div>

      <div className="trail-ui__memory" data-visible={revealed}>
        {memory ? (
          <>
            <p className="trail-ui__date" lang="ja">
              {formatFuzzyDate(memory.date, memory)}
            </p>
            <h2 className="trail-ui__title" lang="ja">
              {memory.title}
            </h2>
            {memory.caption ? (
              <p className="trail-ui__caption" lang="ja">
                {memory.caption}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <p className="trail-ui__hint" data-visible={revealed && !oldest} lang="ja">
        スクロールで、さらに昔へ
      </p>

      <button className="button button--quiet trail-ui__back" onClick={onBack} lang="ja">
        軌道に戻る
      </button>
    </div>
  );
}
