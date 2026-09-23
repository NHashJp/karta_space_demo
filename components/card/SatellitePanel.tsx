"use client";

import { Panel } from "./Panel";
import { formatFuzzyDate } from "@/lib/fuzzyDate";
import type { ClientCard } from "@/lib/clientCard";

/**
 * The satellite (spec v0.2 §8.4).
 *
 * One promise, its date, and how long there is to wait — and then one line
 * that does more work than the rest of the panel: **the sender will be in
 * touch**. There is deliberately no calendar button and no reminder to the
 * receiver. A card that put a date in someone's calendar would be asking them
 * to keep the promise; this tells them it is being kept for them.
 */
export function SatellitePanel({ card, onClose }: { card: ClientCard; onClose: () => void }) {
  const satellite = card.satellite;
  if (!satellite) return null;

  const returned = card.satelliteStatus === "returned";
  const date = card.satelliteNext ?? satellite.date;

  return (
    <Panel title="衛星" onClose={onClose}>
      <p className="satellite__message" lang="ja">
        {satellite.message}
      </p>

      <p className="satellite__when" lang="ja">
        {returned ? (
          "この日が、来ましたね。"
        ) : (
          <>
            <span className="satellite__date">{formatFuzzyDate(date)}</span>
            {typeof card.daysUntil === "number" ? (
              <>
                <span className="satellite__dot" aria-hidden="true">
                  ·
                </span>
                <span className="satellite__countdown">あと{card.daysUntil}日</span>
              </>
            ) : null}
          </>
        )}
      </p>

      {/*
        Hidden once the day has come: on the day itself, "they will be in
        touch" is either already true or overdue, and saying it then would
        turn a kept promise into a reminder of an unkept one.
      */}
      {returned ? null : (
        <p className="satellite__contact" lang="ja">
          その日が来たら、{card.from}から連絡します。
        </p>
      )}
    </Panel>
  );
}
