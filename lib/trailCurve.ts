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
 * Where memory `index` of `count` sits along the curve. Evenly spaced rather
 * than proportional to the time between memories: two photographs a week apart
 * and two five years apart should take the same effort to travel between, or
 * the reader spends the whole trail waiting.
 */
export function memoryU(index: number, count: number): number {
  if (count <= 1) return MEMORY_START_U;
  const step = (MEMORY_END_U - MEMORY_START_U) / (count - 1);
  return MEMORY_START_U + index * step;
}
