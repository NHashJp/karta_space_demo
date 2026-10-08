import { hashSeed, seededUnit } from "./seed.ts";

/**
 * Shooting stars: the classic thing, occasionally, far out in the sky.
 *
 * A short bright streak with a tail that tapers away behind it, appearing in
 * the upper sky, sliding a little way down and across in a second and a half,
 * and gone — the dawn mockup's meteor. It asks for nothing and means
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
 * | speed | a glimpse — about 1.5 s | slow — 4.2 s |
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

/**
 * The orbit view's own, busier sky: an extra stream of shooting stars at
 * about one every six seconds, on top of the ordinary one. The hub is the
 * screen a reader sits in rather than reads, under the open sky of the
 * dawn mockup, so it is the one place more of them is welcome.
 */
export const ORBIT_MEAN_GAP_S = 6;

/**
 * Now and then, a big one: about one in eight is a fireball rather than a
 * streak — longer, thicker, brighter at the head, and slower, because a
 * heavier thing burns longer. Rare enough that each one is a small event.
 */
export const BIG_CHANCE = 0.12;
export const BIG = { length: 2.4, width: 2.2, duration: 1.4, travel: 1.8, glow: 1.6 };
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

/**
 * The dawn mockup's meteor (rev 7.1): a streak that is visible for about a
 * quarter of a 6¼-second beat, so a second and a half, give or take.
 */
export const DURATION_MIN = 1.3;
export const DURATION_MAX = 1.8;

/**
 * The streak, as a share of the frame: the mockup's is 6% of the width
 * across by 5% of the height down. Multiplied by the frame's own shape, so
 * it is the same short dash on a phone as on a desktop.
 */
export const STREAK = { across: 0.06, down: 0.05 };
/** And the distance its head slides: 12% of the width, 10% of the height. */
export const SLIDE = { across: 0.12, down: 0.1 };

/** And how thick, in half-heights. A few pixels: it is a line, not a rod. */
export const WIDTH = 0.018;

/**
 * Where it may appear, as fractions of the frame from the top left: the open
 * upper-left sky, as in the mockup. The lower part of the frame is where the
 * planet rises and every control sits, and the top right is the promise's
 * caption.
 */
export const APPEAR = { left: 0.1, right: 0.7, top: 0.05, bottom: 0.32 };

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
  /** A fireball (`BIG`): drawn wider and brighter at the head. */
  big: boolean;
};

/** Its own seed, so no two cards share a sky. */
export function shootingStarSeed(slug: string): number {
  return hashSeed(`${slug}:shooting`);
}

function draws(seed: number, index: number): () => number {
  let i = index * STRIDE;
  return () => seededUnit(seed, i++);
}

/**
 * The gap before star `index`, in seconds, for a stream averaging `meanGap`.
 * The floor shrinks with a busier stream, so a faster sky is still Poisson
 * rather than a stream clamped into a beat.
 */
export function starGap(seed: number, index: number, meanGap = MEAN_GAP_S): number {
  const u = seededUnit(seed, index * STRIDE + STRIDE - 1);
  const gap = -meanGap * Math.log(1 - u);
  return Math.min(Math.max(gap, Math.min(MIN_GAP_S, meanGap * 0.3)), MAX_GAP_S);
}

/**
 * One shooting star, for a frame of the given aspect — drawn the way the dawn
 * mockup draws its meteors.
 *
 * It appears *in* the open sky rather than flying in from an edge, slides a
 * short way down and to the right, and fades in and out as it goes: a short
 * bright dash of a thing, glimpsed rather than tracked. The old ones raced
 * the whole width of the frame in a second, from off screen to off screen,
 * and were mostly over before anyone had seen them.
 */
export function shootingStar(
  seed: number,
  index: number,
  aspect: number,
): Omit<ShootingStar, "startAt"> {
  const next = draws(seed, index);
  const halfW = Math.max(aspect, 0.4);

  // Frame fractions (from the top left) to half-height units (centred, y up).
  const u = APPEAR.left + next() * (APPEAR.right - APPEAR.left);
  const v = APPEAR.top + next() * (APPEAR.bottom - APPEAR.top);
  const from: Vec2 = [(u * 2 - 1) * halfW, 1 - v * 2];

  // Down and to the right, at the frame's own diagonal, with a little play.
  const slide: Vec2 = [SLIDE.across * 2 * halfW, -SLIDE.down * 2];
  const angle = Math.atan2(slide[1], slide[0]) + (next() * 2 - 1) * 0.15;
  const direction: Vec2 = [Math.cos(angle), Math.sin(angle)];
  const travel = Math.hypot(slide[0], slide[1]) * (0.85 + next() * 0.3);

  const duration = DURATION_MIN + next() * (DURATION_MAX - DURATION_MIN);
  const streak = Math.hypot(STREAK.across * 2 * halfW, STREAK.down * 2);
  const length = streak * (0.8 + next() * 0.4);
  const depth = DEPTH_MIN + next() * (DEPTH_MAX - DEPTH_MIN);
  const tint = Math.pow(next(), 1.6);
  // Drawn last, so every ordinary star is exactly the star it always was.
  const big = next() < BIG_CHANCE;

  const lasts = big ? duration * BIG.duration : duration;
  return {
    index,
    duration: lasts,
    from,
    direction,
    speed: (big ? travel * BIG.travel : travel) / lasts,
    length: big ? length * BIG.length : length,
    depth,
    tint,
    big,
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
 * A half sine, as the mockup has it: it swells out of the sky and thins
 * back into it, and is never a line being switched on or off.
 */
export function brightness(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  return Math.sin(Math.PI * p);
}

/** The card's own timetable: `count` stars with absolute start times. */
export function shootingStars(
  seed: number,
  count: number,
  aspect: number,
  meanGap = MEAN_GAP_S,
): ShootingStar[] {
  const stars: ShootingStar[] = [];
  let at = 0;
  for (let index = 0; index < count; index++) {
    at += starGap(seed, index, meanGap);
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
