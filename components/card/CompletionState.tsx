"use client";

import { useEffect, useMemo, useState } from "react";
import StrokeText, { strokeTextDuration } from "@/components/text/StrokeText";
import { SocialLinks } from "./SocialLinks";
import { Signature } from "./Signature";
import { ORBIT_HINT_MS, SECRET_AFTER_MS, SIGNATURE_DRAW_MS, replayed } from "@/lib/timing";
import { usePrefersReducedMotion } from "@/lib/useFaceNavigation";
import { closingLines } from "@/lib/closingLines";
import type { SocialLink } from "@/types/card";

type Props = {
  closing: string;
  social?: SocialLink[];
  /** True once the camera has started diving back in; the screen fades away. */
  leaving: boolean;
  /** This card has a line written inside the cube. */
  hasSecret: boolean;
  /** This card continues past the closing screen (spec v0.2 §8.1). */
  hasOrbit: boolean;
  /** An SVG of the sender's handwriting, drawn under the line (§13.1). */
  signature?: string;
  /**
   * This screen has been read once already — after a replay of the card, a
   * look inside the cube, or a return from orbit. It plays briskly.
   */
  again: boolean;
  onReveal: () => void;
  onReplay: () => void;
  onDeploy: () => void;
};

/**
 * Dash length must exceed the longest glyph outline, or part of a kanji stays
 * undrawn. A dense character's outline runs to roughly 15x its font size once
 * every stroke is counted, so this leaves generous headroom.
 */
const DASH_PER_EM = 22;

/**
 * How long the closing line takes to write itself, in seconds, and when the
 * fill starts wiping across behind the stroke.
 */
const CLOSING_DRAW_S = 2.1;
const CLOSING_FILL_DELAY_S = 0.35;
const CLOSING_STAGGER_S = 0.055;

/**
 * When the signature starts. The closing line draws for 2.1s and its fill
 * wipes from 0.35s; this waits for the whole of that, so the two are
 * consecutive rather than simultaneous.
 */
const SIGNATURE_DELAY_MS = 2600;

/** The stroke is drawn, then the fill wipes across — so keep the line short. */
function strokeFontSize(width: number, characters: number): number {
  const byViewport = width < 520 ? 76 : width < 900 ? 96 : 112;
  // A long line scales down inside the SVG anyway; this keeps the stroke weight sane.
  return characters > 18 ? byViewport * 0.82 : byViewport;
}

/**
 * The orbit offer waits before it appears: a letter that turns out to have a
 * continuation is only a surprise if the closing screen has first been allowed
 * to read as the end.
 *
 * The offer to look inside the cube does not wait. It is not news — the cube is
 * right there on the screen — so holding it back bought nothing and left the
 * reader looking at an ending that was still quietly growing buttons.
 */

