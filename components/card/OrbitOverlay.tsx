"use client";

import { useLang, useStrings } from "./LangContext";
import { useEffect, useState } from "react";
import { SocialLinks } from "./SocialLinks";
import { CheckIcon, ChevronLeftIcon } from "./Icons";
import { hubLabel } from "@/components/three/framing";
import { ORBIT_IDLE_HINT_MS, ORBIT_TIP_MS, REPLY_TOAST_MS } from "@/lib/timing";
import { useIdle } from "@/lib/useFaceNavigation";
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
  /**
   * Where the done reply pill leads (§13: "a tap focuses the reply star").
   * The star is drawn in WebGL and has no DOM node to focus, so what the tap
   * does instead is open the chart — which is where the star and the comet
   * are both on screen and "it got there first" is actually legible.
   */
  onFindReply?: () => void;
  /** The reply has just overtaken the comet: say so, once, for four seconds. */
  overtook?: boolean;
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
  onFindReply,
  overtook = false,
}: Props) {
  const t = useStrings();
  const lang = useLang();
  const [tip, setTip] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTip(false), ORBIT_TIP_MS);
    return () => clearTimeout(timer);
  }, []);

  /*
   * Where the satellite actually is on screen.
   *
   * `hubLabel` is built from the composition the camera is *solved from*
   * — the same fractions that decide where the body lands in the frame — so
   * taking the label's position from it means the two cannot drift apart. A
   * hand-picked percentage would have been right at one aspect ratio and
   * wrong at the other, which is how the label ended up floating in empty
   * space below the satellite on a phone.
   */
  const [label, setLabel] = useState(() => hubLabel(1));
  useEffect(() => {
    const update = () => setLabel(hubLabel(window.innerWidth / window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const centre = label.centre;

  /*
   * The overtaking toast (rev 7.1 §13). The copy is r5's; what changes is
   * where it sits — just above the bottom bar instead of at the top, where
   * it used to appear over the promise and under the reader's eyeline at the
   * exact moment the bloom they were meant to be watching went off.
   */
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!overtook) return;
    setToast(true);
    const timer = setTimeout(() => setToast(false), REPLY_TOAST_MS);
    return () => clearTimeout(timer);
  }, [overtook]);

  const busy = panel !== null;
  /** On the day the caption says so, warmly, instead of counting down. */
  const day = card.comet?.status === "returned";

  /*
   * Gone quiet, so the way into the cube is pointed out. A phone cannot
   * hover, so on one this is the only way the label is ever offered — and not
   * while a panel is open, where it would be a second thing asking for
   * attention behind the one already asking.
   */
  const hinted = useIdle(ORBIT_IDLE_HINT_MS) && !busy;

  return (
    <div className="orbit-ui" data-panel={panel ?? "none"}>
      <p className="orbit-ui__tip" data-visible={tip && !busy} lang={lang}>
        {t.orbit.tapStar}
      </p>

      {/*
        The promise, in the top-right corner (rev 7.1 §10).

        It replaces r5's floating chip, and the reason is worth saying: the
        chip appeared for twenty seconds on arrival and then went, so the one
        sentence the whole card is *about* — what was promised, and when it
        comes back — was the only thing in the orbit view with a timer on it.
        It is a caption now. It is always there, it is right-aligned into the
        corner the composition keeps clear for it, and the orbiting things are
        placed to stay out from under it (§8.3).
      */}
      {card.comet ? (
        <div className="orbit-caption" data-day={day} lang={lang}>
          {card.comet.promise ? (
            <p className="orbit-caption__promise">
              {day ? t.orbit.returned : card.comet.promise}
            </p>
          ) : null}
          {/*
            The countdown on its own line, set large — it is the number the
            whole card is counting — with the date quietly beneath it.
          */}
          <p className="orbit-caption__count">
            <Countdown text={day ? t.orbit.today : card.comet.label.relative} />
          </p>
          <p className="orbit-caption__when">{day ? t.orbit.thisSeason : card.comet.label.label}</p>
          {aboard ? (
            <p className="orbit-caption__aboard">{t.orbit.aboard}</p>
          ) : null}
        </div>
      ) : null}

      {/*
        The satellite *is* the letter, so the label sits **on** it rather than
        floating beneath it: it reads as naming the thing under the cursor,
        which is the whole point of it. It appears on hover, so it is an
        answer to someone looking rather than another label on the sky.

        Which means the element has to *be* the satellite's area of the screen,
        not just sit at its centre — so it is sized from the same `tip` the
        camera is solved from, and both numbers come from `hubLabel`. It
        used to be a shrink-to-fit box around the button with the hover rule
        written against `.orbit-ui`, which has `pointer-events: none` and
        therefore never matched: hovering could not reveal anything, on any
        screen, and the twenty-second hint was the only way in.

        Where it leads depends on what the cube has in it. With a line written
        inside, looking into the satellite means the same thing 中をのぞく
        means on the closing screen, and says so in the same words — two names
        for one destination is how a reader ends up thinking there are two.
        Without one there is nothing in there, so it offers the letter.
      */}
      <div
        className="orbit-ui__reread"
        data-hinted={hinted}
        style={{
          ["--sat-x" as string]: `${centre[0] * 100}%`,
          ["--sat-y" as string]: `${centre[1] * 100}%`,
          // The body's area, not tip to tip: `hubLabel` explains why.
          ["--sat-span" as string]: `${label.span * 100}%`,
        }}
      >
        {/*
          Reachable by keyboard. It is the only way into the cube from out
          here, and it used to be `tabIndex={-1}` on the assumption that the
          bar offered the same thing — the bar offers the letter, which is a
          different place.
        */}
        <button
          className="button button--quiet"
          onClick={hasSecret ? onEnterSatellite : onDock}
          lang={lang}
        >
          {hasSecret ? t.orbit.lookInside : t.orbit.reread}
        </button>
      </div>

      {/*
        Four pills on two rows rather than one long line (M5, M14b). The row
        is capped narrower than the screen so it wraps at the same place on
        every phone, instead of at whatever width the labels happen to reach.
      */}
      <nav className="orbit-bar" aria-label={t.orbit.bar}>
        <div className="orbit-bar__row">
          {card.memories?.length ? (
            <button className="button button--quiet" onClick={onLookBack} lang={lang}>
              {t.orbit.trail}
            </button>
          ) : null}

          {/*
            Done, not disabled (rev 7.1 §13).

            A greyed-out button is how an interface says "you cannot". The
            reader *did* this — they sent a reply, which is the biggest thing
            the card asks of them — and the control that records it should
            look like an achievement rather than like a dead end. So it keeps
            its warm border and its text, takes a check, and is marked
            `aria-disabled` rather than `disabled`: still reachable, still
            announced, and a tap takes the eye to the star it became.
          */}
          {card.replyAvailable ? (
            <button
              className={`button button--quiet${launched ? " button--done" : ""}`}
              onClick={() => (launched ? onFindReply?.() : onOpenPanel("reply"))}
              aria-pressed={launched ? undefined : panel === "reply"}
              aria-disabled={launched || undefined}
              lang={lang}
            >
              {launched ? (
                <>
                  <CheckIcon className="orbit-bar__done-cue" />
                  {t.orbit.replied}
                </>
              ) : (
                t.orbit.reply
              )}
            </button>
          ) : null}

          {card.comet ? (
            <button className="button button--quiet" onClick={onOpenChart} lang={lang}>
              {t.orbit.comet}
            </button>
          ) : null}

          <button className="button button--quiet" onClick={onDock} lang={lang}>
            <ChevronLeftIcon className="orbit-bar__back-cue" />
            {t.orbit.reread}
          </button>
        </div>
      </nav>

      <p className="orbit-toast" data-visible={toast && !busy} role="status" lang={lang}>
        {t.orbit.replyArrived}
      </p>

      {card.social ? <SocialLinks links={card.social} /> : null}
    </div>
  );
}

/** "あと78日", with the number itself set larger than the words around it. */
function Countdown({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+)/).map((part, index) =>
        /^\d+$/.test(part) ? (
          <span key={index} className="orbit-caption__days">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
