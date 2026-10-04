/**
 * The clock the experience runs on (spec v0.2 §22).
 *
 * These live in one place because several of them have to agree with each
 * other: `CameraRig` and `MessageCube` both animate the deployment and only
 * one of them may declare it finished, so both read `DEPLOY_MS`. Where two
 * constants must match, that is said here rather than in two component files
 * that can drift apart.
 */

/**
 * The closing screen holds as an ending before it offers a continuation.
 *
 * Only the orbit offer waits. The invitation to look inside the cube used to
 * wait longer still, so the two would not arrive together — but the cube is
 * already on the screen, so that offer is no surprise to hold back, and it is
 * now there from the first frame.
 */
export const ORBIT_HINT_MS = 3500;

/** Cube to satellite, and back. `CameraRig` must not outlast this. */
export const DEPLOY_MS = 3600;
/** One lap of the satellite's ellipse. */
export const ORBIT_PERIOD_S = 48;

/** Leaving orbit for the trail, and returning from it. */
export const REWIND_MS = 1800;
export const RESURFACE_MS = 1600;
/** One memory to the next. */
export const DRIFT_MS = 1100;

/**
 * The reply's flight (rev 7.1 §11, §17).
 *
 * Three and a half seconds rather than three, because r7 opens a bloom at
 * 62% of the way through and then lets the reply star settle out of it. At
 * 3000 the bloom and the landing were the same moment and neither read.
 */
export const LAUNCH_MS = 3400;
/** Where in that flight the rocket overtakes the comet, and blooms. */
export const LAUNCH_BLOOM_AT = 0.62;

/** How long "返事は、彗星より先に届きました。" stays up (§13, §17). */
export const REPLY_TOAST_MS = 4000;

/** The comet moment (spec v0.2 rev 5, §8.4-§8.7). */
export const DEPART_MS = 3600;
export const CHART_MS = 2600;
export const BOARD_MS = 2400;
export const HOME_MS = 1600;
export const SIGNATURE_DRAW_MS = 1800;

/** The orbit view's first-arrival hint, before it fades. */
export const ORBIT_TIP_MS = 4000;

/**
 * How long the orbit view waits, with nothing happening, before it points out
 * the way into the cube (rev 6).
 *
 * Long. The hub is somewhere to look at — the sky turns, the trail drifts, the
 * comet creeps along its path — and a card that starts suggesting things after
 * five seconds is a card that will not let you look at it. Twenty is about the
 * point where stillness stops being someone taking it in and starts being
 * someone who cannot find what to do next.
 */
export const ORBIT_IDLE_HINT_MS = 20000;

/**
 * Reduced motion does not mean no feedback: a state still has to change
 * visibly, or a button press reads as broken. It means the change is a
 * crossfade rather than a journey (§18).
 */
export const REDUCED_MS = 300;

/**
 * How long a ceremony runs when it is played again, as a fraction of the
 * first time.
 *
 * Two moments in this card are ceremonies rather than transitions: the cube
 * becoming a satellite, and the closing line being written by hand. Both are
 * worth their full length once — they are what the card is *for*. Neither is
 * worth it twice, because the second time the reader is no longer watching
 * something happen, they are waiting to get somewhere they have already been.
 *
 * Just over half: enough to feel brisk, not so little that the animation
 * stops reading as the same animation. Below about a third the accordion's
 * six panel hinges stop resolving as six separate things and the whole point
 * of the unfold is lost, so this is a floor as much as a preference.
 */
export const REPLAY_SCALE = 0.55;

/**
 * A duration, shortened if this is a replay.
 *
 * Unit-agnostic on purpose — it is a multiply, and the closing screen times
 * its stroke animations in seconds while everything else counts in
 * milliseconds. One function rather than two keeps the two halves of one
 * screen shortening by the same amount.
 */
export function replayed(value: number, again: boolean): number {
  return again ? value * REPLAY_SCALE : value;
}
