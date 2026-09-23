/**
 * The clock the experience runs on (spec v0.2 §22).
 *
 * These live in one place because several of them have to agree with each
 * other: `CameraRig` and `MessageCube` both animate the deployment and only
 * one of them may declare it finished, so both read `DEPLOY_MS`. Where two
 * constants must match, that is said here rather than in two component files
 * that can drift apart.
 */

/** The closing screen holds as an ending before it offers a continuation. */
export const ORBIT_HINT_MS = 3500;
/** And the secret waits longer still when there is an orbit offer above it. */
export const SECRET_HINT_MS = 6000;
export const SECRET_HINT_WITH_ORBIT_MS = 7000;

/** Cube to satellite, and back. `CameraRig` must not outlast this. */
export const DEPLOY_MS = 3200;
/** One lap of the satellite's ellipse. */
export const ORBIT_PERIOD_S = 48;

/** Leaving orbit for the trail, and returning from it. */
export const REWIND_MS = 1800;
export const RESURFACE_MS = 1600;
/** One memory to the next. */
export const DRIFT_MS = 1100;

export const LAUNCH_MS = 2600;
export const RELEASE_MS = 3200;
export const SIGNATURE_DRAW_MS = 1800;

/** The orbit view's first-arrival hint, before it fades. */
export const ORBIT_TIP_MS = 4000;

/**
 * Reduced motion does not mean no feedback: a state still has to change
 * visibly, or a button press reads as broken. It means the change is a
 * crossfade rather than a journey (§18).
 */
export const REDUCED_MS = 300;

/** The duration to use for a phase, honouring the reader's preference. */
export function duration(ms: number, reducedMotion: boolean): number {
  return reducedMotion ? Math.min(ms, REDUCED_MS) : ms;
}
