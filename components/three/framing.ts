/** Camera framing maths, kept out of the component so it can be checked. */
import { DEPLOYED_SPAN, hullPoints } from "../../lib/satelliteGeometry.ts";
import { SAT_SCALE } from "../../lib/deployment.ts";

export const FOV = 45;

/** How far behind the reading position the camera waits before/after the card. */
export const ZOOM_DISTANCE = 10;

/** Dolly durations, in ms. */
export const ZOOM_IN_MS = 1400;
export const ZOOM_OUT_MS = 1000;
export const ZOOM_REDUCED_MS = 300;
/** Slower than the others: passing through a wall should feel deliberate. */
export const ZOOM_INSIDE_MS = 1600;

/**
 * Where the camera sits when it goes inside the cube. Far enough off-centre to
 * have a look direction at all, close enough to the front wall that the far
 * wall — and the line written on it — is comfortably in frame.
 */
export const INSIDE_DISTANCE = 0.62;
/** The secret line hangs just inside the far wall. */
export const SECRET_PLANE_Z = -0.94;

/* ---------------------------------------------------------------------------
 * The orbit composition (spec v0.2 §8.3)
 * ------------------------------------------------------------------------- */

/*
 * The orbit hub's composition (spec v0.2 rev 6, §3.1) — the sender's sketch.
 *
 * The planet is a small arc in the bottom-right corner. The satellite is large
 * and centred, on a diagonal. The trail comes in at the top-left and the comet
 * passes by at the top-right.
 *
 * The world itself is unchanged: the planet is where it is and the satellite
 * is on its orbit. What `hubPose` does is *place the camera* so that those
 * things land where the sketch puts them on screen — which is why the targets
 * below are fractions of the viewport rather than world coordinates.
 */

/** 「あなたの星」, mostly off the bottom-right corner. */
export const PLANET_RADIUS = 2.2;
export const PLANET_CENTRE: Vec3 = [3.5, -3.9, -2.2];

/** The satellite's orbit around it. Drawn only in the chart (rev 6, R20). */
export const ORBIT_CENTRE: Vec3 = PLANET_CENTRE;
export const ORBIT_SEMI_MAJOR = 4.4;
export const ORBIT_SEMI_MINOR = 3.35;
export const ORBIT_TILT = (34 * Math.PI) / 180;

/**
 * Where the satellite sits in the hub, in world space.
 *
 * In revision 6 it does **not** travel round the ring on screen: it holds this
 * place and keeps station (§3.2). The orbit is still real — the chart shows it
 * — but the hub is a view from alongside, not from a fixed point in space, so
 * the satellite stays put and the sky turns behind it.
 */
export const HUB_SATELLITE: Vec3 = [0, 0, 0];

/** The satellite's display attitude: the wing axis at −50° on screen. */
export const WING_AXIS_DEG = -50;

/**
 * What the orbit camera looks at. Not the planet's centre but a point above
 * it, which is what puts the planet low in the frame and leaves the sky — the
 * satellite, the comets, the trail — the upper two-thirds it needs.
 */
/** The camera looks a little above the planet, so it sits low in the frame. */
export const ORBIT_TARGET: Vec3 = [1.1, -1.0, -1.3];

/**
 * Margin beyond the composition. §17 requires 8%; designing to 12% leaves the
 * check somewhere to fail from if the numbers are ever tuned.
 */
const ORBIT_MARGIN = 1.12;

export type Vec3 = [number, number, number];
export type Pose = { position: Vec3; lookAt: Vec3 };

/** A point on the satellite's ellipse at orbit phase `theta` (radians). */
export function orbitPosition(theta: number): Vec3 {
  const x = ORBIT_SEMI_MAJOR * Math.cos(theta);
  const flat = ORBIT_SEMI_MINOR * Math.sin(theta);
  return [
    ORBIT_CENTRE[0] + x,
    ORBIT_CENTRE[1] + flat * Math.cos(ORBIT_TILT),
    ORBIT_CENTRE[2] + flat * Math.sin(ORBIT_TILT),
  ];
}

