import { hashSeed, seededUnit } from "./seed.ts";

/**
 * The contrail's shape (spec v0.2 §9.1).
 *
 * Pure, and deliberately not built on `THREE.CatmullRomCurve3`, because two
 * different things need to agree about this curve: the ribbon that draws it
 * and the camera that travels along it. A camera that stops half a unit off
 * the ribbon is the kind of error nobody can see in a screenshot and everybody
 * can see in motion. One source, evaluated the same way by both.
 *
 * The shape: it starts just behind the orbit ring and recedes to z ≈ −70,
 * well inside the nebula's sphere of radius 90, curving gently — never more
 * than about 4 units sideways, so the trail reads as a path rather than a
 * scribble. Seeded from the slug, so each card's trail bends its own way.
 */

export const TRAIL_POINTS = 7;
export const TRAIL_NEAR_Z = -4;
export const TRAIL_FAR_Z = -70;
/** How far the curve is allowed to wander off the axis it recedes along. */
export const TRAIL_LATERAL = 4;

/** Where the memories sit along the curve, as §9.1's even spacing. */
export const MEMORY_START_U = 0.08;
export const MEMORY_END_U = 0.92;

export type Point3 = [number, number, number];

export function trailSeedFor(slug: string): number {
  return hashSeed(`${slug}:trail`);
}

/**
 * The control points the curve passes through. The first sits just behind the
 * orbit ring, where the cube's exhaust would leave it; the rest recede, with a
 * lateral wander that grows with distance so the near end stays a clean line
 * out of the satellite and the far end is free to drift.
 */
export function trailControlPoints(seed: number): Point3[] {
  const points: Point3[] = [];
  for (let i = 0; i < TRAIL_POINTS; i++) {
    const t = i / (TRAIL_POINTS - 1);
    // Cubed, so the far end is much further apart than the near end: the trail
    // compresses towards the horizon the way a receding line should.
    const z = TRAIL_NEAR_Z + (TRAIL_FAR_Z - TRAIL_NEAR_Z) * t * t;
    const swing = TRAIL_LATERAL * t;
    points.push([
      (seededUnit(seed, i * 2 + 1) - 0.5) * 2 * swing,
      // Rising slightly as it recedes, so it is never hidden behind the planet.
      1.1 * t + (seededUnit(seed, i * 2 + 2) - 0.5) * swing * 0.5,
      z,
    ]);
  }
  return points;
}

/**
 * Centripetal Catmull-Rom through the control points. Centripetal rather than
 * uniform because a uniform spline loops back on itself when two control
 * points are close together, and the far end of this curve has exactly that
 * spacing problem.
 */
export function trailPoint(points: Point3[], u: number): Point3 {
  const clamped = Math.min(Math.max(u, 0), 1);
  const segments = points.length - 1;
  const scaled = clamped * segments;
  const i = Math.min(Math.floor(scaled), segments - 1);
  const t = scaled - i;

  const p0 = points[Math.max(i - 1, 0)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(i + 2, points.length - 1)];

  return [0, 1, 2].map((axis) =>
    catmullRom(p0[axis], p1[axis], p2[axis], p3[axis], t),
  ) as Point3;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** The curve's direction at `u`, normalised. */
export function trailTangent(points: Point3[], u: number): Point3 {
  const step = 1e-3;
  const a = trailPoint(points, Math.max(u - step, 0));
  const b = trailPoint(points, Math.min(u + step, 1));
  const d: Point3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const length = Math.hypot(...d) || 1;
  return [d[0] / length, d[1] / length, d[2] / length];
}

/**
 * How far along the curve, in world units, each of `SAMPLES` steps of `u` is.
 *
 * The curve's z is quadratic, so equal steps in `u` are wildly unequal steps
 * in space — at the far end one step is nearly ten times the length of one at
 * the near end. Anything that wants *even travel* has to go through here.
 */
const SAMPLES = 256;

function arcTable(points: Point3[]): number[] {
  const table = [0];
  let previous = trailPoint(points, 0);
  let total = 0;

  for (let i = 1; i <= SAMPLES; i++) {
    const at = trailPoint(points, i / SAMPLES);
    total += Math.hypot(at[0] - previous[0], at[1] - previous[1], at[2] - previous[2]);
    table.push(total);
    previous = at;
  }

  return table;
}

/** The `u` at which the curve has travelled `fraction` of its total length. */
export function uAtArc(points: Point3[], fraction: number): number {
  const table = arcTable(points);
  const target = Math.min(Math.max(fraction, 0), 1) * table[SAMPLES];

  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid] <= target) lo = mid;
    else hi = mid;
  }

  const span = table[hi] - table[lo];
  const within = span > 1e-9 ? (target - table[lo]) / span : 0;
  return (lo + within) / SAMPLES;
}

