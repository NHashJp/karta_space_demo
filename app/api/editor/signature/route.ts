import { NextResponse } from "next/server";
import { editorDenied, safeSlug } from "@/lib/editorGuard";
import { toSignatureSvg, type Stroke } from "@/lib/signature";

/**
 * The signature pad's output (spec v0.2 §15.5, §13.1).
 *
 * Turned into an SVG and handed **back to the editor**, which keeps it in the
 * card itself — saved to `.karta/cards.local.json` with the rest of what the
 * sender wrote, and shown only behind the card's password. Nothing is written
 * to disk here, and nothing to `public/`: see `lib/signature.ts` for why.
 */

const MAX_STROKES = 200;
const MAX_POINTS = 4000;

export async function POST(request: Request) {
  const denied = await editorDenied();
  if (denied) return denied;

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

  return NextResponse.json({ ok: true, svg: toSignatureSvg(strokes) });
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
