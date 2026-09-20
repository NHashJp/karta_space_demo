import { NextResponse } from "next/server";
import { allProblems } from "@/lib/cardRules";
import { writeCards } from "@/lib/cardsFile";
import type { CardConfig } from "@/types/card";

/**
 * The editor's only write. Development only, for two reasons: a deployed
 * filesystem is read-only, and an unauthenticated write endpoint on a public
 * deployment would let anyone rewrite every card.
 */
const editorEnabled = process.env.NODE_ENV !== "production";

export async function POST(request: Request) {
  if (!editorEnabled) {
    return NextResponse.json({ error: "editor_disabled" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { cards?: CardConfig[] } | null;
  if (!body || !Array.isArray(body.cards)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // The same rules the registry applies at import time, so a save can never
  // write a file that would fail the next build.
  const problems = allProblems(body.cards);
  const failed = problems.flatMap((p, index) =>
    p.errors.map((error) => `card ${index + 1}: ${error}`),
  );
  if (failed.length > 0) {
    return NextResponse.json({ error: "invalid", problems: failed }, { status: 422 });
  }

  try {
    writeCards(body.cards);
  } catch (cause) {
    return NextResponse.json(
      { error: "write_failed", detail: String(cause) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, cards: body.cards.length });
}