/**
 * Where memory `index` of `count` sits along the curve.
 *
 * Evenly spaced **by distance travelled**, not by curve parameter, and not
 * proportional to the time between memories: two photographs a week apart and
 * two five years apart should take the same effort to travel between, or the
 * reader spends the whole trail waiting.
 *
 * The first version of this spaced `u` evenly and claimed the same thing in
 * its comment. It was not true, and it showed: on a five-memory card the first
 * hop was 5 world units and the last was 50, so one scroll moved you barely
 * past the frame and the next threw you a third of the way down the trail.
 */
export function memoryU(points: Point3[], index: number, count: number): number {
  if (count <= 1) return MEMORY_START_U;

  const from = arcFractionAt(points, MEMORY_START_U);
  const to = arcFractionAt(points, MEMORY_END_U);
  return uAtArc(points, from + ((to - from) * index) / (count - 1));
}

/** The inverse of `uAtArc`: how much of the curve's length is behind `u`. */
function arcFractionAt(points: Point3[], u: number): number {
  const table = arcTable(points);
  const x = Math.min(Math.max(u, 0), 1) * SAMPLES;
  const i = Math.min(Math.floor(x), SAMPLES - 1);
  const within = x - i;
  return (table[i] + (table[i + 1] - table[i]) * within) / table[SAMPLES];
}

/* ---------------------------------------------------------------------------
 * The trail drifts (rev 6)
 * ------------------------------------------------------------------------ */

/**
 * How far the trail wanders from its own curve, in world units, at full
 * amplitude. About twice the ribbon's near width — enough to be seen moving,
 * small enough that it is still recognisably the same curve.
 */
const SWAY = 0.3;

/**
 * Where the point at `u` has drifted to, at time `t`.
 *
 * A contrail is gas, not wire. The curve itself is fixed — it is the card's
 * identity, seeded from the slug, and the memories hang at fixed places along
 * it — so this does not change the curve. It displaces what is *drawn* from
 * it, which is the difference between a trail that lives in the scene and a
 * stripe painted on the sky.
 *
 * Three sines with periods that share no common multiple, so the drift never
 * repeats, and each axis offset by `u` so the ribbon undulates along its
 * length rather than sliding about rigidly. Anchored at the near end, where
 * the satellite is actually attached to it, and freer further out — a trail
 * tethered at one end is what the eye already expects.
 *
 * Pure, and here beside the curve, because three things are drawn from it —
 * the ribbon, the memory glints, and anything else that lands on it — and all
 * of them have to wander together or the trail comes apart.
 */
export function trailSway(u: number, t: number, seed: number): Point3 {
  // Still at the satellite, loosening over the first quarter of the length.
  const anchored = Math.min(Math.max((u - 0.02) / 0.23, 0), 1);
  const ease = anchored * anchored * (3 - 2 * anchored);
  // And freer further out, where there is nothing holding it.
  const amplitude = SWAY * ease * (0.45 + 1.1 * u);

  return [
    Math.sin(t * 0.21 + u * 2.3 + seed) * amplitude,
    Math.cos(t * 0.17 + u * 1.7 + seed * 1.7) * amplitude * 0.75,
    Math.sin(t * 0.13 + u * 1.1 + seed * 2.3) * amplitude * 0.5,
  ];
}
