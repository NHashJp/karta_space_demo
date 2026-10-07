/**
 * The first-launch intro: the first time the cube becomes a satellite, before
 * anything asks for words.
 *
 * 1. **announce** — the promise in plain numbers, alone on the screen:
 *    あと X 日で、また会えます;
 * 2. **draw** — the comet's way home is drawn as a dashed line, from where it
 *    is today back to the planet;
 * 3. **run** — the comet's journey played fast: a ghost of it runs home along
 *    the dashes while the number counts down to zero. It follows the real
 *    orbit, so it creeps while far out and rushes the last stretch, as the
 *    real one will;
 * 4. **arrive** — it is home, and the card says what that day means.
 *
 * It is a **sunrise**, because the dawn is already the countdown (rev 7.1 §3):
 * the sun's height over あなたの星 is the comet's progress towards the day.
 * So the intro does not draw a sky of its own — it drives the real one. As
 * the number falls, the scene's own dawn runs forward from today to the day,
 * and at zero the sky, the sun, the planet's crescent and the light on the
 * satellite are exactly what this card will show on the morning the comet is
 * back. Then it all rewinds to today, which is where the reader actually is.
 *
 * One timeline, read by both the DOM caption and the scene, so the number and
 * the ghost cannot drift apart: each computes its own elapsed time from the
 * moment it mounted, and both mount on the same render.
 */

export const PREVIEW_ANNOUNCE_MS = 2400;
export const PREVIEW_DRAW_MS = 900;
export const PREVIEW_RUN_MS = 4600;
export const PREVIEW_ARRIVE_MS = 3000;

/** Reduced motion: no run. The number, the line, then the arrival. */
const REDUCED = { announce: 2400, draw: 0, run: 0, arrive: 2400 };

export type PreviewFrame = {
  /** The announcement is over and the path is being shown. */
  started: boolean;
  /** 0..1, how much of the dashed path is drawn. */
  draw: number;
  /** 0..1, how far the ghost has run home. 0 until the run starts. */
  run: number;
  /** The run is over and the comet is home. */
  arrived: boolean;
  /** 0..1 over the last moments, as everything fades for the chart. */
  out: number;
  /** The whole thing is over. */
  done: boolean;
};

/** How long the fade at the end takes, inside the arrival. */
const OUT_MS = 1000;

export function previewFrame(elapsedMs: number, reducedMotion: boolean): PreviewFrame {
  const d = reducedMotion
    ? REDUCED
    : {
        announce: PREVIEW_ANNOUNCE_MS,
        draw: PREVIEW_DRAW_MS,
        run: PREVIEW_RUN_MS,
        arrive: PREVIEW_ARRIVE_MS,
      };
  const drawFrom = d.announce;
  const runFrom = drawFrom + d.draw;
  const runTo = runFrom + d.run;
  const end = runTo + d.arrive;
  const started = elapsedMs >= drawFrom;

  return {
    started,
    draw: !started ? 0 : d.draw === 0 ? 1 : clamp((elapsedMs - drawFrom) / d.draw),
    run: d.run === 0 ? (elapsedMs >= runFrom ? 1 : 0) : clamp((elapsedMs - runFrom) / d.run),
    arrived: elapsedMs >= runTo,
    out: clamp((elapsedMs - (end - OUT_MS)) / OUT_MS),
    done: elapsedMs >= end,
  };
}

/**
 * Where the comet is along its cycle at this point of the intro, starting
 * from `today`'s progress: carried to 1 by the run, held there through the
 * arrival, and rewound to `today` as it fades. Both the comet and the dawn
 * are drawn from this one number, so the sun is never ahead of the comet.
 */
export function introProgress(today: number, frame: PreviewFrame): number {
  const from = Math.min(Math.max(today, 0), 1);
  const ahead = from + (1 - from) * frame.run;
  return ahead + (from - ahead) * easeInOut(frame.out);
}

/** The intro is showing the reunion day itself: arrived, not yet rewinding. */
export function showsTheDay(frame: PreviewFrame): boolean {
  return frame.arrived && frame.out === 0;
}

/** The countdown shown at a given point of the run: `days` down to 0. */
export function daysLeft(days: number, run: number): number {
  return Math.max(0, Math.round(days * (1 - run)));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function clamp(t: number): number {
  return Math.min(Math.max(t, 0), 1);
}