export function CompletionState({
  closing,
  social,
  leaving,
  hasSecret,
  hasOrbit,
  signature,
  again,
  onReveal,
  onReplay,
  onDeploy,
}: Props) {
  const [width, setWidth] = useState(1024);
  const [offerOrbit, setOfferOrbit] = useState(false);
  const [written, setWritten] = useState(false);
  const [offerSecret, setOfferSecret] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  /*
   * One line, or two when one would be too small to read as handwriting. The
   * size is set by the longest line, so the font is measured against that
   * rather than against the whole sentence.
   */
  const lines = useMemo(() => closingLines(closing, width), [closing, width]);
  const longest = lines.reduce((most, line) => Math.max(most, line.length), 0);
  const fontSize = strokeFontSize(width, longest);

  /** Line `i` starts when line `i - 1` has finished: one hand, not two. */
  const lineStart = (index: number) =>
    lines
      .slice(0, index)
      .reduce(
        (total, line) =>
          total +
          strokeTextDuration({
            characters: line.length,
            drawDuration: CLOSING_DRAW_S,
            fillDelay: CLOSING_FILL_DELAY_S,
            stagger: CLOSING_STAGGER_S,
            fillMode: "wipe",
          }),
        0,
      );

  /** Seconds from mount until the last stroke of the last line is dry. */
  const writingEndsS =
    lineStart(lines.length - 1) +
    strokeTextDuration({
      characters: lines[lines.length - 1]?.length ?? 0,
      drawDuration: CLOSING_DRAW_S,
      fillDelay: CLOSING_FILL_DELAY_S,
      stagger: CLOSING_STAGGER_S,
      fillMode: "wipe",
    });

  /*
   * A single line keeps the signature delay it has always had. With two, the
   * hand is still writing at 2.6s, so the signature waits for it — otherwise
   * two things are being written at once, which is the one thing this screen
   * is arranged not to show.
   */
  const signatureDelayMs =
    lines.length > 1 ? Math.max(SIGNATURE_DELAY_MS, writingEndsS * 1000) : SIGNATURE_DELAY_MS;

  /*
   * Everything on this screen is paced against everything else — the fill
   * chases the stroke, the signature waits for the fill, and the two
   * invitations wait for the signature — so a replay shortens all of it by
   * one factor rather than shortening the parts that happen to be animations.
   * Shorten only the drawing and the offers arrive over a finished screen
   * that then sits there; shorten only the offers and they interrupt a hand
   * still writing.
   */
  const brisk = (value: number) => replayed(value, again);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  /*
   * The replay button is on the screen from the start — it keeps its place in
   * the column, so nothing shifts under a thumb already reaching for it — but
   * it stays faint until the hand has stopped writing. Offering to play the
   * thing again while it is still playing the first time invites a reader to
   * cut short the one moment the card exists for; a button too quiet to read
   * yet does not.
   *
   * Faint, not disabled: someone who has decided to skip ahead should not have
   * to wait for permission.
   *
   * Under reduced motion there is nothing to wait for — `StrokeText` puts the
   * closing line straight to its finished state — so the button is legible from
   * the start. The two invitations below still take their time, because their
   * delay is about a card that should read as over before it offers more; this
   * one is only about not talking over an animation.
   *
   * The closing line's own length is asked for rather than assumed: the
   * per-character stagger means a long line is still being written well after
   * `SIGNATURE_DELAY_MS`, and a card with no signature at all finishes with the
   * line. Whichever of the two ends last is what the button waits for.
   */
  useEffect(() => {
    if (reducedMotion) {
      setWritten(true);
      return;
    }
    const lineEnds = writingEndsS * 1000;
    const signatureEnds = signature ? signatureDelayMs + SIGNATURE_DRAW_MS : 0;
    const timer = setTimeout(
      () => setWritten(true),
      brisk(Math.max(lineEnds, signatureEnds)),
    );
    return () => clearTimeout(timer);
  }, [writingEndsS, signatureDelayMs, signature, again, reducedMotion]);

  useEffect(() => {
    if (!hasOrbit) return;
    const timer = setTimeout(() => setOfferOrbit(true), replayed(ORBIT_HINT_MS, again));
    return () => clearTimeout(timer);
  }, [hasOrbit, again]);

  /*
   * The invitation inside the cube comes **last**: after the closing line and
   * the signature have finished writing, and after the orbit offer, with a
   * beat of its own after both. It used to be there from the first frame,
   * under a line that had not been written yet — an exit sign lit before the
   * ending had been said.
   */
  useEffect(() => {
    if (!hasSecret) return;
    const writingEnds = reducedMotion
      ? 0
      : Math.max(writingEndsS * 1000, signature ? signatureDelayMs + SIGNATURE_DRAW_MS : 0);
    const orbitArrives = hasOrbit ? ORBIT_HINT_MS : 0;
    const timer = setTimeout(
      () => setOfferSecret(true),
      brisk(Math.max(writingEnds, orbitArrives) + SECRET_AFTER_MS),
    );
    return () => clearTimeout(timer);
  }, [hasSecret, hasOrbit, writingEndsS, signatureDelayMs, signature, again, reducedMotion]);

  return (
    <div className="screen screen--completion" data-leaving={leaving} aria-hidden={leaving}>
      <div className="completion">
        <div className="completion__stroke" lang="ja">
          {lines.map((line, index) => (
            <StrokeText
              key={`${lines.length}:${index}`}
              text={line}
              strokeColor="#7fd4f5"
              fillColor="#e8e9eb"
              strokeWidth={1.1}
              drawDuration={brisk(CLOSING_DRAW_S)}
              fillDelay={brisk(CLOSING_FILL_DELAY_S)}
              stagger={brisk(CLOSING_STAGGER_S)}
              startDelay={brisk(lineStart(index))}
              ease="power2.out"
              trigger="mount"
              fillMode="wipe"
              fontSize={fontSize}
              fontWeight={500}
              letterSpacing={2}
              dashLength={fontSize * DASH_PER_EM}
            />
          ))}
        </div>
        {/*
          Drawn once the closing line's own fill wipe has finished, so the
          screen reads as one hand writing one thing.
        */}
        {signature ? (
          <Signature
            markup={signature}
            delayMs={brisk(signatureDelayMs)}
            drawMs={brisk(SIGNATURE_DRAW_MS)}
          />
        ) : null}

        <button
          className="button button--ghost completion__replay"
          data-settled={written}
          onClick={onReplay}
          disabled={leaving}
          lang="ja"
        >
          もう一度見る
        </button>

        {hasOrbit ? (
          <div className="orbit-offer" data-visible={offerOrbit} aria-hidden={!offerOrbit}>
            <p className="orbit-offer__line" lang="ja">
              この手紙には、続きがあります。
            </p>
            <button
              className="button button--quiet"
              onClick={onDeploy}
              disabled={leaving || !offerOrbit}
              lang="ja"
            >
              軌道へ送り出す
            </button>
            {/* Scrolling forward does the same thing; this says so without words. */}
            <span className="orbit-offer__cue" aria-hidden="true">
              ↓
            </span>
          </div>
        ) : null}

        {hasSecret ? (
          <div className="secret-offer" data-visible={offerSecret} aria-hidden={!offerSecret}>
            <p className="secret-offer__line" lang="ja">
              この立方体には、内側があります。
            </p>
            <button
              className="button button--quiet"
              onClick={onReveal}
              disabled={leaving || !offerSecret}
              lang="ja"
            >
              中をのぞく
            </button>
          </div>
        ) : null}

        {/* With an orbit these move into the orbit view instead (§8.1). */}
        {social && !hasOrbit ? <SocialLinks links={social} /> : null}
      </div>
    </div>
  );
}
