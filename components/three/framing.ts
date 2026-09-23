/** Camera framing maths, kept out of the component so it can be checked. */

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

/** 「あなたの星」. The receiver's planet, low in the frame. */
export const PLANET_RADIUS = 2.2;
export const PLANET_CENTRE: Vec3 = [0, -3.4, -1];

/** The satellite's tilted ellipse, around the planet's centre. */
export const ORBIT_SEMI_MAJOR = 3.4;
export const ORBIT_SEMI_MINOR = 2.6;
export const ORBIT_TILT = (14 * Math.PI) / 180;

/**
 * What the orbit camera looks at. Not the planet's centre but a point above
 * it, which is what puts the planet low in the frame and leaves the sky — the
 * satellite, the comets, the trail — the upper two-thirds it needs.
 */
export const ORBIT_TARGET: Vec3 = [0, -2.2, -1];

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
    PLANET_CENTRE[0] + x,
    PLANET_CENTRE[1] + flat * Math.cos(ORBIT_TILT),
    PLANET_CENTRE[2] + flat * Math.sin(ORBIT_TILT),
  ];
}

/**
 * The half-extents, around `ORBIT_TARGET`, that the orbit view must contain:
 * the whole ellipse, and as much of the planet as is above the frame's floor.
 */
/**
 * Everything the orbit view has to hold: the whole of the satellite's ellipse,
 * and the planet's silhouette. Returned as points rather than as a bounding
 * box, because a box would be framed at its nearest depth and the composition
 * is over four units deep — the widest parts of it are not the nearest parts,
 * and sizing for the worst of both at once pushes the camera needlessly far
 * back.
 */
export function orbitSamples(): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i < 180; i++) {
    const a = (i * 2 * Math.PI) / 180;
    points.push(orbitPosition(a));
    // The planet's silhouette. Its near pole is the closest thing in the
    // composition, so it is included as its own sample.
    points.push([
      PLANET_CENTRE[0] + Math.cos(a) * PLANET_RADIUS,
      PLANET_CENTRE[1] + Math.sin(a) * PLANET_RADIUS,
      PLANET_CENTRE[2],
    ]);
  }
  points.push([PLANET_CENTRE[0], PLANET_CENTRE[1], PLANET_CENTRE[2] + PLANET_RADIUS]);
  return points;
}

/**
 * Where the camera sits in the orbit view, for this viewport.
 *
 * Same idea as `cameraDistance`: portrait is governed by width and landscape
 * by height, and the distance is whichever of the two is further. A phone's
 * 0.46 aspect ratio makes width the binding constraint by a long way, which is
 * why the orbit view sits further back on a phone than it looks like it should.
 */
export function orbitPose(width: number, height: number): Pose {
  const aspect = width / height;
  const halfV = ((FOV * Math.PI) / 180) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const tanH = Math.tan(halfH);
  const tanV = Math.tan(halfV);

  // For each point, the camera distance at which it sits exactly on the
  // margin; the answer is the furthest of them. Solving point by point rather
  // than from a bounding box is what keeps the composition as large as it can
  // be while still passing §17 at every viewport.
  let distance = 0;
  for (const [x, y, z] of orbitSamples()) {
    const ahead = z - ORBIT_TARGET[2];
    const dx = Math.abs(x - ORBIT_TARGET[0]) * ORBIT_MARGIN;
    const dy = Math.abs(y - ORBIT_TARGET[1]) * ORBIT_MARGIN;
    distance = Math.max(distance, dx / tanH + ahead, dy / tanV + ahead);
  }

  // Straight down -z through the target. The planet already sits low in the
  // frame because the target is above it; tilting as well would only make the
  // framing harder to reason about and the ellipse harder to fit.
  return {
    position: [ORBIT_TARGET[0], ORBIT_TARGET[1], ORBIT_TARGET[2] + distance],
    lookAt: ORBIT_TARGET,
  };
}

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