/**
 * How close the cube's orbit ever comes to the planet's surface.
 *
 * Checked rather than eyeballed: the two used to share a centre, and the
 * result was a satellite that crossed the planet's disc. A positive clearance
 * here is what guarantees it cannot happen again.
 */
export function orbitClearance(): number {
  let closest = Infinity;
  for (let i = 0; i < 720; i++) {
    const [x, y, z] = orbitPosition((i * Math.PI) / 360);
    closest = Math.min(
      closest,
      Math.hypot(x - PLANET_CENTRE[0], y - PLANET_CENTRE[1], z - PLANET_CENTRE[2]),
    );
  }
  return closest - PLANET_RADIUS;
}

/**
 * The half-extents, around `ORBIT_TARGET`, that the orbit view must contain:
 * the whole ellipse, and as much of the planet as is above the frame's floor.
 */
/**
 * What the orbit view has to hold: **the cube's whole ellipse**, and nothing
 * else.
 *
 * The planet is deliberately not in here. Framing it as well pushed the camera
 * from 15 units back to 41 on a phone, which made the cube — the subject — a
 * speck. Instead the planet is placed so that this frame crops it: its upper-
 * left arc rises into the lower-right corner, which is where it was asked to
 * be and how a planet you are near actually looks.
 */
/**
 * What the hub frame has to hold: the satellite's whole deployed hull.
 *
 * The planet is deliberately not in here. It is scenery, and cropping it into
 * the corner is the composition — framing it as well would push the camera
 * back until the subject was a speck, which is what revision 5 did.
 */
export function orbitSamples(): Vec3[] {
  return satelliteHull().map(([x, y, z]) => [
    HUB_SATELLITE[0] + x,
    HUB_SATELLITE[1] + y,
    HUB_SATELLITE[2] + z,
  ]);
}

