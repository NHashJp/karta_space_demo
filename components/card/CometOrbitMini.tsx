"use client";

import { displayedProgress, ECCENTRICITY, orbitPoint, SEMI_MAJOR } from "@/lib/cometOrbit";

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
  // The ellipse in diagram space. The planet is at a focus, not the centre,
  // which is the whole shape of the thing: the comet spends most of its time
  // at the far end, away from it.
  const padding = 8;
  const a = (WIDTH - padding * 2) / 2;
  const b = a * Math.sqrt(1 - ECCENTRICITY * ECCENTRICITY);
  const focusOffset = a * ECCENTRICITY;

  const centreX = WIDTH / 2;
  const centreY = HEIGHT / 2;
  // Perihelion is the end nearest the focus, which is on the right here.
  const focusX = centreX + focusOffset;
  const perihelionX = centreX + a;

  const f = displayedProgress(progress);
  const point = orbitPoint(f);
  // Diagram units per world unit. `orbitPoint` measures from the focus, and
  // its semi-minor axis is already a·√(1−e²), so one scale puts the dot
  // exactly on the drawn ellipse on both axes.
  const scale = a / SEMI_MAJOR;
  const cometX = focusX + point.x * scale;
  const cometY = centreY - point.y * scale;

  const colour = tone === "receiver" ? "#f3d7a4" : "#7fd4f5";

  return (
    <svg
      className="mini-orbit"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={
        label ? `彗星の軌道。${label}に戻ります。` : "彗星の軌道"
      }
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
