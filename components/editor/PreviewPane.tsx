"use client";

import { useState } from "react";
import { JUMP_TARGETS } from "@/lib/devJump";

/**
 * The card, as the receiver will see it (spec v0.2 §15.3).
 *
 * The Jump and Date controls are what make this usable rather than decorative.
 * Checking one line of the satellite panel by reading six faces and waiting
 * out a deployment animation is the kind of loop that stops people checking at
 * all — and a card is mostly made of states nobody sees until a specific date.
 *
 * Both parameters go through the reducer's own events and the card's own
 * clock, and both are ignored in production (§6.6, §14.1).
 */
export function PreviewPane({ slug, reloadKey }: { slug: string; reloadKey: number }) {
  const [at, setAt] = useState("landing");
  const [now, setNow] = useState("");

  const query = new URLSearchParams();
  if (at !== "landing") query.set("at", at);
  if (now) query.set("now", now);
  const url = `/c/${slug}${query.size > 0 ? `?${query}` : ""}`;

  return (
    <aside className="preview">
      <div className="preview__frame">
        <iframe
          // Remounted on save and on every control change, so the preview is
          // never showing the file as it was two saves ago.
          key={`${slug}:${url}:${reloadKey}`}
          src={url}
          title="Card preview"
          className="preview__iframe"
        />
      </div>

      <div className="preview__controls">
        <label className="field">
          <span>Jump to</span>
          <select value={at} onChange={(event) => setAt(event.target.value)}>
            {JUMP_TARGETS.map((target) => (
              <option key={target} value={target}>
                {target}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>As if it were</span>
          <input type="date" value={now} onChange={(event) => setNow(event.target.value)} />
          <span className="editor__hint">
            Set the satellite&rsquo;s date and jump to comet to see it come home.
          </span>
        </label>

        <a className="button button--quiet" href={url} target="_blank" rel="noreferrer">
          Open in new tab ↗
        </a>
      </div>
    </aside>
  );
}
