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
 * One timeline, read by both the DOM caption and the scene, so the number and
 * the ghost cannot drift apart: each computes its own elapsed time from the
 * moment it mounted, and both mount on the same render.
 */

export const PREVIEW_ANNOUNCE_MS = 2400;
export const PREVIEW_DRAW_MS = 900;
export const PREVIEW_RUN_MS = 4600;
export const PREVIEW_ARRIVE_MS = 2200;

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
const OUT_MS = 600;

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

/** The countdown shown at a given point of the run: `days` down to 0. */
export function daysLeft(days: number, run: number): number {
  return Math.max(0, Math.round(days * (1 - run)));
}

function clamp(t: number): number {
  return Math.min(Math.max(t, 0), 1);
}
