"use client";

import { Panel } from "./Panel";
import { ChevronRightIcon, CometIcon, RocketIcon, TrailIcon } from "./Icons";
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
  onTrajectory,
  onClose,
}: {
  card: ClientCard;
  onLookBack: () => void;
  onReply: () => void;
  onTrajectory: () => void;
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
              <span className="crossroads__name">ロケットを打ち上げる</span>
              <span className="crossroads__cost">彗星より先に、今すぐ{card.from}へ</span>
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

        {/*
          The third way on: the comet they have just watched leave. The sky
          can only show where it is now — a speck — so this opens the drawing
          that says when it comes back, which is the question the departure
          puts in the reader's head and then does not answer.
        */}
        {card.comet ? (
          <button className="crossroads__choice" onClick={onTrajectory} lang="ja">
            <CometIcon className="crossroads__icon" />
            <span className="crossroads__text">
              <span className="crossroads__name">彗星の軌道を見る</span>
              <span className="crossroads__cost">{card.comet.label.label}に戻ります</span>
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
