import type { CometStatus } from "./cometOrbit.ts";

/**
 * 夜明け — the dawn (spec v0.2 rev 7.1 §3).
 *
 * The countdown, expressed as light. Revision 6 left the orbit view reading as
 * solitude: one dark object holding still in a cold, empty sky, after
 * something had ended. Nothing in that sentence is wrong about the geometry —
 * it is all about the light, so that is what this changes.
 *
 * The sun is always rising over あなたの星, and *how far it has risen* is the
 * comet's progress towards the reunion. Far from the day it is blue hour with
 * a gold line on the horizon; on the day the sun is fully up and the whole
 * scene is warm. It is never full night.
 *
 * Two properties make it work as a countdown rather than as decoration:
 *
 * 1. **Never night.** `p ≥ 0.2` from the very first visit, so no one ever
 *    opens the card to the cold sky revision 6 shipped.
 * 2. **It accelerates.** `f^2.2` puts most of the change in the last quarter
 *    of the wait, which is exactly what the comet's own Kepler motion does
 *    (§11.2). Two visits in the first month look nearly the same; two visits
 *    in the last fortnight do not.
 *
 * Pure, and a function of a *date* rather than of motion — which is why
 * reduced motion still computes it in full (§15). Only the ambient movement
 * stops; the sky a reader opens is still the sky of the day they open it.
 */

export type Dawn = {
  /** How far through the dawn, 0.2 (far from the day) to 1 (the day). */
  p: number;
  /**
   * How far the sun has climbed, **in planet radii**, measured along the
   * planet's radius from the limb. Negative means the disc is still below the
   * horizon and only its glow shows; it crosses zero at p ≈ 0.47.
   *
   * In radii rather than world units so this module stays pure: the caller
   * multiplies by whatever radius the planet has in its frame.
   */
  sunElevation: number;
  /** The same number as `p`, named for what it is used for: colour mixing. */
  warmth: number;
};

/** The floor: there is always a sunrise on the horizon (principle 12). */
export const DAWN_FLOOR = 0.2;
/** Most of the change lands in the last quarter of the wait. */
export const DAWN_EXPONENT = 2.2;
/** A comet held at perihelion is past its day, but the day has gone by. */
export const DAWN_KEPT = 0.7;

const ELEVATION_LANDSCAPE = { base: -0.04, rise: 0.085 };
const ELEVATION_PORTRAIT = { base: -0.035, rise: 0.075 };

export type DawnOptions = {
  /** Portrait lifts the sun a little less, because the frame is taller. */
  portrait?: boolean;
};

/**
 * The dawn for a comet at progress `f` in its current cycle (§11.2) with
 * status `status` (§14.1).
 */
export function dawn(
  f: number,
  status: CometStatus,
  options: DawnOptions = {},
): Dawn {
  const p =
    status === "returned"
      ? 1
      : status === "kept"
        ? DAWN_KEPT
        : clamp(
            DAWN_FLOOR + (1 - DAWN_FLOOR) * Math.pow(clamp(f, 0, 1), DAWN_EXPONENT),
            DAWN_FLOOR,
            1,
          );

  const e = options.portrait ? ELEVATION_PORTRAIT : ELEVATION_LANDSCAPE;

  return { p, sunElevation: e.base + e.rise * p, warmth: p };
}

/**
 * The dawn for a card with no comet at all.
 *
 * Such a card has no reunion to count down to, so it has no curve either — but
 * it still has a sky, and the sky is never night. It gets the floor: blue hour
 * with a gold line on the horizon, held there.
 */
export function stillDawn(options: DawnOptions = {}): Dawn {
  return dawn(0, "away", options);
}

/** 0 at blue hour, 1 at full sunrise — how visible the sun's disc is. */
export function sunVisibility(d: Dawn): number {
  return smoothstep(-0.02, 0.06, d.sunElevation);
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
