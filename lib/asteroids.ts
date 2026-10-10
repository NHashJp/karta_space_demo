import { hashSeed, seededUnit } from "./seed.ts";

/**
 * Rocks passing through the hub.
 *
 * The hub is a place you sit in — the satellite holds its mark, the sky turns
 * slowly behind it — and the one thing a place needs that a picture does not
 * is something happening that nobody arranged. Roughly every half minute some
 * piece of debris crosses the deep field, tumbling, and is gone. It is not a
 * feature: there is nothing to press and nothing to miss. If a reader never
 * notices one, it has still done its job, because what it is buying is the
 * sense that the sky is not a backdrop.
 *
 * Everything here is *geometry and a timetable*, no three.js and no React, for
 * the usual reason: the one thing that must never happen is a rock going
 * through the satellite, and that is a claim about numbers. It is guaranteed by
 * construction rather than by rejection sampling — every path is built around
 * its own closest-approach point, so the miss distance is an input, not an
 * outcome — and verify measures it against the satellite's real hull.
 *
 * They pass **behind**. A rock crossing in front of the subject of the screen
 * reads as a near miss, which is a drama the card is not telling; one crossing
 * behind it reads as distance. That is also why it is a tumbling rock rather
 * than a streak — a streak is the returned day's flourish (`MeteorShower`), and
 * the two should never be mistaken for each other.
 */

export type Vec3 = [number, number, number];

/* ---------------------------------------------------------------------------
 * The timetable
 * ------------------------------------------------------------------------- */

/** Mean gap between passes, in seconds. */
export const PASS_MEAN_S = 30;

/**
 * Poisson, not metronome: the gap is drawn from an exponential distribution,
 * so two can tread on each other's heels and then nothing happens for a
 * minute. A fixed thirty seconds would be a clock, and a clock in the corner
 * of the sky is something a reader starts waiting for.
 *
 * Clamped at both ends. The floor keeps two from being released in the same
 * breath, which reads as a shower rather than as debris; the ceiling keeps the
 * tail from handing someone four empty minutes.
 */
export const PASS_MIN_GAP_S = 6;
export const PASS_MAX_GAP_S = 150;

/**
 * How many may be in flight at once.
 *
 * Sized from the timetable rather than chosen: with a mean gap of 30 s and a
 * crossing taking 14-37 s, there is nothing in the sky about half the time,
 * one rock a third of it, and four or more for a quarter of a per cent — but
 * "rare" is not "never", and the worst case over sixty cards' worth of
 * timetable is six. Eight is that, with room. A slot is an invisible mesh when
 * it is unused, so the headroom costs nothing and the alternative is dropping
 * a pass that was due, which verify would rather catch than allow.
 */
export const POOL = 8;

/* ---------------------------------------------------------------------------
 * The path
 * ------------------------------------------------------------------------- */

/**
 * The closest a rock may come to the satellite, in world units.
 *
 * The satellite's deployed hull reaches about 2.0 units from its centre, so
 * this is a clearance of more than twice its own half-span. Verify measures it
 * against `satelliteHull()` rather than against this number, so a satellite
 * that grows cannot quietly eat the margin.
 */
export const MIN_MISS = 4.5;
export const MAX_MISS = 12;

/** And at least this far behind it, along the view axis. */
export const BEHIND = 2.2;

/**
 * How far off the screen plane a rock may be heading, as a fraction.
 *
 * Small on purpose. A path with much z in it either flies at the camera —
 * which is a different and more alarming event — or recedes to a dot, which is
 * not a pass. Near-horizontal paths cross the frame, which is what a pass is.
 * Together with `BEHIND` and `RANGE` it is also what keeps the whole flight
 * well behind the camera: see the clearance check in verify.
 */
export const Z_TILT = 0.18;

/** Half the flight, in world units: it enters and leaves far off-frame. */
export const RANGE = 22;

export const SPEED_MIN = 1.2;
export const SPEED_MAX = 3.2;
export const RADIUS_MIN = 0.09;
export const RADIUS_MAX = 0.44;
/** How many distinct rocks are modelled; each pass picks one. */
export const SHAPES = 4;

/** Slow. A rock spinning fast reads as a prop being thrown past the lens. */
const SPIN_MAX = 0.34;

/** Draws per pass. Generous, so adding one later cannot shift the others. */
const STRIDE = 24;

export type AsteroidPass = {
  /** Its place in the card's own sequence of passes. */
  index: number;
  /** Seconds after the hub opened, when it enters. */
  startAt: number;
  /** Seconds it takes to cross. */
  duration: number;
  from: Vec3;
  /** Unit vector. */
  direction: Vec3;
  /** World units per second. */
  speed: number;
  /** Closest approach to the satellite, in world units — exact, by construction. */
  miss: number;
  radius: number;
  /** Radians per second about each axis. */
  spin: Vec3;
  /** Which modelled rock, 0..SHAPES-1. */
  shape: number;
  /** 0 (dark, iron) to 1 (pale, dusty). */
  tint: number;
};

/** Its own seed, so two cards do not share a timetable. */
export function asteroidSeed(slug: string): number {
  return hashSeed(`${slug}:asteroids`);
}

/** Successive draws for one pass, from a disjoint slice of the seed's space. */
function draws(seed: number, index: number): () => number {
  let i = index * STRIDE;
  return () => seededUnit(seed, i++);
}

