"use client";

import { useStrings } from "./LangContext";
import { orbitDiagram } from "@/lib/cometOrbit";

/**
 * The comet's orbit, small enough to sit in a panel (spec v0.2 §11.2).
 *
 * This is the piece that makes the whole metaphor readable. "Your message
 * comes back on the 25th of December" is an assertion; a dashed ellipse with a
 * dot most of the way round it and a tick at the end is a *picture of a
 * promise*, and it explains the sky outside the panel at the same time.
 *
 * Plain SVG, no library, and the same `orbitPoint` the 3D comet is drawn from
 * — so the dot in the diagram and the speck in the sky are always at the same
 * place on the same orbit.
 */

const WIDTH = 132;
const HEIGHT = 64;

type Props = {
  /** Raw progress 0..1 from the comet's dates. */
  progress: number;
  /** Warm for the receiver's own comet, ion-blue for the sender's. */
  tone?: "sender" | "receiver";
  /** Shown at the perihelion tick. */
  label?: string;
};

export function CometOrbitMini({ progress, tone = "sender", label }: Props) {
  const t = useStrings();
  // The ellipse in diagram space, from the same helper the full trajectory
  // view uses — the planet at a focus, not the centre.
  const d = orbitDiagram(progress, WIDTH, HEIGHT, 8);
  const { a, b } = d;
  const centreX = d.centre.x;
  const centreY = d.centre.y;
  const focusX = d.focus.x;
  const perihelionX = d.perihelion.x;
  const cometX = d.comet.x;
  const cometY = d.comet.y;

  const colour = tone === "receiver" ? "#f3d7a4" : "#7fd4f5";

  return (
    <svg
      className="mini-orbit"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={t.trajectory.mini(label)}
    >
      <ellipse
        cx={centreX}
        cy={centreY}
        rx={a}
        ry={b}
        fill="none"
        stroke={colour}
        strokeWidth="1"
        strokeDasharray="3 4"
        opacity="0.45"
      />

      {/* The planet, at the focus. */}
      <circle cx={focusX} cy={centreY} r="3.5" fill="#5c6770" />
      <circle cx={focusX} cy={centreY} r="6" fill="none" stroke="#5c6770" strokeWidth="0.5" opacity="0.5" />

      {/* The tick at perihelion: the day it comes home. */}
      <line
        x1={perihelionX}
        y1={centreY - 5}
        x2={perihelionX}
        y2={centreY + 5}
        stroke={colour}
        strokeWidth="1.5"
        opacity="0.9"
      />

      {/* And the comet itself, where its dates put it today. */}
      <circle cx={cometX} cy={cometY} r="4.5" fill={colour} opacity="0.22" />
      <circle cx={cometX} cy={cometY} r="2" fill={colour} />
    </svg>
  );
}
