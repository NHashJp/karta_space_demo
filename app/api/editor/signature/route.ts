import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { editorEnabled, refused, safeSlug } from "@/lib/editorGuard";

/**
 * The signature pad's output (spec v0.2 §15.5, §13.1).
 *
 * Stroked paths only, never fills. That is not a stylistic preference: the
 * closing screen *draws* the signature by walking a dash along each path, and
 * a filled shape has nothing to walk — it would simply appear, which is not
 * the same thing at all.
 */

type Stroke = { x: number; y: number }[];

const PADDING = 4;
const MAX_STROKES = 200;
const MAX_POINTS = 4000;

export async function POST(request: Request) {
  if (!editorEnabled) return refused();

  const body = (await request.json().catch(() => ({}))) as {
    slug?: unknown;
    strokes?: unknown;
  };

  const slug = safeSlug(body.slug);
  if (!slug) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const strokes = parseStrokes(body.strokes);
  if (!strokes || strokes.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const folder = join(process.cwd(), "public", "cards", slug);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "signature.svg"), toSvg(strokes), "utf8");

  return NextResponse.json({ ok: true, src: `/cards/${slug}/signature.svg` });
}

function parseStrokes(value: unknown): Stroke[] | null {
  if (!Array.isArray(value) || value.length > MAX_STROKES) return null;

  let points = 0;
  const strokes: Stroke[] = [];

  for (const stroke of value) {
    if (!Array.isArray(stroke) || stroke.length < 2) continue;
    const parsed: Stroke = [];
    for (const point of stroke) {
      const x = Number((point as { x?: unknown }).x);
      const y = Number((point as { y?: unknown }).y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      parsed.push({ x, y });
      if (++points > MAX_POINTS) return null;
    }
    if (parsed.length >= 2) strokes.push(parsed);
  }

  return strokes;
}

/**
 * Each stroke becomes one path, smoothed into cubic Béziers through the
 * midpoints of consecutive segments — the standard trick, and the reason a
 * pointer's jitter does not end up in the drawing.
 */
function toSvg(strokes: Stroke[]): string {
  const all = strokes.flat();
  const minX = Math.min(...all.map((p) => p.x)) - PADDING;
  const minY = Math.min(...all.map((p) => p.y)) - PADDING;
  const maxX = Math.max(...all.map((p) => p.x)) + PADDING;
  const maxY = Math.max(...all.map((p) => p.y)) + PADDING;

  const paths = strokes
    .map((stroke) => `  <path d="${toPath(stroke)}"/>`)
    .join("\n");

  // The viewBox is fitted to the strokes, so the closing screen can size it by
  // height alone without knowing how wide the drawing turned out.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(minX)} ${round(minY)} ` +
      `${round(maxX - minX)} ${round(maxY - minY)}" fill="none" stroke="#e8e9eb" ` +
      `stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">`,
    paths,
    "</svg>",
    "",
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
