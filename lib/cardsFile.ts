import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeLocalCards } from "./localCards.ts";
import type { CardConfig } from "@/types/card";

/**
 * Where the editor saves.
 *
 * **`.karta/cards.local.json`, which is gitignored** — not the committed
 * config. A real card is a letter to one person, and committing it puts their
 * name and the thing you could not say out loud into the history of a
 * repository you will later share or hand to someone. See `lib/localCards.ts`.
 *
 * `config/cards.config.ts` keeps the two sample cards and is still a
 * TypeScript file, type-checked and readable by hand, so a fresh checkout has
 * something to open. `serializeCards` is still here because that file is
 * still written by hand and the shape has to match.
 *
 * This only ever runs in development — a deployed filesystem is read-only, and
 * publishing is a deploy either way. See `app/api/editor/route.ts`.
 */

const CONFIG_PATH = join(process.cwd(), "config", "cards.config.ts");
const PUBLIC_CARDS = join(process.cwd(), "public", "cards");

const HEADER = `import type { CardConfig } from "@/types/card";

/**
 * Every card this deployment serves, in one file.
 *
 * Edit it by hand, or run \`npm run dev\` and open /editor — the editor writes
 * this same file, and rewrites it whole, so comments added below do not
 * survive a save.
 *
 * To add a card, use the editor's Share tab — it issues a slug with an
 * unguessable random part and a password, and tells you what to deploy. By
 * hand: append an entry, put cube-face images in \`public/cards/<slug>/\` and
 * memory photographs in \`private/cards/<slug>/\`, redeploy. Nothing else in the
 * codebase needs to know the card exists — \`lib/cards.ts\` builds the slug
 * registry from this array and validates every entry at import time, so a
 * malformed card fails the build rather than the page.
 *
 * Plaintext passwords are never written here. A card reads
 * \`CARD_PASSWORD_<SLUG>\` (slug upper-cased, non-alphanumerics as \`_\`), then
 * its own \`access.passwordHash\` if the editor issued one, then the shared
 * \`CARD_PASSWORD\`, and is link-only when none of them is set. Only the salted
 * hash and the hint are ever committed. See \`lib/access.ts\`.
 */
export const cards: CardConfig[] = `;

/** Deterministic, so an unchanged card produces an unchanged file. */
export function serializeCards(cards: CardConfig[]): string {
  return `${HEADER}${JSON.stringify(cards, null, 2)};\n`;
}

/**
 * Save, to the local file.
 *
 * Everything is written, samples included: once someone has opened the editor
 * and saved, the local file is the whole truth about what this machine
 * serves, and a split where half the cards came from one place and half from
 * another is the kind of thing that is fine until the day it is not.
 */
export function writeCards(cards: CardConfig[]): void {
  writeLocalCards(cards);
}

/** The committed samples, for anyone editing that file by hand. */
export function writeSampleConfig(cards: CardConfig[]): void {
  writeFileSync(CONFIG_PATH, serializeCards(cards), "utf8");
}

/** Image files already sitting in each card's folder, for the editor's picker. */
export function imagesBySlug(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let slugs: string[];
  try {
    slugs = readdirSync(PUBLIC_CARDS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return out; // no public/cards yet
  }

  for (const slug of slugs) {
    out[slug] = readdirSync(join(PUBLIC_CARDS, slug))
      .filter((name) => /\.(png|jpe?g|webp|avif)$/i.test(name))
      .map((name) => `/cards/${slug}/${name}`)
      .sort();
  }
  return out;
}
