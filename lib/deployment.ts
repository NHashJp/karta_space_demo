/**
 * The deployment timeline (spec v0.2 §8.2).
 *
 * This is the moment the whole of v0.2 is built around: the letter you have
 * just finished reading turns over, unfolds four panels, lights a thruster and
 * rises into orbit. It is one animation with four overlapping parts, and the
 * overlaps are the point — a strict sequence of four steps reads as a list of
 * four things happening, while these bleed into each other and read as one
 * machine doing one thing.
 *
 * Pure, so the shape of it can be checked rather than watched: that the phases
 * overlap as specified, that nothing jumps, and that the reverse really is the
 * forward timeline backwards.
 */

/** Where each part of the deployment starts and ends, as a fraction of it. */
export const TURN = { from: 0, to: 0.25 };
/** The booms carry the folded wings out; the unfold follows (satelliteGeometry). */
export const PANELS = { from: 0.15, to: 0.75 };
export const THRUSTER = { from: 0.7, to: 0.8 };
export const RISE = { from: 0.6, to: 1 };

/**
 * The deployed satellite's size, in the units the scene is drawn in.
 *
 * These live here rather than in the components that use them because the
 * orbit's clearance over the planet is sized against them, and verify has to
 * be able to check that the wings actually fit — a tip that grazes the planet
 * is exactly the kind of thing nobody notices until it is on screen.
 */
export const SAT_SCALE = 0.42;
/** Bus half-width + boom + two array segments. */
export const SATELLITE_HALF_SPAN = 1 + 0.4 + 1 * 2;

/** How far a deployed wing tip reaches, at satellite scale. */
export function wingReach(): number {
  return SATELLITE_HALF_SPAN * SAT_SCALE;
}

/**
 * The 3/4 view the satellite holds once deployed: yaw −35°, pitch −20°.
 *
 * The yaw turns the **+X wing toward the camera**, which §3.1 asks for in so
 * many words: the near wing is the upper-right one *and the larger one*. Yawed
 * the other way the composition still reads at a glance — the axis is the same
 * diagonal — but the wing that is drawn big is the one going away, and the
 * satellite looks like it is receding rather than keeping station.
 */
export const DISPLAY_YAW = (-35 * Math.PI) / 180;
export const DISPLAY_PITCH = (-20 * Math.PI) / 180;
/**
 * And a roll, so the **wing axis lands at −50° on screen** (rev 6 §3.1).
 *
 * Without it the yaw and pitch alone leave the wings running at about −13°:
 * very nearly horizontal, which is not the diagonal the composition is built
 * around, and which makes the satellite's silhouette far wider than it should
 * be. This is what turns that −13° into the −50° asked for; `displayDirection`
 * below is what lets the checks measure whether it did.
 */
export const DISPLAY_ROLL = (36.5 * Math.PI) / 180;

/**
 * The order three has to apply those three angles in to mean what
 * `displayDirection` means.
 *
 * Yaw, then pitch, then roll is "ZXY" and not the "YXZ" the sequence reads
 * like, because three applies the axes right to left. It is a constant rather
 * than a string typed at the call site so that verify can check the two agree
 * — the wrong order is off by about twenty degrees, which is small enough to
 * look deliberate and large enough to put the wings somewhere the composition
 * checks never looked.
 */
export const DISPLAY_EULER_ORDER = "ZXY";

/**
 * Where the satellite's local +X — its wing axis — points once the display
 * orientation is applied, in world space.
 *
 * Pure, and shared: `framing` uses it to build the projected hull the
 * composition checks measure, and `MessageCube` turns the cube by the same
 * three angles. A hull that disagrees with the thing on screen is worse than
 * no hull at all — it was how the wings came to be measured at −50° while
 * being drawn horizontal.
 */
export function displayDirection(local: [number, number, number]): [number, number, number] {
  const [x, y, z] = local;

  // Yaw about Y.
  const cy = Math.cos(DISPLAY_YAW);
  const sy = Math.sin(DISPLAY_YAW);
  const ax = x * cy + z * sy;
  const az = -x * sy + z * cy;

  // Pitch about X.
  const cp = Math.cos(DISPLAY_PITCH);
  const sp = Math.sin(DISPLAY_PITCH);
  const by = y * cp - az * sp;
  const bz = y * sp + az * cp;

  // Roll about Z, which is what sets the on-screen angle.
  const cr = Math.cos(DISPLAY_ROLL);
  const sr = Math.sin(DISPLAY_ROLL);
  return [ax * cr - by * sr, ax * sr + by * cr, bz];
}

export type Deployment = {
  /** Turning from the last face towards the display orientation. */
  turn: number;
  /** How far the panels have swung up. */
  panels: number;
  /** The thruster's flash: 0 → 1 → 0 across its window. */
  thruster: number;
  /** How far onto the orbit the cube has travelled, and how far it has shrunk. */
  rise: number;
};

function span(t: number, window: { from: number; to: number }): number {
  return clamp((t - window.from) / (window.to - window.from));
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Smooth at both ends, so no part of the deployment starts or stops abruptly. */
export function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * The state of the deployment at `t` in 0..1.
 *
 * `t` runs forwards when the cube is becoming a satellite and backwards when
 * it is coming home, so undocking and docking are the same timeline read in
 * opposite directions — which is how the closing screen is guaranteed to come
 * back exactly as it was left.
 */
export function deploymentAt(t: number): Deployment {
  const clamped = clamp(t);
  return {
    turn: ease(span(clamped, TURN)),
    panels: ease(span(clamped, PANELS)),
    // Up and back down again within its window: a pulse, not a switch.
    thruster: Math.sin(Math.PI * span(clamped, THRUSTER)),
    rise: ease(span(clamped, RISE)),
  };
}
