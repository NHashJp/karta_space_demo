"use client";

import { useEffect, useRef, useState } from "react";
import { SIGNATURE_DRAW_MS } from "@/lib/timing";

type Props = {
  /** An SVG of stroked paths — the sender's own hand (spec v0.2 §13.1). */
  src: string;
  /** Hold until the closing line has finished drawing itself. */
  delayMs: number;
};

/**
 * The sender's signature, drawn rather than shown.
 *
 * The closing line is drawn stroke by stroke and then filled; this arrives
 * afterwards and in the same way, so the screen reads as one hand writing one
 * thing rather than as a caption appearing under a heading. It is the last
 * thing the receiver sees of the letter itself, and the moment the card stops
 * being a designed object and becomes something a specific person wrote.
 *
 * The SVG is fetched rather than put in an `<img>`, because an image cannot be
 * animated from outside: the drawing works by setting a dash on each path and
 * walking it, which needs the paths themselves in the document.
 */
export function Signature({ src, delayMs }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [markup, setMarkup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((response) => (response.ok ? response.text() : null))
      .then((text) => {
        // A signature that fails to load is simply absent. It is the quietest
        // thing on the screen, and a broken-image icon under the closing line
        // would be far worse than nothing at all.
        if (!cancelled && text && text.includes("<svg")) setMarkup(text);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const svg = host.current?.querySelector("svg");
    if (!svg) return;

    const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path"));
    if (paths.length === 0) return;

    svg.removeAttribute("width");
    svg.removeAttribute("height");

    // Normalising each path to a length of 1 means the dash maths does not
    // depend on the SVG's units, so a signature drawn at any scale in the
    // editor's pad draws correctly here.
    paths.forEach((path) => {
      path.setAttribute("pathLength", "1");
      path.style.strokeDasharray = "1";
      path.style.strokeDashoffset = "1";
      path.style.fill = "none";
      path.style.stroke = "var(--signature-stroke)";
      path.style.strokeLinecap = "round";
      path.style.strokeLinejoin = "round";
    });

    // Each path takes its share of the total, in document order — which for a
    // signature is the order it was written in.
    const each = SIGNATURE_DRAW_MS / paths.length;
    const timers = paths.map((path, index) =>
      setTimeout(() => {
        path.style.transition =
          `stroke-dashoffset ${each}ms ease-out, stroke ${each * 2}ms ease-in ${each}ms`;
        path.style.strokeDashoffset = "0";
        path.style.stroke = "var(--signature-ink)";
      }, delayMs + index * each),
    );

    return () => timers.forEach(clearTimeout);
  }, [markup, delayMs]);

  if (!markup) return null;

  return (
    <div
      className="signature"
      ref={host}
      aria-hidden="true"
      // The file is authored by the sender, in this repository, and written by
      // the editor's own pad — the same trust level as the card's text.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
