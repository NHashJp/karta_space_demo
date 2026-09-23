"use client";

import { useState } from "react";
import { Panel } from "./Panel";
import { CometOrbitMini } from "./CometOrbitMini";
import { MessageForm } from "./MessageForm";
import { COMET_MAX } from "@/lib/submission";
import type { ReleasedComet } from "@/lib/localMarks";
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
  released,
  onClose,
  onReleased,
}: {
  card: ClientCard;
  /** The card's civil today, so the diagram agrees with the server. */
  today: string;
  /** The receiver has already sent one, in this session or an earlier visit. */
  released: ReleasedComet | null;
  onClose: () => void;
  /** Dispatched only after the server has accepted the comet (§11.3). */
  onReleased: (comet: ReleasedComet, token?: string) => void;
}) {
  const comet = card.senderComet;
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

      {/* B: release your own — until you have. */}
      {card.receiverComet?.available && !released ? (
        <section className="comet-section comet-section--release">
          <p className="comet__headline" lang="ja">
            あなたも、彗星を放つ
          </p>
          {/*
            The seal, said out loud before anyone commits to it. Someone about
            to write something they cannot take back deserves to know that is
            what they are doing.
          */}
          <p className="comet__note" lang="ja">
            {formatFuzzyDate(card.receiverComet.returnsOn)}に戻ってくるまで、
            {card.from}にも読めません。
          </p>

          <MessageForm
            endpoint={`/c/${card.slug}/comet`}
            messageMax={COMET_MAX}
            submitLabel="彗星に託す"
            sendingLabel="放っています…"
            onSent={(token, extra) => {
              const sent = {
                releasedOn: (extra?.releasedOn as string) ?? today,
                returnsOn: card.receiverComet!.returnsOn,
              };
              if (token) setLink(`${window.location.origin}/comet/${token}`);
              onReleased(sent, token);
            }}
          />
        </section>
      ) : null}

      {/* C: and afterwards, where it has gone. */}
      {released ? (
        <section className="comet-section comet-section--sent">
          <CometOrbitMini
            progress={cometProgress(released.releasedOn, released.returnsOn, today)}
            tone="receiver"
            label={formatFuzzyDate(released.returnsOn)}
          />
          <p className="comet__headline" lang="ja">
            彗星を放ちました。{formatFuzzyDate(released.returnsOn)}に、
            {card.from}のもとへ戻ってきます。
          </p>

          {/*
            Offered, never done automatically. The link *is* the message, and
            putting a copy of it on someone's clipboard — or in their browser
            storage — without being asked is not our call to make.
          */}
          {link ? (
            <button
              className="button button--quiet"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
              lang="ja"
            >
              {copied ? "コピーしました" : "彗星の行方を見るリンクをコピー"}
            </button>
          ) : null}
        </section>
      ) : null}
    </Panel>
  );
}