/** The deployed satellite's hull, at satellite scale, in its display attitude. */
export function satelliteHull(): Vec3[] {
  const yaw = (WING_AXIS_DEG * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  return hullPoints(1, 1).map(([x, y, z]) => [
    (x * cos - z * sin) * SAT_SCALE,
    y * SAT_SCALE,
    (x * sin + z * cos) * SAT_SCALE,
  ]);
}

/**
 * Where the camera sits in the orbit view, for this viewport.
 *
 * Same idea as `cameraDistance`: portrait is governed by width and landscape
 * by height, and the distance is whichever of the two is further. A phone's
 * 0.46 aspect ratio makes width the binding constraint by a long way, which is
 * why the orbit view sits further back on a phone than it looks like it should.
 */
/* ---------------------------------------------------------------------------
 * The hub, staged from its screen targets (rev 6 §3.1)
 * ------------------------------------------------------------------------- */

/** Tip to tip, in world units, at satellite scale. */
const SPAN_WORLD = DEPLOYED_SPAN * SAT_SCALE;

type HubTargets = {
  /** Body centre, as fractions of the viewport from the left and the top. */
  centre: [number, number];
  /** Tip to tip along the wing axis, as a fraction of the width. */
  tip: number;
  planet: { centre: [number, number]; radius: number };
};

/**
 * §3.1's two reference columns. Portrait and landscape are genuinely different
 * compositions rather than one scaled: on a phone the satellite fills four
 * fifths of the width, on a desktop barely a third.
 */
const PORTRAIT: HubTargets = {
  centre: [0.44, 0.55],
  tip: 0.81,
  planet: { centre: [1.21, 1.22], radius: 1.07 },
};
const LANDSCAPE: HubTargets = {
  centre: [0.47, 0.5],
  tip: 0.36,
  planet: { centre: [1.11, 1.44], radius: 0.55 },
};

export function hubTargets(aspect: number): HubTargets {
  return aspect < 1 ? PORTRAIT : LANDSCAPE;
}

/**
 * The half-angles as *tangents*, which is what projection arithmetic wants.
 * (The `halfAngles` further down returns radians, for a different job.)
 */
function hubHalfTangents(aspect: number) {
  const halfV = Math.tan(((FOV * Math.PI) / 180) / 2);
  return { halfV, halfH: Math.tan(Math.atan(halfV * aspect)) };
}

/**
 * Where the camera stands in the hub.
 *
 * Solved from the composition rather than chosen: the distance is whatever
 * makes the satellite's tip-to-tip the target fraction of the width, and the
 * offset is whatever puts its body centre on the target point. Revision 5's
 * `orbitPose` framed an *orbit*; the hub no longer shows one (R20), so what it
 * frames now is the satellite itself.
 */
export function hubPose(width: number, height: number): Pose {
  const aspect = width / height;
  const { halfV, halfH } = hubHalfTangents(aspect);
  const target = hubTargets(aspect);

  const distance = SPAN_WORLD / 2 / (target.tip * halfH);
  const x = HUB_SATELLITE[0] + (0.5 - target.centre[0]) * 2 * halfH * distance;
  const y = HUB_SATELLITE[1] + (target.centre[1] - 0.5) * 2 * halfV * distance;

  return {
    position: [x, y, HUB_SATELLITE[2] + distance],
    lookAt: [x, y, HUB_SATELLITE[2]],
  };
}

/**
 * Where the planet stands **in the hub**.
 *
 * This is a staged position, and that deserves saying plainly. §3.1 fixes the
 * planet's radius at 2.2 world units *and* asks it to fill a given fraction of
 * the screen in both portrait and landscape — and those two demands cannot both
 * be met by one fixed world position, because the camera distance is already
 * spoken for by the satellite. A planet that satisfied the phone would swallow
 * the desktop.
 *
 * Revision 6 makes that affordable: in the hub the satellite no longer travels
 * a visible orbit (R20), so nothing on screen depends on the two being a fixed
 * distance apart. The orbit is still real and still drawn — in the chart, which
 * uses the true placement. The hub is a view from alongside, composed.
 */
export function hubPlanet(width: number, height: number): Vec3 {
  const aspect = width / height;
  const { halfV, halfH } = hubHalfTangents(aspect);
  const target = hubTargets(aspect);
  const camera = hubPose(width, height).position;

  // Close enough that its limb reads as the target fraction of the width.
  const depth = PLANET_RADIUS / (2 * halfH * target.planet.radius);

  return [
    camera[0] + (target.planet.centre[0] - 0.5) * 2 * halfH * depth,
    camera[1] - (target.planet.centre[1] - 0.5) * 2 * halfV * depth,
    camera[2] - depth,
  ];
}

/* ---------------------------------------------------------------------------
 * The comet, staged in the hub (rev 6 §4.1)
 * ------------------------------------------------------------------------- */

/**
 * Where the comet's path runs on screen: perihelion beside the planet at the
 * bottom-right, aphelion up in the top-right, bowing outward in between.
 */
const COMET_NEAR_SCREEN: [number, number] = [0.9, 0.66];
/**
 * The far end sits where §3.1 puts the sample comet, around (0.82, 0.22): the
 * sample is already most of the way out, so "as far as it goes" is barely
 * beyond where it is today.
 */
const COMET_FAR_SCREEN: [number, number] = [0.81, 0.19];
/** Pushed right of the straight line, so the path reads as an arc. */
const COMET_BOW = 0.07;

/** How far behind the satellite the comet is staged. */
const COMET_DEPTH = 3.4;

/**
 * Where the comet is drawn in the hub, for a radius already compressed by
 * `displayRadius` (0 = home, 1 = as far as it goes).
 *
 * Staged in screen space, like the planet, and for the same reason: the hub is
 * a composition. What has to survive is the *reading* — the comet passes by in
 * the top-right, well clear of the satellite, and comes home beside the planet
 * — and screen space is where those words mean something.
 */
export function hubComet(u: number, width: number, height: number): Vec3 {
  const aspect = width / height;
  const { halfV, halfH } = hubHalfTangents(aspect);
  const camera = hubPose(width, height).position;
  const t = Math.min(Math.max(u, 0), 1);

  // A quadratic through near → bow → far, so the path curves the way an orbit
  // seen edge-on does rather than running straight.
  const control: [number, number] = [
    (COMET_NEAR_SCREEN[0] + COMET_FAR_SCREEN[0]) / 2 + COMET_BOW,
    (COMET_NEAR_SCREEN[1] + COMET_FAR_SCREEN[1]) / 2,
  ];
  const x =
    (1 - t) * (1 - t) * COMET_NEAR_SCREEN[0] +
    2 * (1 - t) * t * control[0] +
    t * t * COMET_FAR_SCREEN[0];
  const y =
    (1 - t) * (1 - t) * COMET_NEAR_SCREEN[1] +
    2 * (1 - t) * t * control[1] +
    t * t * COMET_FAR_SCREEN[1];

  const depth = camera[2] - HUB_SATELLITE[2] + COMET_DEPTH;
  return [
    camera[0] + (x - 0.5) * 2 * halfH * depth,
    camera[1] - (y - 0.5) * 2 * halfV * depth,
    camera[2] - depth,
  ];
}

/** The old name, kept so nothing has to change twice. */
export const orbitPose = hubPose;

/* ---------------------------------------------------------------------------
 * The trail (spec v0.2 §9.2, §9.3)
 * ------------------------------------------------------------------------- */

/** The panel's world size. The cube's face is 2 units; a photograph earns more. */
export const MEMORY_PANEL_WORLD = 2.4;

/** The share of the frame a memory should fill — the same as a cube face's. */
const MEMORY_FILL_PORTRAIT = 0.72; // §17: 65-80% of the width
const MEMORY_FILL_LANDSCAPE = 0.55; // §17: 45-65% of the height

/**
 * How far in front of a memory the camera stops.
 *
 * Responsive for the same reason `cameraDistance` is: a fixed distance makes
 * the panel fill a phone's narrow frame and get lost in a wide one. Portrait
 * is governed by width, landscape by height.
 */
export function memoryViewDistance(width: number, height: number): number {
  const aspect = width / height;
  const halfV = ((FOV * Math.PI) / 180) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);

  const portrait = aspect < 1;
  const halfAngle = portrait ? halfH : halfV;
  const fill = portrait ? MEMORY_FILL_PORTRAIT : MEMORY_FILL_LANDSCAPE;

  return MEMORY_PANEL_WORLD / fill / 2 / Math.tan(halfAngle);
}

