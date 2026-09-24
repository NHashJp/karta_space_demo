"use client";

import { Panel } from "./Panel";
import type { ClientCard } from "@/lib/clientCard";

/**
 * Where next? (spec v0.2 rev 5, §8.8.)
 *
 * It follows an **automatic** comet moment only — the one the card started
 * after a deployment, not one the reader chose by tapping the comet. Having
 * just been shown something, they are offered the two other things the card
 * holds, and a way to simply stay.
 *
 * It is skipped entirely when there is nothing to offer, which is why
 * `hasCrossroads` exists rather than this component rendering an empty box.
 */
export function CrossroadsPanel({
  card,
  onLookBack,
  onReply,
  onClose,
}: {
  card: ClientCard;
  onLookBack: () => void;
  onReply: () => void;
  onClose: () => void;
}) {
  return (
    <Panel title="このあとは" onClose={onClose}>
      <div className="crossroads">
        {card.memories?.length ? (
          <button className="button button--quiet" onClick={onLookBack} lang="ja">
            航跡をたどる
          </button>
        ) : null}

        {card.replyAvailable ? (
          <button className="button button--quiet" onClick={onReply} lang="ja">
            返事を打ち上げる
          </button>
        ) : null}

        <button className="button button--quiet" onClick={onClose} lang="ja">
          軌道をながめる
        </button>
      </div>
    </Panel>
  );
}
