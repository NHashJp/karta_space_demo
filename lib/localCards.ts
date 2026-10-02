import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CardConfig } from "@/types/card";

/**
 * Real cards, kept off the repository (spec v0.2 §15.8).
 *
 * `config/cards.config.ts` is committed, and that is right for the two sample
 * cards: they are documentation, and every checkout should have something to
 * open. It is wrong for an actual card. A real one is a letter to one person —
 * their name, what you could not say out loud, where you first met, a line
 * sealed until a date that means something to the two of you — and committing
 * that puts it in the history of a repository you will later share, fork, or
 * hand to someone for review.
 *
 * So real cards live in `.karta/cards.local.json`, beside the plaintext
 * passwords, for the same reason and with the same gitignore covering both.
 * The editor writes here by default. Nothing in the repository ever contains
 * a word the sender wrote.
 *
 * Merged by slug, local winning, so a local card can also *override* a sample
 * one — which is what happens when someone opens the editor, picks the sample
 * card and starts typing over it.
 */

const FOLDER = join(process.cwd(), ".karta");
const PATH = join(FOLDER, "cards.local.json");

export const localCardsPath = PATH;

export function hasLocalCards(): boolean {
  return existsSync(PATH);
}

/**
 * When the file last changed, or 0 if there is none.
 *
 * `lib/cards.ts` uses this to notice an editor save. The committed config is
 * a module, so writing it used to trigger a rebuild and the registry was
 * rebuilt for free; a JSON file in `.karta/` is not watched by anything, so
 * without this the editor would save and the preview beside it would go on
 * showing the previous card until the server restarted.
 */
export function localCardsStamp(): number {
  try {
    return statSync(PATH).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Whatever is on disk, or an empty list.
 *
 * Deliberately forgiving: a malformed local file falls back to the samples
 * rather than taking the whole site down. It is a file on one developer's
 * machine, not a deployment artefact, and the editor is how it gets rewritten
 * — so the recovery path for a bad one is "open the editor", which has to
 * still work.
 */
export function readLocalCards(): CardConfig[] {
  if (!existsSync(PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(PATH, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (card): card is CardConfig =>
        typeof card === "object" && card !== null && typeof (card as CardConfig).slug === "string",
    );
  } catch {
    return [];
  }
}

export function writeLocalCards(cards: CardConfig[]): void {
  mkdirSync(FOLDER, { recursive: true });
  writeFileSync(PATH, `${JSON.stringify(cards, null, 2)}\n`, "utf8");
}

/**
 * The sample cards, with local ones layered over them by slug.
 *
 * Order matters for the development index: local cards first, because if
 * there are any they are the ones being worked on.
 */
export function mergeCards(samples: CardConfig[], local: CardConfig[]): CardConfig[] {
  const overridden = new Set(local.map((card) => card.slug));
  return [...local, ...samples.filter((card) => !overridden.has(card.slug))];
}