/**
 * The share of the viewport a memory panel fills, which §17 requires to match
 * a cube face's: 65-80% of the width in portrait, 45-65% of the height in
 * landscape. Returned as fractions so verify can assert both.
 */
export function memoryPanelFraming(width: number, height: number) {
  const aspect = width / height;
  const halfV = ((FOV * Math.PI) / 180) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const distance = memoryViewDistance(width, height);

  const visibleHeight = 2 * Math.tan(halfV) * distance;
  const visibleWidth = 2 * Math.tan(halfH) * distance;

  return {
    distance,
    widthFraction: MEMORY_PANEL_WORLD / visibleWidth,
    heightFraction: MEMORY_PANEL_WORLD / visibleHeight,
    /** Screen pixels the panel occupies, for the 40px-per-unit text rule. */
    screenPx: (MEMORY_PANEL_WORLD / visibleWidth) * width,
  };
}

/** Fraction of the viewport's governing axis the front face should occupy. */
const DESKTOP_FILL = 0.55; // of viewport height (spec §15: 45-65%)
const MOBILE_FILL = 0.75; // of viewport width  (spec §15: 65-80%)

const FACE_SIZE = 2; // the cube is 2 units across
const FACE_PLANE_Z = 1; // the front face sits 1 unit nearer than the centre
/** Half-extent the cube sweeps through during a transition; keeps it unclipped. */
const SWEPT_RADIUS = 1.5;

