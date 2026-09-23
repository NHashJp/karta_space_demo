import { daysBetween, nextOccurrence } from "./orbitClock.ts";
import { hashSeed, seededUnit } from "./seed.ts";

/**
 * A sealed message is a comet: it goes far away and comes back on a date. Its
 * position in the sky *is* the countdown (spec v0.2 §11.2), so this has to be a
 * real orbit rather than a progress bar — the shape is what makes the metaphor
 * legible without explaining it.
 *
 * Pure: no three.js, no Date beyond civil-date arithmetic.
 */

/** Eccentricity, perihelion and the semi-major axis they imply. */
export const ECCENTRICITY = 0.86;
export const PERIHELION = 4.2; // just outside the satellite ring (3.4 x 2.6)
export const SEMI_MAJOR = PERIHELION / (1 - ECCENTRICITY); // 30
export const APHELION = SEMI_MAJOR * (1 + ECCENTRICITY); // 55.8, inside the nebula sphere

/** The orbit plane is tilted away from the satellite's, so they never overlap. */
export const ORBIT_TILT = (22 * Math.PI) / 180;

/** A comet just released would otherwise sit beside the planet for days. */
export const MIN_DISPLAYED_PROGRESS = 0.06;

/** How long a comet holds at perihelion once it is back. */
export const RETURN_WINDOW_DAYS = 14;

/** No tail is drawn beyond this distance from the planet. */
export const TAIL_CUTOFF = 25;

/**
 * Kepler's equation, E - e·sin E = M.
 *
 * The spec says "Newton, 6 iterations"; at e = 0.86 that is not always enough
 * to reach the 1e-9 the verification demands, so this iterates to a tolerance
 * with a hard cap instead. The starting guess is the standard one for high
 * eccentricity, which usually converges in three or four passes.
 */
export function solveEccentricAnomaly(meanAnomaly: number, e = ECCENTRICITY): number {
  let E = meanAnomaly + e * Math.sin(meanAnomaly);

  for (let i = 0; i < 32; i++) {
    const error = E - e * Math.sin(E) - meanAnomaly;
    if (Math.abs(error) < 1e-13) break;
    E -= error / (1 - e * Math.cos(E));
  }
  return E;
}

export type OrbitPoint = { x: number; y: number; distance: number };

/**
 * Position in the orbit plane at progress `f`, where 0 and 1 are perihelion
 * and 0.5 is aphelion. The planet sits at the focus, which is the origin here.
 */
export function orbitPoint(f: number, e = ECCENTRICITY, a = SEMI_MAJOR): OrbitPoint {
  const E = solveEccentricAnomaly(2 * Math.PI * f, e);
  // Measured from the focus, so perihelion is +q rather than +a.
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return { x, y, distance: Math.hypot(x, y) };
}

/** Raw progress from the dates, before the just-released floor is applied. */
export function progress(releasedOn: string, returnsOn: string, today: string): number {
  const span = daysBetween(releasedOn, returnsOn);
  if (!Number.isFinite(span) || span <= 0) return 1;
  const elapsed = daysBetween(releasedOn, today);
  return Math.min(Math.max(elapsed / span, 0), 1);
}

/** What to draw: a comet on its way out is never shown sitting at the planet. */
export function displayedProgress(f: number): number {
  if (f <= 0) return MIN_DISPLAYED_PROGRESS;
  if (f >= 1) return 1;
  return f < MIN_DISPLAYED_PROGRESS ? MIN_DISPLAYED_PROGRESS : f;
}

/** Both tails point away from the planet, and fade out with distance. */
export function tailLength(distance: number): number {
  if (distance >= TAIL_CUTOFF) return 0;
  return Math.min(3.5, 60 / (distance * distance));
}

/** A small per-comet rotation of the orbit, so two comets never sit on top of each other. */
export function orbitRotation(slug: string, releasedOn: string): number {
  return seededUnit(hashSeed(`${slug}:${releasedOn}`)) * Math.PI * 2;
}

/** The orbit plane in world space: tilted, then rotated by the comet's own seed. */
export function toWorld(point: OrbitPoint, rotation: number, tilt = ORBIT_TILT) {
  const x = point.x * Math.cos(rotation) - point.y * Math.sin(rotation);
  const planar = point.x * Math.sin(rotation) + point.y * Math.cos(rotation);
  // Aphelion points into the far background, slightly up.
  return { x, y: planar * Math.sin(tilt), z: planar * Math.cos(tilt) };
}

export type CometWindow = {
  releasedOn: string;
  returnsOn: string;
  status: "away" | "returned";
  /** Days until it is back. Zero on the day, negative inside the window. */
  daysUntil: number;
};

/**
 * Where a comet is in its life today, following it through yearly returns: once
 * the window closes, a yearly comet sets off again from the return it just made
 * towards the next anniversary.
 */
export function cometWindow(
  input: { releasedOn: string; returnsOn: string; yearly?: boolean },
  today: string,
): CometWindow {
  let { releasedOn, returnsOn } = input;
  const daysSinceReturn = daysBetween(returnsOn, today);

  if (daysSinceReturn >= 0 && input.yearly && daysSinceReturn > RETURN_WINDOW_DAYS) {
    // The last return becomes the new departure, and the next anniversary the
    // new arrival — so the countdown restarts rather than staying finished.
    releasedOn = returnsOn;
    returnsOn = nextOccurrence(returnsOn, today, true);
  }

  const daysUntil = daysBetween(today, returnsOn);
  const arrived = daysUntil <= 0;
  const stillHolding = -daysUntil <= RETURN_WINDOW_DAYS;

  return {
    releasedOn,
    returnsOn,
    status: arrived && (!input.yearly || stillHolding) ? "returned" : "away",
    daysUntil,
  };
}
