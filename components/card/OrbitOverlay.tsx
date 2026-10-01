"use client";

import { useEffect, useState } from "react";
import { SocialLinks } from "./SocialLinks";
import { ChevronLeftIcon } from "./Icons";
import { hubTargets } from "@/components/three/framing";
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
  /** Dock, and carry on inside the cube — where 中をのぞく also leads. */
  onEnterSatellite: () => void;
  /** There is a line written inside this cube; without one there is nothing
   *  to look into, and the satellite offers the letter itself instead. */
  hasSecret: boolean;
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
  onEnterSatellite,
  hasSecret,
}: Props) {
  const [tip, setTip] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTip(false), ORBIT_TIP_MS);
    return () => clearTimeout(timer);
  }, []);

  /*
   * Where the satellite actually is on screen.
   *
   * `hubTargets` is the composition the camera is *solved from* (rev 6 §3.1)
   * — the same fractions that decide where the body lands in the frame — so
   * taking the label's position from it means the two cannot drift apart. A
   * hand-picked percentage would have been right at one aspect ratio and
   * wrong at the other, which is how the label ended up floating in empty
   * space below the satellite on a phone.
   */
  const [centre, setCentre] = useState<[number, number]>(() => hubTargets(1).centre);
  useEffect(() => {
    const update = () => setCentre(hubTargets(window.innerWidth / window.innerHeight).centre);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
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
        The satellite *is* the letter, so the label sits **on** it rather than
        floating beneath it: it reads as naming the thing under the cursor,
        which is the whole point of it. It appears on hover, so it is an
        answer to someone looking rather than another label on the sky.

        Where it leads depends on what the cube has in it. With a line written
        inside, looking into the satellite means the same thing 中をのぞく
        means on the closing screen, and says so in the same words — two names
        for one destination is how a reader ends up thinking there are two.
        Without one there is nothing in there, so it offers the letter.
      */}
      <div
        className="orbit-ui__reread"
        style={{
          ["--sat-x" as string]: `${centre[0] * 100}%`,
          ["--sat-y" as string]: `${centre[1] * 100}%`,
        }}
      >
        <button
          className="button button--quiet"
          onClick={hasSecret ? onEnterSatellite : onDock}
          tabIndex={-1}
          lang="ja"
        >
          {hasSecret ? "中をのぞく" : "手紙を読みかえす"}
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
