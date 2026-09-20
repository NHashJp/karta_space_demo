import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CardConfig } from "@/types/card";

/**
 * Reading and writing `config/cards.config.ts` from the editor.
 *
 * The config stays a TypeScript file rather than becoming JSON, so it is still
 * type-checked and still readable by hand. The cost is that a save rewrites
 * the whole file from the data: the header below survives, any comment you
 * added further down does not.
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
 * To add a card: append an entry, drop its images in \`public/cards/<slug>/\`,
 * redeploy. Nothing else in the codebase needs to know the card exists —
 * \`lib/cards.ts\` builds the slug registry from this array and validates every
 * entry at import time, so a malformed card fails the build rather than the
 * page.
 *
 * Passwords are never written here. Each card reads
 * \`CARD_PASSWORD_<SLUG>\` (slug upper-cased, non-alphanumerics as \`_\`), falling
 * back to \`CARD_PASSWORD\` for all cards, and is link-only when neither is set.
 * See \`lib/access.ts\`.
 */
export const cards: CardConfig[] = `;

/** Deterministic, so an unchanged card produces an unchanged file. */
export function serializeCards(cards: CardConfig[]): string {
  return `${HEADER}${JSON.stringify(cards, null, 2)};\n`;
}

export function writeCards(cards: CardConfig[]): void {
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
