import { NextResponse } from "next/server";
import { allProblems } from "@/lib/cardRules";
import { rehomeCards } from "@/lib/cardMedia";
import { carryMedia } from "@/lib/cardMediaFile";
import { writeCards } from "@/lib/cardsFile";
import { writeSecrets } from "@/lib/secretsFile";
import { editorDenied } from "@/lib/editorGuard";
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
  const denied = await editorDenied();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as {
    cards?: CardConfig[];
    /** slug -> plaintext, for the local-only secrets file. */
    secrets?: Record<string, string>;
  } | null;
  if (!body || !Array.isArray(body.cards)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  /*
   * Pictures follow their card.
   *
   * A card's media is filed under its slug, and the slug is written into
   * every media path — so renaming a card, or starting one by copying
   * another, leaves its photographs pointing at the old folder. Cube faces
   * survive that (public is served flat); memory photographs do not, because
   * the media route resolves inside the card's own folder and refuses
   * anything outside it. The result was a trail of empty frames and no error
   * anywhere.
   *
   * So a save repoints them and carries the files across. It heals a card
   * that is already broken as well as one being renamed now, which matters
   * because the breakage is silent and nobody knows to go looking for it.
   * Copies, never moves: the card it came from may still be using it.
   */
  const { cards: healed, moved } = rehomeCards(body.cards);
  const carried = moved.length > 0 ? carryMedia(moved) : [];

  // The same rules the registry applies at import time, so a save can never
  // write a file that would fail the next build.
  const problems = allProblems(healed);
  const failed = problems.flatMap((p, index) =>
    p.errors.map((error) => `card ${index + 1}: ${error}`),
  );
  if (failed.length > 0) {
    return NextResponse.json({ error: "invalid", problems: failed }, { status: 422 });
  }

  try {
    writeCards(healed);
    // Pruned to the cards that still exist, so a deleted card does not leave
    // its password behind in a file nobody looks at.
    if (body.secrets) writeSecrets(body.secrets, healed.map((card) => card.slug));
  } catch (cause) {
    return NextResponse.json(
      { error: "write_failed", detail: String(cause) },
      { status: 500 },
    );
  }

  /*
   * The healed cards go back, so the editor is holding what was actually
   * written. Without that the Memories tab would still show the old path and
   * the next save would send it again — harmless, because carrying is
   * idempotent, but it would look as though nothing had been fixed.
   */
  return NextResponse.json({
    ok: true,
    cards: healed.length,
    ...(moved.length > 0
      ? { healed, carried: carried.filter((file) => file.done).length, moved: moved.length }
      : {}),
  });
}
