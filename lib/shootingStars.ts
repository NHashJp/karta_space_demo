import { hashSeed, seededUnit } from "./seed.ts";

/**
 * Shooting stars: the classic thing, occasionally, far out in the sky.
 *
 * A bright head with a tail that tapers away behind it, crossing a corner of
 * the frame in a second or so and gone. It asks for nothing and means
 * nothing — which is the point. The hub already has objects that *mean*
 * things (the comet is a countdown, the trail is a memory, the satellite is
 * the letter), and a sky made entirely of meaningful objects stops reading as
 * a sky.
 *
 * ## Not the meteor shower
 *
 * `MeteorShower` already exists and must not be confused with this. It is
 * five slow warm streaks, **once**, on the day something comes back — "once
 * is the whole design; a shower that repeated would become weather, and the
 * day would stop being a day." Making shooting stars ambient would take that
 * away by making the rare thing ordinary.
 *
 * So they are deliberately different objects, and held apart three ways:
 *
 * | | Shooting star | Meteor shower |
 * |---|---|---|
 * | when | every ~14 s, always | once, on the day |
 * | how many | one | five together |
 * | speed | fast — about 1.2 s | slow — 4.2 s |
 * | colour | white, faintly cool | warm `#ffe9c9` |
 *
 * and the field goes quiet while the shower is playing (`QUIET_AFTER_S`), so
 * the day's flourish is never muddled by an ordinary one crossing it.
 *
 * ## Why the path is in frame units, not world units
 *
 * A shooting star is a thing you see, not a thing that is somewhere. What
 * matters is that it crosses *the frame* — and the frame is a very different
 * shape on a phone than on a desktop. Placed in world coordinates, a path
 * tuned to look good on a laptop misses the screen entirely in portrait,
 * where the visible width at that distance is a third as wide.
 *
 * So a path is defined in **half-height units**: y of ±1 is the top and
 * bottom of the frame, and x of ±`aspect` the sides. Angles are true in those
 * units, so a 30° diagonal is a 30° diagonal on every screen, and the
 * component converts to world space using the camera's own frustum at the
 * star's depth. That also makes "does it actually cross the frame" something
 * verify can check, rather than something you find out on someone's phone.
 */

export type Vec2 = [number, number];

/* ---------------------------------------------------------------------------
 * How often
 * ------------------------------------------------------------------------- */

/** Mean seconds between them. */
export const MEAN_GAP_S = 14;
/**
 * Poisson, like the asteroids: the gap is drawn from an exponential, so they
 * arrive in their own time rather than on a beat. Clamped so two never land
 * on top of each other and the tail never leaves a minute of nothing.
 */
export const MIN_GAP_S = 3.5;
export const MAX_GAP_S = 70;

/** How many can be crossing at once. They last ~1.2 s, so this is generous. */
export const POOL = 3;

/**
 * How long the sky holds still once the satellite reaches orbit on a returned
 * day, so the meteor shower has it to itself.
 *
 * Measured from the moment the shower starts, not from the start of the
 * session: the shower plays when the satellite arrives, which may be minutes
 * after the card was opened. An earlier version of this delayed the
 * *timetable* instead, which looked right and protected nothing — by the time
 * the shower ran, the delay was long since over.
 *
 * Longer than the shower's own 4.2 s, so nothing starts while it is still on
 * screen.
 */
export const QUIET_AFTER_S = 5;

/* ---------------------------------------------------------------------------
 * What one looks like
 * ------------------------------------------------------------------------- */

/** How far out they fly. Far enough to be sky rather than something nearby. */
export const DEPTH_MIN = 34;
export const DEPTH_MAX = 62;

export const DURATION_MIN = 0.9;
export const DURATION_MAX = 1.7;

/** The streak itself, in half-heights: a quarter to two thirds of the frame. */
export const LENGTH_MIN = 0.3;
export const LENGTH_MAX = 0.62;

/** And how thick, in half-heights. A few pixels: it is a line, not a rod. */
export const WIDTH = 0.018;

/** Far enough to carry it off the other side from wherever it came in. */
export const TRAVEL = 3.4;

/** Draws per star, with room to add one later without shifting the others. */
const STRIDE = 16;

export type ShootingStar = {
  index: number;
  /** Seconds after the sky opened. */
  startAt: number;
  duration: number;
  /** Where the head enters, in half-height units. Always off-frame. */
  from: Vec2;
  /** Unit vector, in the same units, so the angle is true on every screen. */
  direction: Vec2;
  /** Half-heights per second. */
  speed: number;
  /** Streak length and depth. */
  length: number;
  depth: number;
  /** 0 white, 1 faintly warm. */
  tint: number;
};

