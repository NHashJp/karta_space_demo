"use client";

import { useLang, useStrings } from "./LangContext";
import { Panel } from "./Panel";
import { CometTrajectory } from "./CometTrajectory";
import { LockIcon } from "./Icons";
import { formatReturn } from "@/lib/returnLabel";
import { progress as cometProgress } from "@/lib/cometOrbit";
import type { ClientCard } from "@/lib/clientCard";

/**
 * Where the comet is, and when it comes back (mockup M12c).
 *
 * The sky answers "which light is it" and nothing else. This answers the
 * question the departure actually leaves behind — *when* — and it answers it
 * with a picture rather than a date, because "2026年12月25日" is a fact and a
 * dashed ellipse with a dot two thirds of the way round it is a feeling about
 * how far away that is.
 *
 * Reached from the crossroads, and from the comet sheet. Both are places the
 * reader has just been shown the comet and has nowhere to put it.
 */
export function TrajectoryPanel({
  card,
  aboard,
  onClose,
}: {
  card: ClientCard;
  /** Their words are on it, so the drawing is warm rather than ion-blue. */
  aboard: boolean;
  onClose: () => void;
}) {
  const t = useStrings();
  const lang = useLang();
  const comet = card.comet;
  if (!comet) return null;

  const returned = comet.status !== "away";

  return (
    <Panel title={t.trajectory.title} onClose={onClose}>
      <div className="trajectory-panel">
        <CometTrajectory
          progress={cometProgress(comet.leftOn, comet.returnsOn, card.today)}
          tone={aboard ? "receiver" : "sender"}
          returnLabel={comet.label.label}
          returned={returned}
        />

        <p className="trajectory-panel__when" lang={lang}>
          {formatReturn(comet.label)}
        </p>

        {/*
          What is on it. The drawing says when; this says why anyone should
          care that it is coming back at all.
        */}
        {comet.promise && !returned ? (
          <p className="sheet__sealed">
            <LockIcon />
            {aboard
              ? t.trajectory.bothAboard(card.from)
              : t.trajectory.sealed(card.from)}
          </p>
        ) : null}

        <div className="sheet__actions">
          <button className="button button--wide" onClick={onClose} lang={lang}>
            {t.sheet.toOrbit}
          </button>
        </div>
      </div>
    </Panel>
  );
}
