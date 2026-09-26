"use client";

import { useEffect, useState } from "react";
import { SocialLinks } from "./SocialLinks";
import { ChevronLeftIcon } from "./Icons";
import { ORBIT_TIP_MS } from "@/lib/timing";
import type { OrbitPanel } from "@/lib/experienceState";
import type { ClientCard } from "@/lib/clientCard";

type Props = {
  card: ClientCard;
  panel: OrbitPanel;
  launched: boolean;
  /** Their words are already on the comet, so the chip says where it is. */
  aboard: boolean;
  onOpenPanel: (panel: Exclude<OrbitPanel, null>) => void;
  onOpenChart: () => void;
  onLookBack: () => void;
  onDock: () => void;
};

/**
 * The orbit view's chrome: a bottom bar naming everything in the sky, and the
 * social links, which move here off the closing screen when a card has an
 * orbit (spec v0.2 §8.1, §8.3).
 *
 * The bar is not a menu bolted onto a 3D scene — every object in orbit is
 * tappable, and this is its keyboard-and-screen-reader equivalent. So it lists
 * exactly what is up there and nothing else: a card with no comet has no comet
 * button, and the sky it describes is the sky you can see.
 */
export function OrbitOverlay({
  card,
  panel,
  launched,
  aboard,
  onOpenPanel,
  onOpenChart,
  onLookBack,
  onDock,
}: Props) {
  const [tip, setTip] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTip(false), ORBIT_TIP_MS);
    return () => clearTimeout(timer);
  }, []);

  const busy = panel !== null;

  return (
    <div className="orbit-ui" data-panel={panel ?? "none"}>
      <p className="orbit-ui__tip" data-visible={tip && !busy} lang="ja">
        星をタップしてみてください。
      </p>

      {/*
        Where their words got to, on the first arrival in the hub. It is the
        one thing a returning reader most wants to know and the one thing the
        sky cannot say on its own — the comet is a speck out there.
      */}
      {aboard && card.comet ? (
        <p className="orbit-ui__aboard" data-visible={tip && !busy} lang="ja">
          <span>
            <span className="orbit-ui__dot" aria-hidden="true" />
            あなたの言葉は、彗星の上 · {card.comet.label.label}
          </span>
        </p>
      ) : null}

      {/*
        The satellite *is* the letter. On a wide screen that is worth saying
        under it, where the eye already is, rather than only in the bar
        (mockup M5b). It appears on hover, so it is an answer to someone
        looking rather than another label on the sky.
      */}
      <div className="orbit-ui__reread">
        <button className="button button--quiet" onClick={onDock} tabIndex={-1} lang="ja">
          手紙を読みかえす
        </button>
      </div>

      {/*
        Four pills on two rows rather than one long line (M5, M14b). The row
        is capped narrower than the screen so it wraps at the same place on
        every phone, instead of at whatever width the labels happen to reach.
      */}
      <nav className="orbit-bar" aria-label="軌道">
        <div className="orbit-bar__row">
          {card.memories?.length ? (
            <button className="button button--quiet" onClick={onLookBack} lang="ja">
              航跡をたどる
            </button>
          ) : null}

          {card.replyAvailable ? (
            <button
              className="button button--quiet"
              onClick={() => onOpenPanel("reply")}
              aria-pressed={panel === "reply"}
              disabled={launched}
              lang="ja"
            >
              {launched ? "返事は届きました" : "返事を打ち上げる"}
            </button>
          ) : null}

          {card.comet ? (
            <button className="button button--quiet" onClick={onOpenChart} lang="ja">
              彗星
            </button>
          ) : null}

          <button className="button button--quiet" onClick={onDock} lang="ja">
            <ChevronLeftIcon className="orbit-bar__back-cue" />
            手紙に戻る
          </button>
        </div>
      </nav>

      {card.social ? <SocialLinks links={card.social} /> : null}
    </div>
  );
}