/** Its own seed, so no two cards share a sky. */
export function shootingStarSeed(slug: string): number {
  return hashSeed(`${slug}:shooting`);
}

function draws(seed: number, index: number): () => number {
  let i = index * STRIDE;
  return () => seededUnit(seed, i++);
}

/** The gap before star `index`, in seconds. */
export function starGap(seed: number, index: number): number {
  const u = seededUnit(seed, index * STRIDE + STRIDE - 1);
  const gap = -MEAN_GAP_S * Math.log(1 - u);
  return Math.min(Math.max(gap, MIN_GAP_S), MAX_GAP_S);
}

/**
 * One shooting star, for a frame of the given aspect.
 *
 * It enters through the top most of the time, and through the upper part of a
 * side the rest — which is simply where they read best. The lower third of
 * the frame is where the planet rises and every control sits, and a streak
 * crossing it would be competing with the interface rather than decorating
 * the sky.
 *
 * Whichever edge it enters by, it is aimed back across the frame rather than
 * out of it: a star that enters at the top right heading right is on screen
 * for a tenth of a second and reads as a glitch.
 */
export function shootingStar(
  seed: number,
  index: number,
  aspect: number,
): Omit<ShootingStar, "startAt"> {
  const next = draws(seed, index);
  const halfW = Math.max(aspect, 0.4);

  const edge = next();
  let from: Vec2;
  let angle: number; // radians, measured clockwise from straight down

  if (edge < 0.7) {
    // In through the top, heading down and across.
    const x = (next() * 2 - 1) * halfW * 1.05;
    from = [x, 1.14];
    // Aimed back towards the middle, plus a little of its own.
    angle = (-x / halfW) * 0.62 + (next() * 2 - 1) * 0.4;
  } else {
    // In through the upper part of one side, heading down and inwards.
    const side = edge < 0.85 ? -1 : 1;
    from = [side * halfW * 1.08, 0.25 + next() * 0.85];
    angle = side * -(0.75 + next() * 0.5);
  }

  const direction: Vec2 = [Math.sin(angle), -Math.cos(angle)];
  const duration = DURATION_MIN + next() * (DURATION_MAX - DURATION_MIN);

  return {
    index,
    duration,
    from,
    direction,
    speed: TRAVEL / duration,
    length: LENGTH_MIN + next() * (LENGTH_MAX - LENGTH_MIN),
    depth: DEPTH_MIN + next() * (DEPTH_MAX - DEPTH_MIN),
    tint: Math.pow(next(), 1.6),
  };
}

/** Where the head is, `local` seconds in. */
export function headAt(star: Omit<ShootingStar, "startAt">, local: number): Vec2 {
  const travelled = star.speed * local;
  return [
    star.from[0] + star.direction[0] * travelled,
    star.from[1] + star.direction[1] * travelled,
  ];
}

/**
 * How bright it is, `0..1` through its flight.
 *
 * In fast and out slow, which is what a meteor does and also what keeps it
 * from looking like a line being switched on: by the time it is bright it is
 * already moving, and it thins away rather than stopping.
 */
export function brightness(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  const rise = Math.min(1, p / 0.12);
  const fall = 1 - Math.min(1, Math.max(0, (p - 0.55) / 0.45));
  return rise * fall * fall;
}

/** The card's own timetable: `count` stars with absolute start times. */
export function shootingStars(seed: number, count: number, aspect: number): ShootingStar[] {
  const stars: ShootingStar[] = [];
  let at = 0;
  for (let index = 0; index < count; index++) {
    at += starGap(seed, index);
    stars.push({ ...shootingStar(seed, index, aspect), startAt: at });
  }
  return stars;
}

/**
 * Does this one actually cross the visible frame?
 *
 * The question the frame-unit path exists to make answerable. Sampled along
 * the flight: true if the head is ever inside the frame with the star bright
 * enough to see.
 */
export function crossesFrame(
  star: Omit<ShootingStar, "startAt">,
  aspect: number,
  steps = 120,
): boolean {
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    if (brightness(progress) < 0.2) continue;
    const [x, y] = headAt(star, progress * star.duration);
    if (Math.abs(x) <= aspect && Math.abs(y) <= 1) return true;
  }
  return false;
}
