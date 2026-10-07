"use client";

import { useEffect, useRef } from "react";

type Props = {
  /**
   * An SVG of stroked paths — the sender's own hand (spec v0.2 §13.1) —
   * already sanitised on the server by `cleanSignature`.
   */
  markup: string;
  /** Hold until the closing line has finished drawing itself. */
  delayMs: number;
  /** How long the hand takes over the whole name; shorter on a replay. */
  drawMs: number;
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
 * The SVG arrives as markup inside the card rather than as a file, and is put
 * into the document rather than into an `<img>`, because an image cannot be
 * animated from outside: the drawing works by setting a dash on each path and
 * walking it, which needs the paths themselves in the document.
 */
export function Signature({ markup, delayMs, drawMs }: Props) {
  const host = useRef<HTMLDivElement>(null);

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
    const each = drawMs / paths.length;
    const timers = paths.map((path, index) =>
      setTimeout(() => {
        path.style.transition =
          `stroke-dashoffset ${each}ms ease-out, stroke ${each * 2}ms ease-in ${each}ms`;
        path.style.strokeDashoffset = "0";
        path.style.stroke = "var(--signature-ink)";
      }, delayMs + index * each),
    );

    return () => timers.forEach(clearTimeout);
  }, [markup, delayMs, drawMs]);

  return (
    <div
      className="signature"
      ref={host}
      aria-hidden="true"
      // Drawn by the editor's own pad and rebuilt from its paths alone on the
      // server (`cleanSignature`), so nothing but stroked paths reaches here.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
