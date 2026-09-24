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

/**
 * The comet's true orbit runs from 4.2 units out to 55.8, and the orbit view's
 * frame is about 9 units wide. Drawn at its real distance the comet spends
 * every day but the last few **completely off screen** — which is not "far out
 * and faint", it is absent, and it is why nobody could find it.
 *
 * So the radius is compressed for display while the *direction* and the
 * ordering are kept exactly: further away is still further away, and the comet
 * still visibly comes home. The exponent squashes the far half hardest, so
 * most of the wait is spent out near the edge and the approach is a rush at
 * the end — which is what the Kepler motion was for in the first place.
 */
export const DISPLAY_NEAR = 1.6;
export const DISPLAY_FAR = 3.9;
const DISPLAY_CURVE = 0.6;

export function displayRadius(distance: number): number {
  const t = (distance - PERIHELION) / (APHELION - PERIHELION);
  const clamped = Math.min(Math.max(t, 0), 1);
  return DISPLAY_NEAR + (DISPLAY_FAR - DISPLAY_NEAR) * Math.pow(clamped, DISPLAY_CURVE);
}

/** The orbit point as it is *drawn*: true direction, compressed radius. */
export function displayOrbitPoint(f: number): OrbitPoint {
  const point = orbitPoint(f);
  if (point.distance < 1e-9) return point;
  const scale = displayRadius(point.distance) / point.distance;
  return { x: point.x * scale, y: point.y * scale, distance: displayRadius(point.distance) };
}

/** No tail is drawn beyond this displayed radius. */
export const TAIL_CUTOFF = 3.3;

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

/**
 * Both tails point away from the planet, and fade out with distance. Measured
 * in *displayed* units, so the tail grows over the last stretch of the
 * approach — which is the signal that the day is near.
 */
export function tailLength(distance: number): number {
  if (distance >= TAIL_CUTOFF) return 0;
  return Math.min(1.7, 4.2 / (distance * distance));
}

/**
 * A small per-comet rotation of the orbit.
 *
 * Revision 6 limits this to ±6°. It used to be a full turn, which put the
 * comet anywhere at all — and the hub composition now requires it to pass by
 * in the **top-right quadrant**, clear of the satellite, with perihelion just
 * outside the planet's limb at the bottom-right (§4.1). A seed that can put it
 * anywhere cannot promise that.
 */
export const SEED_ROTATION_MAX = (6 * Math.PI) / 180;

export function orbitRotation(slug: string, releasedOn: string): number {
  const unit = seededUnit(hashSeed(`${slug}:${releasedOn}`));
  return HUB_ORBIT_HEADING + (unit * 2 - 1) * SEED_ROTATION_MAX;
}

/**
 * Which way the comet's orbit runs in the hub.
 *
 * Chosen so the outbound leg rises from the planet up the right-hand side and
 * recedes toward the top centre-right, which is where the sketch puts it.
 */
export const HUB_ORBIT_HEADING = (-62 * Math.PI) / 180;

/** The next 6% of the orbit, drawn dotted ahead of the comet (§4.1). */
export const SEGMENT_AHEAD = 0.06;

/** The orbit plane in world space: tilted, then rotated by the comet's own seed. */
export function toWorld(point: OrbitPoint, rotation: number, tilt = ORBIT_TILT) {
  const x = point.x * Math.cos(rotation) - point.y * Math.sin(rotation);
  const planar = point.x * Math.sin(rotation) + point.y * Math.cos(rotation);
  // Aphelion points into the far background, slightly up.
  return { x, y: planar * Math.sin(tilt), z: planar * Math.cos(tilt) };
}

export type CometStatus = "away" | "returned" | "kept";

export type CometCycle = {
  /** The current cycle's dates: a yearly comet moves on to the next one. */
  leftOn: string;
  returnsOn: string;
  status: CometStatus;
  /** Days until it is back. Zero on the day, negative inside the window. */
  daysUntil: number;
  /** Which cycle this is, for the visit record: the current `returnsOn`. */
  cycle: string;
};

/**
 * Where the comet is in its life today (spec v0.2 rev 5, §11.2).
 *
 * Three states rather than two. A comet that has come back and is not yearly
 * does not simply stay "returned" forever — after its window it becomes
 * **kept**: a small steady star beside the planet, a keepsake. That is the
 * difference between a promise still being made and one that was kept.
 */
export function cometCycle(
  input: { leftOn: string; returnsOn: string; yearly?: boolean },
  today: string,
): CometCycle {
  let { leftOn, returnsOn } = input;
  const daysSinceReturn = daysBetween(returnsOn, today);

  // Past the window, a yearly comet sets off again: the return it just made
  // becomes the new departure, and the next anniversary the new arrival.
  if (input.yearly && daysSinceReturn > RETURN_WINDOW_DAYS) {
    leftOn = returnsOn;
    returnsOn = nextOccurrence(returnsOn, today, true);
  }

  const daysUntil = daysBetween(today, returnsOn);
  const status: CometStatus =
    daysUntil > 0
      ? "away"
      : -daysUntil <= RETURN_WINDOW_DAYS
        ? "returned"
        : "kept";

  return { leftOn, returnsOn, status, daysUntil, cycle: returnsOn };
}
