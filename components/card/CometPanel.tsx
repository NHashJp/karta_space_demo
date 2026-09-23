"use client";

import { Panel } from "./Panel";
import { CometOrbitMini } from "./CometOrbitMini";
import { formatFuzzyDate } from "@/lib/fuzzyDate";
import { progress as cometProgress } from "@/lib/cometOrbit";
import type { ClientCard } from "@/lib/clientCard";

/**
 * The comet panel (spec v0.2 §11.3).
 *
 * Up to three sections: the sender's comet and where it is, the form to
 * release one back, and the confirmation once that is done. The release form
 * arrives in §19 phase 14; this builds everything that only needs the card.
 *
 * Before its return date the sender's message is **not in this component's
 * props**, because it is not in the page payload at all (§14.1). There is no
 * `hidden` class and no conditional render standing between the reader and
 * the text: the text is simply not there yet.
 */
export function CometPanel({
  card,
  today,
  onClose,
}: {
  card: ClientCard;
  /** The card's civil today, so the diagram agrees with the server. */
  today: string;
  onClose: () => void;
}) {
  const comet = card.senderComet;

  return (
    <Panel title="彗星" onClose={onClose}>
      {comet ? (
        <section className="comet-section">
          <CometOrbitMini
            progress={cometProgress(comet.releasedOn, comet.returnsOn, today)}
            label={formatFuzzyDate(comet.returnsOn)}
          />

          {comet.status === "returned" ? (
            <>
              <p className="comet__headline" lang="ja">
                {card.from}の彗星が、戻ってきました。
              </p>
              <p className="comet__meta" lang="ja">
                {formatFuzzyDate(comet.releasedOn.slice(0, 7))}に放たれました
              </p>
              <p className="comet__message" lang="ja">
                {comet.message}
              </p>
            </>
          ) : (
            <>
              <p className="comet__headline" lang="ja">
                {card.from}の彗星
              </p>
              <p className="comet__meta" lang="ja">
                {formatFuzzyDate(comet.returnsOn)}に戻ってきます。
              </p>
              {/*
                No countdown in days here on purpose. The diagram above and the
                speck in the sky behind this panel are both already saying how
                far away it is, and a number would only invite the reader to
                stop looking at them.
              */}
            </>
          )}
        </section>
      ) : null}

      {card.receiverComet?.available ? (
        <section className="comet-section comet-section--release">
          <p className="comet__headline" lang="ja">
            あなたも、彗星を放つ
          </p>
          <p className="comet__note" lang="ja">
            {formatFuzzyDate(card.receiverComet.returnsOn)}に戻ってくるまで、
            {card.from}にも読めません。
          </p>
          <p className="panel__body" lang="ja">
            準備中
          </p>
        </section>
      ) : null}
    </Panel>
  );
}