export function cameraDistance(width: number, height: number): number {
  const aspect = width / height;
  const halfV = ((FOV * Math.PI) / 180) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);

  // Portrait is governed by width, landscape by height.
  const portrait = aspect < 1;
  const halfAngle = portrait ? halfH : halfV;
  const fill = portrait ? MOBILE_FILL : DESKTOP_FILL;

  // Distance that makes the *front face* — not the cube centre — fill `fill`.
  const visibleAtFace = FACE_SIZE / fill;
  const toFace = visibleAtFace / 2 / Math.tan(halfAngle);

  // Never let a spinning cube clip the edge of the frame.
  const safe = SWEPT_RADIUS / Math.sin(Math.min(halfV, halfH));

  return Math.max(FACE_PLANE_Z + toFace, safe);
}

const PANEL_WORLD = 1.84; // width of the text panel, in cube-face units
const PANEL_MIN_PX = 260;
const PANEL_MAX_PX = 560;

/** How many screen pixels wide the text panel ends up, at this viewport. */
function panelScreenPixels(width: number, height: number): number {
  const halfV = ((FOV * Math.PI) / 180) / 2;
  const toFace = cameraDistance(width, height) - FACE_PLANE_Z;
  const visibleHeight = 2 * Math.tan(halfV) * toFace;
  return (PANEL_WORLD / visibleHeight) * height;
}

/**
 * CSS width to author the text panel at. Matching it to the panel's on-screen
 * size keeps the CSS-to-screen scale near 1:1, so a 17px font renders at ~17px
 * on a phone and a desktop alike. Clamped so very large windows scale the type
 * up instead of stretching lines out.
 */
export function textPanelPx(width: number, height: number): number {
  const ideal = panelScreenPixels(width, height);
  return Math.round(Math.min(Math.max(ideal, PANEL_MIN_PX), PANEL_MAX_PX));
}

/** drei's <Html transform> maps 40 CSS px to 1 world unit at scale 1. */
export function textPanelScale(panelPx: number): number {
  return (40 * PANEL_WORLD) / panelPx;
}

const PANEL_PADDING = 0.085; // fraction of the panel, per side
const LINE_HEIGHT = 1.9;
const MIN_FONT_PX = 12.5;
const MAX_FONT_PX = 20;

function usableWidth(panelPx: number): number {
  return panelPx * (1 - 2 * PANEL_PADDING);
}

/** Lines the text wraps to at a given size, and the height it needs. */
function layout(panelPx: number, chars: number, fontPx: number) {
  const available = usableWidth(panelPx);
  const charsPerLine = Math.max(1, Math.floor(available / fontPx));
  const lines = Math.ceil(Math.max(chars, 1) / charsPerLine);
  return { charsPerLine, lines, height: lines * fontPx * LINE_HEIGHT, available };
}

/**
 * Largest size at which `chars` of Japanese text still fits the square face
 * panel. Japanese glyphs are near em-square, so the closed-form estimate is a
 * good starting point; it is then stepped down until the wrapped line count
 * genuinely fits, since lines round up. Content that only fits below
 * MIN_FONT_PX should be shortened instead (spec §7).
 */
/**
 * A `line` face (spec v0.2 §13.2): one short sentence, set large and centred.
 *
 * It is not a smaller problem than a paragraph but a different one. A
 * paragraph is fitted so it does not spill; a line is fitted so it lands as a
 * *beat* — 2.2x the paragraph size, and still on one line whatever the
 * viewport, which is why the range is its own rather than a multiplier on the
 * paragraph range.
 */
const LINE_FACE_SCALE = 2.2;
const LINE_MIN_FONT_PX = 20;
const LINE_MAX_FONT_PX = 56;

