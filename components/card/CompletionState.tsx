"use client";

import { useEffect, useState } from "react";
import StrokeText from "@/components/text/StrokeText";
import { SocialLinks } from "./SocialLinks";
import type { SocialLink } from "@/types/card";

type Props = {
  closing: string;
  social?: SocialLink[];
  /** True once the camera has started diving back in; the screen fades away. */
  leaving: boolean;
  /** This card has a line written inside the cube. */
  hasSecret: boolean;
  onReveal: () => void;
  onReplay: () => void;
};

/**
 * The invitation inside waits before it appears. A cube that turns out to have
 * an inside is only a surprise if the closing screen has first been allowed to
 * read as the end.
 */
const SECRET_HINT_MS = 6000;

/**
 * Dash length must exceed the longest glyph outline, or part of a kanji stays
 * undrawn. A dense character's outline runs to roughly 15x its font size once
 * every stroke is counted, so this leaves generous headroom.
 */
const DASH_PER_EM = 22;

/** The stroke is drawn, then the fill wipes across — so keep the line short. */
function strokeFontSize(width: number, characters: number): number {
  const byViewport = width < 520 ? 76 : width < 900 ? 96 : 112;
  // A long line scales down inside the SVG anyway; this keeps the stroke weight sane.
  return characters > 18 ? byViewport * 0.82 : byViewport;
}

export function CompletionState({
  closing,
  social,
  leaving,
  hasSecret,
  onReveal,
  onReplay,
}: Props) {
  const [width, setWidth] = useState(1024);
  const [offerSecret, setOfferSecret] = useState(false);
  const fontSize = strokeFontSize(width, closing.length);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!hasSecret) return;
    const timer = setTimeout(() => setOfferSecret(true), SECRET_HINT_MS);
    return () => clearTimeout(timer);
  }, [hasSecret]);

  return (
    <div className="screen screen--completion" data-leaving={leaving} aria-hidden={leaving}>
      <div className="completion">
        <div className="completion__stroke" lang="ja">
          <StrokeText
            text={closing}
            strokeColor="#7fd4f5"
            fillColor="#e8e9eb"
            strokeWidth={1.1}
            drawDuration={2.1}
            fillDelay={0.35}
            stagger={0.055}
            ease="power2.out"
            trigger="mount"
            fillMode="wipe"
            fontSize={fontSize}
            fontWeight={500}
            letterSpacing={2}
            dashLength={fontSize * DASH_PER_EM}
          />
        </div>
        <button
          className="button button--ghost"
          onClick={onReplay}
          disabled={leaving}
          lang="ja"
        >
          もう一度見る
        </button>

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

        {social ? <SocialLinks links={social} /> : null}
      </div>
    </div>
  );
}
