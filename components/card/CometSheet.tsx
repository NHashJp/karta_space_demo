"use client";

import { useState } from "react";
import { MessageForm } from "./MessageForm";
import { formatReturn } from "@/lib/returnLabel";
import { COMET_MAX } from "@/lib/submission";
import type { ClientCard } from "@/lib/clientCard";

/**
 * The comet sheet (spec v0.2 rev 5, §8.6).
 *
 * It opens on the chart, at the end of the comet moment, and says one of four
 * things depending on where the comet is in its life:
 *
 * - **arrival** — it is back, and the sender's words are readable at last;
 * - **invite** — it is on its way and has room for the receiver's words;
 * - **aboard** — their words are already on it, and here is where it has got to;
 * - **kept** — it came back, the promise was kept, and this is the keepsake.
 *
 * There is no countdown in days unless the promise itself is day-precise. The
 * chart behind this sheet already shows how far away the comet is, and a
 * number would only invite the reader to stop looking at it.
 */

type Props = {
  card: ClientCard;
  /** Their words are on it: this session, or an earlier visit in this browser. */
  aboard: boolean;
  onBoarded: (token?: string) => void;
  onLeave: () => void;
};

export function CometSheet({ card, aboard, onBoarded, onLeave }: Props) {
  const comet = card.comet;
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!comet) return null;

  const when = formatReturn(comet.label);
  const returned = comet.status === "returned";
  const kept = comet.status === "kept";

  return (
    <div
      className="sheet-layer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onLeave();
      }}
    >
      <section className="sheet" role="dialog" aria-modal="true" aria-label="彗星" lang="ja">
        <header className="sheet__head">
          <p className="sheet__when">{when}</p>
          <button className="panel__close" onClick={onLeave} aria-label="閉じる">
            ✕
          </button>
        </header>

        {comet.promise ? <p className="sheet__promise">{comet.promise}</p> : null}

        {/* ---- the comet is back: the words open ------------------------- */}
        {(returned || kept) && comet.message ? (
          <>
            <p className="sheet__from">{card.from}からの言葉</p>
            <p className="comet__message">{comet.message}</p>
          </>
        ) : null}

        {kept && !comet.message ? (
          <p className="sheet__note">この彗星は、約束を果たしました。</p>
        ) : null}

        {/* ---- it is still on its way, and has room ---------------------- */}
        {comet.capsule && !aboard ? (
          <>
            <p className="sheet__invite">あなたの言葉も、のせていきませんか。</p>
            {/*
              The seal, said out loud before anyone commits to it. Someone
              about to write something they cannot take back deserves to know
              that is what they are doing.
            */}
            <p className="comet__note">
              {comet.label.label}に戻ってくるまで、{card.from}にも読めません。
            </p>

            <MessageForm
              endpoint={`/c/${card.slug}/comet`}
              messageMax={COMET_MAX}
              submitLabel="彗星に託す"
              sendingLabel="のせています…"
              onSent={(token) => {
                if (token) setLink(`${window.location.origin}/comet/${token}`);
                onBoarded(token);
              }}
            />

            <button className="button button--quiet" onClick={onLeave}>
              今はやめておく
            </button>
          </>
        ) : null}

        {/* ---- their words are aboard ------------------------------------ */}
        {aboard ? (
          <>
            <p className="sheet__aboard">
              あなたの言葉は、彗星の上にあります。
            </p>
            {link ? (
              // Offered, never done automatically. The link *is* the message,
              // and putting a copy of it on someone's clipboard without being
              // asked is not our call.
              <button
                className="button button--quiet"
                onClick={() => {
                  void navigator.clipboard?.writeText(link).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
              >
                {copied ? "コピーしました" : "彗星の行方を見るリンクをコピー"}
              </button>
            ) : null}
            <button className="button button--quiet" onClick={onLeave}>
              つづける
            </button>
          </>
        ) : null}

        {/* Nothing to write and nothing to read: just the way back. */}
        {!comet.capsule && !aboard && !((returned || kept) && comet.message) ? (
          <button className="button button--quiet" onClick={onLeave}>
            軌道へもどる
          </button>
        ) : null}
      </section>
    </div>
  );
}
