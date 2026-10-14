"use client";

import { useState } from "react";
import { SignaturePad } from "../SignaturePad";
import type { SectionProps } from "../shared";
import { RichField } from "../FormatBar";
import { CLOSING_MAX, SECRET_MAX } from "@/lib/cardRules";
import { cleanSignature, signaturePreview } from "@/lib/signature";
import { plainText } from "@/lib/richText";

/** The last screen: the line, the signature, and what is inside (§15.4). */
export function ClosingSection({ card, edit }: SectionProps) {
  const [drawing, setDrawing] = useState(false);
  const closingLength = card.closing.trim().length;
  const signature = cleanSignature(card.signature);

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
        {signature ? (
          <div className="editor__signature">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signaturePreview(signature)} alt="" />
          </div>
        ) : card.signature ? (
          <span className="editor__hint">
            The saved signature is an old public file. Draw it again to keep it
            with the card instead.
          </span>
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

      <div className="field">
        <span>
          Inside the cube &middot; {plainText(card.secret ?? "").length}/{SECRET_MAX}
        </span>
        <RichField
          multiline
          rows={2}
          label="Inside the cube"
          value={card.secret ?? ""}
          onChange={(secret) => edit({ secret: secret || undefined })}
          lang="ja"
        />
        <span className="editor__hint">
          Optional. Offered a few seconds after the closing screen settles, and
          read from inside the cube — so it has to be short.
        </span>
      </div>

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
