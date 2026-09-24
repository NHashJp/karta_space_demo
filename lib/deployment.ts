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

/** The 3/4 view the satellite holds once deployed: yaw 35°, pitch −20°. */
export const DISPLAY_YAW = (35 * Math.PI) / 180;
export const DISPLAY_PITCH = (-20 * Math.PI) / 180;

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
