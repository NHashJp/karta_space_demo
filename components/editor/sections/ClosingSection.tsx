"use client";

import { useState } from "react";
import { SignaturePad } from "../SignaturePad";
import type { SectionProps } from "../shared";
import { CLOSING_MAX, SECRET_MAX } from "@/lib/cardRules";

/** The last screen: the line, the signature, and what is inside (§15.4). */
export function ClosingSection({ card, edit }: SectionProps) {
  const [drawing, setDrawing] = useState(false);
  const closingLength = card.closing.trim().length;

  return (
    <div className="editor__section">
      <label className="field">
        <span>
          Closing line &middot; {closingLength}/{CLOSING_MAX}
        </span>
        <input
          value={card.closing}
          onChange={(event) => edit({ closing: event.target.value })}
          lang="ja"
        />
        <span className="editor__hint" data-warn={closingLength > CLOSING_MAX}>
          {closingLength > CLOSING_MAX
            ? `Drawn on one line, so ${closingLength} characters set at about 14px on a phone. Shorter reads bigger.`
            : "Drawn stroke by stroke, then filled. One line, fitted to the width."}
        </span>
      </label>

      <div className="field">
        <span>Signature</span>
        {card.signature ? (
          <div className="editor__signature">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.signature} alt="" />
          </div>
        ) : (
          <span className="editor__hint">
            None. The closing line will stand alone.
          </span>
        )}
        <div className="face__types">
          <button className="face__type" onClick={() => setDrawing(true)}>
            {card.signature ? "Draw again…" : "Draw…"}
          </button>
          {card.signature ? (
            <button className="face__type" onClick={() => edit({ signature: undefined })}>
              Clear
            </button>
          ) : null}
        </div>
        <span className="editor__hint">
          The one mark on the card a template could not have produced. Drawn in
          your own hand on the closing screen, after the line finishes.
        </span>
      </div>

      <label className="field">
        <span>
          Inside the cube &middot; {(card.secret ?? "").length}/{SECRET_MAX}
        </span>
        <input
          value={card.secret ?? ""}
          onChange={(event) => edit({ secret: event.target.value || undefined })}
          lang="ja"
        />
        <span className="editor__hint">
          Optional. Offered a few seconds after the closing screen settles, and
          read from inside the cube — so it has to be short.
        </span>
      </label>

      {drawing ? (
        <SignaturePad
          slug={card.slug}
          onSaved={(src) => edit({ signature: src })}
          onClose={() => setDrawing(false)}
        />
      ) : null}
    </div>
  );
}
