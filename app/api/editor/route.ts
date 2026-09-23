import { NextResponse } from "next/server";
import { allProblems } from "@/lib/cardRules";
import { writeCards } from "@/lib/cardsFile";
import { writeSecrets } from "@/lib/secretsFile";
import { editorEnabled, refused } from "@/lib/editorGuard";
import type { CardConfig } from "@/types/card";

/**
 * The editor's save. Development only — see `lib/editorGuard.ts` for why.
 *
 * It writes two files: the config, which is committed, and
 * `.karta/secrets.local.json`, which is not. The second exists so the Share
 * tab can show a password again on this computer after a restart; the config
 * only ever carries the hash.
 */
export async function POST(request: Request) {
  if (!editorEnabled) return refused();

  const body = (await request.json().catch(() => null)) as {
    cards?: CardConfig[];
    /** slug -> plaintext, for the local-only secrets file. */
    secrets?: Record<string, string>;
  } | null;
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
    // Pruned to the cards that still exist, so a deleted card does not leave
    // its password behind in a file nobody looks at.
    if (body.secrets) writeSecrets(body.secrets, body.cards.map((card) => card.slug));
  } catch (cause) {
    return NextResponse.json(
      { error: "write_failed", detail: String(cause) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, cards: body.cards.length });
}