/** The gap before pass `index`, in seconds. */
export function passGap(seed: number, index: number, mean = PASS_MEAN_S): number {
  const u = seededUnit(seed, index * STRIDE + STRIDE - 1);
  // -mean * ln(1-u) is the exponential; 1-u avoids log(0) at u = 1.
  const gap = -mean * Math.log(1 - u);
  return Math.min(Math.max(gap, PASS_MIN_GAP_S), PASS_MAX_GAP_S);
}

/**
 * One pass, without its start time.
 *
 * The construction, which is the whole point of this file:
 *
 * 1. A near-horizontal travel direction `d`.
 * 2. An orthonormal pair perpendicular to it — `n`, which is horizontal by
 *    construction (`n.z == 0`), and `m = d × n`, whose z component is
 *    therefore the full `-h`. So *everything* about how far behind the
 *    satellite the path runs is carried by one coordinate.
 * 3. The closest-approach point `c`, placed in that perpendicular plane at
 *    exactly `miss` from the satellite, with its angle restricted to the arc
 *    where `c.z <= -BEHIND`.
 * 4. The rock enters at `c - d * RANGE` and leaves at `c + d * RANGE`.
 *
 * Because `c` is perpendicular to `d`, it *is* the closest point of the line
 * to the origin, so the miss distance is `|c| = miss`. No search, no retry,
 * and nothing to get wrong as the numbers are tuned.
 */
export function asteroidPass(seed: number, index: number): Omit<AsteroidPass, "startAt"> {
  const next = draws(seed, index);

  // 1. Direction: a heading in the screen plane, with a little z on it.
  const heading = next() * Math.PI * 2;
  const tilt = (next() * 2 - 1) * Z_TILT;
  const h = Math.sqrt(1 - tilt * tilt);
  const d: Vec3 = [h * Math.cos(heading), h * Math.sin(heading), tilt];

  // 2. The perpendicular plane. n is horizontal; m holds all of the depth.
  const n: Vec3 = [d[1] / h, -d[0] / h, 0];
  const m: Vec3 = [(d[2] * d[0]) / h, (d[2] * d[1]) / h, -h];

  // 3. Closest approach: exactly `miss` out, and at least `BEHIND` back.
  const miss = MIN_MISS + next() * (MAX_MISS - MIN_MISS);
  const sinMin = Math.min(1, BEHIND / (miss * h));
  const sin = sinMin + next() * (1 - sinMin);
  const cos = Math.sqrt(Math.max(0, 1 - sin * sin)) * (next() < 0.5 ? -1 : 1);
  const c: Vec3 = [
    miss * (cos * n[0] + sin * m[0]),
    miss * (cos * n[1] + sin * m[1]),
    miss * (cos * n[2] + sin * m[2]),
  ];

  // 4. In from one side, out the other.
  const speed = SPEED_MIN + next() * (SPEED_MAX - SPEED_MIN);
  return {
    index,
    duration: (2 * RANGE) / speed,
    from: [c[0] - d[0] * RANGE, c[1] - d[1] * RANGE, c[2] - d[2] * RANGE],
    direction: d,
    speed,
    miss,
    radius: RADIUS_MIN + Math.pow(next(), 1.7) * (RADIUS_MAX - RADIUS_MIN),
    spin: [
      (next() * 2 - 1) * SPIN_MAX,
      (next() * 2 - 1) * SPIN_MAX,
      (next() * 2 - 1) * SPIN_MAX,
    ],
    shape: Math.min(SHAPES - 1, Math.floor(next() * SHAPES)),
    tint: next(),
  };
}

/** Where a pass is, `local` seconds after it entered. */
export function asteroidAt(pass: Omit<AsteroidPass, "startAt">, local: number): Vec3 {
  const travelled = pass.speed * local;
  return [
    pass.from[0] + pass.direction[0] * travelled,
    pass.from[1] + pass.direction[1] * travelled,
    pass.from[2] + pass.direction[2] * travelled,
  ];
}

/**
 * The card's timetable: `count` passes with absolute start times.
 *
 * Computed once and walked, rather than a timer deciding each time. It is the
 * same reason the comet is drawn from its dates: a sequence that exists as
 * numbers can be checked, and a card reopened twice behaves the same way.
 */
export function asteroidPasses(seed: number, count: number, mean = PASS_MEAN_S): AsteroidPass[] {
  const passes: AsteroidPass[] = [];
  let at = 0;
  for (let index = 0; index < count; index++) {
    at += passGap(seed, index, mean);
    passes.push({ ...asteroidPass(seed, index), startAt: at });
  }
  return passes;
}

/**
 * Closest approach of a pass's *segment* to a point.
 *
 * The miss distance is about the infinite line, which is the right thing for
 * the satellite at the origin, but the camera is off to one side and a rock
 * that never reaches the near part of its line could be clear of it anyway.
 * Verify uses this for the camera, so the clearance it reports is the one a
 * reader could actually be shown.
 */
export function clearance(pass: Omit<AsteroidPass, "startAt">, point: Vec3): number {
  const length = 2 * RANGE;
  const w: Vec3 = [
    point[0] - pass.from[0],
    point[1] - pass.from[1],
    point[2] - pass.from[2],
  ];
  const along = w[0] * pass.direction[0] + w[1] * pass.direction[1] + w[2] * pass.direction[2];
  const s = Math.min(Math.max(along, 0), length);
  const at = asteroidAt(pass, s / pass.speed);
  return Math.hypot(point[0] - at[0], point[1] - at[1], point[2] - at[2]);
}
