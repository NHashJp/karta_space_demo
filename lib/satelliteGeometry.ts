/**
 * The satellite's shape and how it opens (spec v0.2 rev 6, §2.1).
 *
 * Pure, and deliberately so: three different things need to agree about where
 * a panel is. `SolarWings` draws it, the framing checks measure the projected
 * hull against the composition targets, and verify asserts that no panel ever
 * passes through the body or through another panel. A shape that only exists
 * inside a component cannot be checked, and this one has to be — a wing that
 * clips through the bus for four frames mid-deployment is exactly the kind of
 * thing nobody sees until it is in front of someone.
 *
 * All sizes are in cube units: the cube edge is 2, and its local axes are X
 * (the wing axis), Y (up) and Z (the front face).
 */

/** Half the cube's edge. */
export const BUS_HALF = 1;

export const BOOM_L = 0.5;
export const BOOM_RADIUS = 0.03;

export const N_PANELS = 3;
/** Along X, when the wing is flat. */
export const PANEL_W = 1.1;
/** Along Y. */
export const PANEL_H = 1.9;
export const PANEL_THICKNESS = 0.02;

/** The mast on the top face, carrying the nav light. */
export const MAST_HEIGHT = 0.45;
export const MAST_AT: Vec3 = [0.4, 1, 0.4];

/** Folded, each panel is turned this far off the wing axis. */
export const WING_FOLD_MAX = (84 * Math.PI) / 180;

/** Tip to tip, fully deployed: 2 + 2 × (0.5 + 3 × 1.1). */
export const DEPLOYED_SPAN = 2 * BUS_HALF + 2 * (BOOM_L + N_PANELS * PANEL_W);

export type Vec3 = [number, number, number];

/**
 * The stack grows out of the face over the first half of the boom's travel, so
 * it is never larger than the gap it has been carried into. Without it, a
 * folded wing at `boom = 0` sits inside the cube.
 */
function emergence(boom: number): number {
  return clamp01(boom / 0.5);
}

/**
 * The four hinge points of one wing: the root, then the far end of each panel.
 *
 * `side` is +1 or −1. `unfold` may be one value for the whole wing, or one per
 * panel — the three hinges are staggered during deployment (§2.2), so the
 * panels are not all at the same angle at the same time.
 *
 * The fold alternates in sign panel by panel, which is what makes it an
 * accordion rather than a curl: folded, the panels lie back against each other
 * beside the face; flat, they are in line.
 */
export function wingChain(side: 1 | -1, boom: number, unfold: number | number[]): Vec3[] {
  const grow = emergence(boom);
  const root: Vec3 = [side * (BUS_HALF + BOOM_L * boom), 0, 0];
  const points: Vec3[] = [root];

  let previous = root;
  for (let k = 0; k < N_PANELS; k++) {
    const own = Array.isArray(unfold) ? (unfold[k] ?? 0) : unfold;
    const angle = WING_FOLD_MAX * (1 - clamp01(own)) * (k % 2 === 0 ? 1 : -1);
    const length = PANEL_W * grow;

    const next: Vec3 = [
      previous[0] + side * Math.cos(angle) * length,
      previous[1],
      previous[2] + Math.sin(angle) * length,
    ];
    points.push(next);
    previous = next;
  }

  return points;
}

/* -------------------------------------------------------------------------
 * The deployment timeline (§2.2), in deploy `t`.
 * ---------------------------------------------------------------------- */

export const BOOM_WINDOW = { from: 0.15, to: 0.35 };
export const UNFOLD_WINDOW = { from: 0.35, to: 0.75 };

/** 120 ms between hinges, and the near wing 80 ms behind the far one. */
export const WING_STAGGER_MS = 120;
export const NEAR_WING_DELAY_MS = 80;

/** Wing 0 is the far one; wing 1 is nearer the camera and follows it. */
export type WingIndex = 0 | 1;

export function boomAt(t: number): number {
  return smooth(span(t, BOOM_WINDOW));
}

/**
 * How far each of a wing's three panels has unfolded at deploy `t`.
 *
 * Every panel takes the same time; they simply start at different moments, and
 * the last one still finishes exactly when the window closes. That is what
 * makes it read as a chain being released rather than three separate hinges.
 */
export function unfoldAt(t: number, wing: WingIndex, deployMs: number): number[] {
  const stagger = WING_STAGGER_MS / deployMs;
  const delay = (wing === 1 ? NEAR_WING_DELAY_MS : 0) / deployMs;
  const window = UNFOLD_WINDOW.to - UNFOLD_WINDOW.from;
  // The last panel to start must still land on `to`.
  const each = window - ((N_PANELS - 1) * stagger + delay);

  return Array.from({ length: N_PANELS }, (_, k) => {
    const from = UNFOLD_WINDOW.from + delay + k * stagger;
    return smooth(clamp01((t - from) / each));
  });
}

/**
 * Every point on the satellite's hull, in its own local space: the body's
 * corners, and each panel's four corners. Used by the framing checks to
 * measure the projected silhouette against the composition targets (§3.1).
 */
export function hullPoints(boom: number, unfold: number | number[]): Vec3[] {
  const points: Vec3[] = [];

  for (const x of [-BUS_HALF, BUS_HALF]) {
    for (const y of [-BUS_HALF, BUS_HALF]) {
      for (const z of [-BUS_HALF, BUS_HALF]) points.push([x, y, z]);
    }
  }

  for (const side of [1, -1] as const) {
    const chain = wingChain(side, boom, unfold);
    for (const [x, y, z] of chain) {
      points.push([x, y + PANEL_H / 2, z], [x, y - PANEL_H / 2, z]);
    }
  }

  return points;
}

/**
 * The closest any panel comes to the body, or to a panel it is not hinged to.
 *
 * Negative means something is passing through something else. Verify samples
 * this across the whole deployment, because the accordion folds back on itself
 * and a fold angle that looked fine at rest can intersect halfway through.
 */
export function selfClearance(boom: number, unfold: number | number[]): number {
  let closest = Infinity;

  for (const side of [1, -1] as const) {
    const chain = wingChain(side, boom, unfold);

    for (let k = 0; k < N_PANELS; k++) {
      // Sample along the panel rather than only its ends: the middle of a
      // folded panel is what reaches the body, not its hinge.
      for (let s = 0; s <= 8; s++) {
        const point = mix(chain[k], chain[k + 1], s / 8);
        // Against the body. A point inside the cube gives a negative distance.
        closest = Math.min(closest, boxDistance(point));

        // Against panels this one is not hinged to.
        for (let other = 0; other < N_PANELS; other++) {
          if (Math.abs(other - k) <= 1) continue;
          for (let o = 0; o <= 8; o++) {
            const against = mix(chain[other], chain[other + 1], o / 8);
            closest = Math.min(closest, distance(point, against));
          }
        }
      }
    }
  }

  return closest;
}

/** Distance from a point to the body's surface; negative inside it. */
function boxDistance([x, y, z]: Vec3): number {
  const dx = Math.abs(x) - BUS_HALF;
  const dy = Math.abs(y) - BUS_HALF;
  const dz = Math.abs(z) - BUS_HALF;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
  const inside = Math.min(Math.max(dx, Math.max(dy, dz)), 0);
  return outside + inside;
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function span(t: number, window: { from: number; to: number }): number {
  return clamp01((t - window.from) / (window.to - window.from));
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
