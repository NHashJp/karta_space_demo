"use client";

import { useStrings } from "./LangContext";
import { orbitDiagram } from "@/lib/cometOrbit";

/**
 * The comet's whole trajectory, drawn and labelled (mockup M12c).
 *
 * The 3D sky can only ever show where the comet is *now* — a speck, with a
 * short dotted lead to say which way it is going. That is the right thing up
 * there, and it is useless for the one question the object exists to answer:
 * when does it come back, and how far away is that.
 *
 * So this is the pulled-back view. A dashed ellipse, the planet at its focus,
 * the comet where its dates put it today, and three labels that turn a curve
 * into a sentence: you are here, that is your star, and it comes back *there*.
 * Without the labels it is a diagram of an orbit; with them it is a picture of
 * a promise, which is the only reason to draw it at all.
 *
 * Plain SVG and the same `orbitDiagram` the small chart uses, so the picture
 * in this panel and the speck in the sky can never disagree.
 */

const WIDTH = 320;
const HEIGHT = 208;
const PADDING = 44;

type Props = {
  /** Raw progress 0..1 from the comet's dates. */
  progress: number;
  /** Warm for the receiver's own words, ion-blue for the sender's. */
  tone?: "sender" | "receiver";
  /** `次のクリスマス` — printed at the point it comes home. */
  returnLabel: string;
  /** True once it has arrived, so "いま、ここ" lands on the return instead. */
  returned?: boolean;
};

export function CometTrajectory({
  progress,
  tone = "sender",
  returnLabel,
  returned = false,
}: Props) {
  const t = useStrings();
  const d = orbitDiagram(progress, WIDTH, HEIGHT, PADDING);
  const colour = tone === "receiver" ? "#f3d7a4" : "#7fd4f5";

  /*
   * The comet label sits outside the ellipse, on whichever side the comet is
   * — otherwise at aphelion it lands on top of the curve it is describing.
   */
  const onRight = d.comet.x >= d.centre.x;
  const labelX = d.comet.x + (onRight ? 12 : -12);

  return (
    <svg
      className="trajectory"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={t.trajectory.aria(returnLabel)}
      lang="ja"
    >
      {/* The orbit itself. Dashed, because it is a path not a wire. */}
      <ellipse
        cx={d.centre.x}
        cy={d.centre.y}
        rx={d.a}
        ry={d.b}
        fill="none"
        stroke={colour}
        strokeWidth="1"
        strokeDasharray="3 5"
        opacity="0.5"
      />

      {/* 「あなたの星」 — the planet, at the focus. */}
      <circle cx={d.focus.x} cy={d.focus.y} r="7" fill="#2b3550" />
      <circle
        cx={d.focus.x}
        cy={d.focus.y}
        r="7"
        fill="none"
        stroke="#9fb4c9"
        strokeWidth="0.75"
        opacity="0.7"
      />
      <text
        className="trajectory__label"
        x={d.focus.x - 14}
        y={d.focus.y + 4}
        textAnchor="end"
      >
        {t.trajectory.home}
      </text>

      {/* 「また、ここで。」 — the tick at perihelion, the day it comes home. */}
      <line
        x1={d.perihelion.x}
        y1={d.perihelion.y - 7}
        x2={d.perihelion.x}
        y2={d.perihelion.y + 7}
        stroke={colour}
        strokeWidth="1.5"
        opacity="0.9"
      />
      <text
        className="trajectory__label trajectory__label--return"
        x={d.perihelion.x}
        y={d.perihelion.y + 26}
        textAnchor="middle"
      >
        {t.trajectory.meetHere}
      </text>

      {/* 「いま、ここ」 — and the comet, where today puts it. */}
      <circle cx={d.comet.x} cy={d.comet.y} r="7" fill={colour} opacity="0.2" />
      <circle cx={d.comet.x} cy={d.comet.y} r="2.75" fill={colour} />
      <text
        className="trajectory__label trajectory__label--now"
        x={labelX}
        y={d.comet.y + 4}
        textAnchor={onRight ? "start" : "end"}
      >
        {returned ? t.trajectory.back : t.trajectory.now}
      </text>
    </svg>
  );
}
