"use client";

import { Panel } from "./Panel";
import { ChevronRightIcon, RocketIcon, TrailIcon } from "./Icons";
import type { ClientCard } from "@/lib/clientCard";

/**
 * Where next? (spec v0.2 rev 5, §8.8; mockup M14a.)
 *
 * It follows an **automatic** comet moment only — the one the card started
 * after a deployment, not one the reader chose by tapping the comet. Having
 * just been shown something, they are offered the two other things the card
 * holds, and a way to simply stay.
 *
 * It is skipped entirely when there is nothing to offer, which is why
 * `hasCrossroads` exists rather than this component rendering an empty box.
 *
 * Each way on is a card carrying what it costs — "今すぐ" against "5つの思い出"
 * — rather than a pill carrying only its name. Two identical pills make this a
 * menu to get past; two cards that say what is on the other side make it the
 * choice it is meant to be. Staying is the plain one at the foot, because it
 * is the option that needs no describing.
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
  const memories = card.memories?.length ?? 0;

  return (
    <Panel title="このあとは" onClose={onClose}>
      <div className="crossroads">
        {card.replyAvailable ? (
          <button className="crossroads__choice" onClick={onReply} lang="ja">
            <RocketIcon className="crossroads__icon" />
            <span className="crossroads__text">
              <span className="crossroads__name">ロケットで、返事を</span>
              <span className="crossroads__cost">今すぐ、{card.from}に届きます</span>
            </span>
            <ChevronRightIcon className="crossroads__chevron" />
          </button>
        ) : null}

        {memories > 0 ? (
          <button className="crossroads__choice" onClick={onLookBack} lang="ja">
            <TrailIcon className="crossroads__icon" />
            <span className="crossroads__text">
              <span className="crossroads__name">ふたりの航跡をたどる</span>
              <span className="crossroads__cost">{memories}つの思い出</span>
            </span>
            <ChevronRightIcon className="crossroads__chevron" />
          </button>
        ) : null}

        <div className="crossroads__stay">
          <button className="button button--plain" onClick={onClose} lang="ja">
            軌道にとどまる
          </button>
        </div>
      </div>
    </Panel>
  );
}
