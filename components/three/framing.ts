/** Camera framing maths, kept out of the component so it can be checked. */

export const FOV = 45;

/** How far behind the reading position the camera waits before/after the card. */
export const ZOOM_DISTANCE = 10;

/** Dolly durations, in ms. */
export const ZOOM_IN_MS = 1400;
export const ZOOM_OUT_MS = 1000;
export const ZOOM_REDUCED_MS = 300;

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
