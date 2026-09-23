"use client";

import { useEffect, useState } from "react";
import { SocialLinks } from "./SocialLinks";
import { ORBIT_TIP_MS } from "@/lib/timing";
import type { OrbitPanel } from "@/lib/experienceState";
import type { ClientCard } from "@/lib/clientCard";

type Props = {
  card: ClientCard;
  panel: OrbitPanel;
  launched: boolean;
  onOpenPanel: (panel: Exclude<OrbitPanel, null>) => void;
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
  onOpenPanel,
  onLookBack,
  onDock,
}: Props) {
  const [tip, setTip] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTip(false), ORBIT_TIP_MS);
    return () => clearTimeout(timer);
  }, []);

  const hasComet = Boolean(card.senderComet || card.receiverComet);
  const busy = panel !== null;

  return (
    <div className="orbit-ui" data-panel={panel ?? "none"}>
      <p className="orbit-ui__tip" data-visible={tip && !busy} lang="ja">
        星をタップしてみてください。
      </p>

      <nav className="orbit-bar" aria-label="軌道">
        {card.satellite ? (
          <button
            className="button button--quiet"
            onClick={() => onOpenPanel("satellite")}
            aria-pressed={panel === "satellite"}
            lang="ja"
          >
            衛星
          </button>
        ) : null}

        {card.memories?.length ? (
          <button className="button button--quiet" onClick={onLookBack} lang="ja">
            航跡をたどる
          </button>
        ) : null}

        {hasComet ? (
          <button
            className="button button--quiet"
            onClick={() => onOpenPanel("comet")}
            aria-pressed={panel === "comet"}
            lang="ja"
          >
            彗星
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

        <button className="button button--quiet" onClick={onDock} lang="ja">
          手紙に戻る
        </button>
      </nav>

      {card.social ? <SocialLinks links={card.social} /> : null}
    </div>
  );
}