export function fitLineFaceSize(panelPx: number, chars: number): number {
  const available = usableWidth(panelPx);
  // Japanese sets roughly one character per em, so the width a line needs is
  // its character count times the font size. Allow two lines for a long one
  // rather than shrinking it below legibility.
  const ideal = Math.min(LINE_MAX_FONT_PX, fitFontSize(panelPx, chars) * LINE_FACE_SCALE);
  const byWidth = (available / Math.max(chars, 1)) * (chars > 12 ? 2 : 1);
  return Math.floor(Math.max(Math.min(ideal, byWidth), LINE_MIN_FONT_PX) * 100) / 100;
}

export function fitFontSize(panelPx: number, chars: number): number {
  const available = usableWidth(panelPx);
  let font = Math.min(
    MAX_FONT_PX,
    Math.sqrt((available * available) / (Math.max(chars, 1) * LINE_HEIGHT)),
  );

  while (font > MIN_FONT_PX && layout(panelPx, chars, font).height > available) {
    font -= 0.25;
  }
  // Floor, never round: rounding up can cost a character per line and so add
  // a whole line, putting the paragraph back over the edge of the face.
  return Math.floor(Math.max(font, MIN_FONT_PX) * 100) / 100;
}

/** Lines the text wraps to, and whether it still overflows the face. */
export function measureFace(panelPx: number, chars: number) {
  const fontPx = fitFontSize(panelPx, chars);
  const { charsPerLine, lines, height, available } = layout(panelPx, chars, fontPx);
  return { fontPx, charsPerLine, lines, overflows: height > available };
}

/* ---------- inside the cube ---------- */

const SECRET_FILL = 0.84; // of the viewport width, inside the cube
const SECRET_MIN_PX = 240;
const SECRET_MAX_PX = 520;
const SECRET_MIN_FONT = 15;
const SECRET_MAX_FONT = 34;

function halfAngles(width: number, height: number) {
  const halfV = ((FOV * Math.PI) / 180) / 2;
  return { halfV, halfH: Math.atan(Math.tan(halfV) * (width / height)) };
}

/** How wide the view is, in world units, at the far wall seen from inside. */
export function insideVisibleWidth(width: number, height: number): number {
  const { halfH } = halfAngles(width, height);
  return 2 * Math.tan(halfH) * (INSIDE_DISTANCE - SECRET_PLANE_Z);
}

/**
 * The secret panel, in the two units that matter: CSS pixels to author it at,
 * and world units to place it at. Inside a cube only ~0.6 world units of view
 * are available on a phone, so the panel is sized from the *inside* distance
 * rather than the reading distance — the same idea as `textPanelPx`, a
 * different camera position.
 */
export function secretPanel(width: number, height: number) {
  const visible = insideVisibleWidth(width, height);
  const panelPx = Math.round(Math.min(Math.max(SECRET_FILL * width, SECRET_MIN_PX), SECRET_MAX_PX));
  // Keep the panel inside the frame even where the clamp above widened it.
  const worldWidth = Math.min((panelPx / width) * visible, visible * SECRET_FILL);
  return { panelPx, worldWidth, scale: (40 * worldWidth) / panelPx };
}

/** One line, so size is simply what fits the panel's width. */
export function fitLinePx(panelPx: number, chars: number): number {
  const usable = panelPx * (1 - 2 * PANEL_PADDING);
  const font = usable / Math.max(chars, 1);
  return Math.floor(Math.min(Math.max(font, SECRET_MIN_FONT), SECRET_MAX_FONT) * 100) / 100;
}

/** Whether that line actually fits the panel at the size it would be set. */
export function secretFits(width: number, height: number, chars: number) {
  const { panelPx } = secretPanel(width, height);
  const fontPx = fitLinePx(panelPx, chars);
  const usable = panelPx * (1 - 2 * PANEL_PADDING);
  return { fontPx, panelPx, overflows: fontPx * Math.max(chars, 1) > usable };
}
