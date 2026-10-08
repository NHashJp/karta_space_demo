/**
 * The sender's signature, as data (spec v0.2 §13.1, §15.5).
 *
 * It is kept the way the card's own words are kept: **inside the card**, in
 * `.karta/cards.local.json`, and handed to the browser only behind the card's
 * password. It used to be written to `public/cards/<slug>/signature.svg`, which
 * is served flat — so anyone with the URL could fetch someone's handwriting
 * without the password, and it was committed with the repository besides. A
 * signature is the most personal mark on the card; it has no business being
 * less private than the sentence above it.
 *
 * Stroked paths only, never fills. That is not a stylistic preference: the
 * closing screen *draws* the signature by walking a dash along each path, and
 * a filled shape has nothing to walk — it would simply appear.
 *
 * Pure, so the shape of what is stored can be checked without a disk.
 */

export type Point = { x: number; y: number };
export type Stroke = Point[];

const PADDING = 4;

/** The stroke the closing screen restyles anyway; kept for the editor's preview. */
const STYLE =
  'fill="none" stroke="#e8e9eb" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';

/**
 * Each stroke becomes one path, smoothed into quadratic Béziers through the
 * midpoints of consecutive segments — the standard trick, and the reason a
 * pointer's jitter does not end up in the drawing.
 */
export function toSignatureSvg(strokes: Stroke[]): string {
  const all = strokes.flat();
  const minX = Math.min(...all.map((p) => p.x)) - PADDING;
  const minY = Math.min(...all.map((p) => p.y)) - PADDING;
  const maxX = Math.max(...all.map((p) => p.x)) + PADDING;
  const maxY = Math.max(...all.map((p) => p.y)) + PADDING;

  // The viewBox is fitted to the strokes, so the closing screen can size it by
  // height alone without knowing how wide the drawing turned out.
  const viewBox = [minX, minY, maxX - minX, maxY - minY].map(round).join(" ");
  return build(viewBox, strokes.map(toPath));
}

/** Only path data the pad can produce: moves, lines, quadratics and numbers. */
const PATH_DATA = /^[MLQ0-9 .-]+$/;
const VIEW_BOX = /^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/;

/**
 * The stored markup, rebuilt from its parts — or `undefined` if it is not a
 * signature this pad drew.
 *
 * The closing screen puts this into the page as markup, so it is not passed
 * through as written: the viewBox and each path's data are lifted out,
 * checked against what the pad can produce, and a fresh SVG is assembled from
 * those alone. Whatever else a hand-edited config might carry — an attribute,
 * a script, a link — does not survive the trip.
 */
export function cleanSignature(value: string | undefined): string | undefined {
  if (!value || !value.trimStart().startsWith("<svg")) return undefined;

  const viewBox = /viewBox="([^"]*)"/.exec(value)?.[1]?.trim();
  if (!viewBox || !VIEW_BOX.test(viewBox)) return undefined;

  const paths = Array.from(value.matchAll(/<path\s+d="([^"]*)"\s*\/>/g), (match) => match[1].trim())
    .filter((d) => d.length > 0 && PATH_DATA.test(d));
  if (paths.length === 0) return undefined;

  return build(viewBox, paths);
}

/** The editor's preview: the same markup as an image, with no request for it. */
export function signaturePreview(markup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function build(viewBox: string, paths: string[]): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${STYLE}>`,
    ...paths.map((d) => `  <path d="${d}"/>`),
    "</svg>",
  ].join("\n");
}

function toPath(stroke: Stroke): string {
  if (stroke.length === 2) {
    return `M${round(stroke[0].x)} ${round(stroke[0].y)} L${round(stroke[1].x)} ${round(stroke[1].y)}`;
  }

  let d = `M${round(stroke[0].x)} ${round(stroke[0].y)}`;
  for (let i = 1; i < stroke.length - 1; i++) {
    const current = stroke[i];
    const next = stroke[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q${round(current.x)} ${round(current.y)} ${round(midX)} ${round(midY)}`;
  }
  const last = stroke[stroke.length - 1];
  d += ` L${round(last.x)} ${round(last.y)}`;
  return d;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
