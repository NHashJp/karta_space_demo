"use client";

import { useLang, useStrings } from "./LangContext";
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
  const t = useStrings();
  const lang = useLang();
  const memories = card.memories?.length ?? 0;

  return (
    <Panel title={t.crossroads.title} onClose={onClose}>
      <div className="crossroads">
        {card.replyAvailable ? (
          <button className="crossroads__choice" onClick={onReply} lang={lang}>
            <RocketIcon className="crossroads__icon" />
            <span className="crossroads__text">
              <span className="crossroads__name">{t.crossroads.rocket}</span>
              <span className="crossroads__cost">{t.crossroads.rocketCost(card.from, Boolean(card.comet))}</span>
            </span>
            <ChevronRightIcon className="crossroads__chevron" />
          </button>
        ) : null}

        {memories > 0 ? (
          <button className="crossroads__choice" onClick={onLookBack} lang={lang}>
            <TrailIcon className="crossroads__icon" />
            <span className="crossroads__text">
              <span className="crossroads__name">{t.crossroads.trail}</span>
              <span className="crossroads__cost">{t.crossroads.memories(memories)}</span>
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
          <button className="crossroads__choice" onClick={onTrajectory} lang={lang}>
            <CometIcon className="crossroads__icon" />
            <span className="crossroads__text">
              <span className="crossroads__name">{t.crossroads.orbit}</span>
              <span className="crossroads__cost">{t.crossroads.returnsAt(card.comet.label.label)}</span>
            </span>
            <ChevronRightIcon className="crossroads__chevron" />
          </button>
        ) : null}

        <div className="crossroads__stay">
          <button className="button button--plain" onClick={onClose} lang={lang}>
            {t.crossroads.stay}
          </button>
        </div>
      </div>
    </Panel>
  );
}
