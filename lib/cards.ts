import { cards as sampleCards } from "../config/cards.config.ts";
import { allProblems } from "./cardRules.ts";
import { localCardsStamp, mergeCards, readLocalCards } from "./localCards.ts";
import type { CardConfig } from "@/types/card";

/**
 * Every card: the committed samples, with anything in `.karta/cards.local.json`
 * layered over them by slug.
 *
 * Real cards are local and never committed — see `lib/localCards.ts` for why.
 * The samples stay in the repository so a fresh checkout has something to
 * open and the documentation has something to point at.
 */
/**
 * Every card is validated before it reaches the registry, so a miscounted or
 * duplicated card fails loudly rather than on a visitor's page — which is
 * what keeps a growing config safe to edit.
 *
 * The rules themselves live in `lib/cardRules.ts`, so the editor can apply
 * the same ones before it writes.
 */
function build(): Map<string, CardConfig> {
  const cards = mergeCards(sampleCards, readLocalCards());
  const next = new Map<string, CardConfig>();

  allProblems(cards).forEach((problems, index) => {
    const card = cards[index];
    if (problems.errors.length > 0) {
      const which = card.slug ? `"${card.slug}"` : `at index ${index}`;
      throw new Error(`card ${which} is invalid - ${problems.errors.join("; ")}`);
    }
    next.set(card.slug, card);
  });

  return next;
}

let stamp = localCardsStamp();
let registry = build();

/**
 * Rebuild when the local file has been written since last time.
 *
 * The samples are a module and the bundler reloads those for us. The local
 * file is not, so an editor save would otherwise be invisible until the
 * server restarted — and the editor's whole point is the preview beside it.
 * One `stat` per lookup, against a handful of cards.
 */
function current(): Map<string, CardConfig> {
  const now = localCardsStamp();
  if (now !== stamp) {
    stamp = now;
    registry = build();
  }
  return registry;
}

export function getCardBySlug(slug: string): CardConfig | null {
  return current().get(slug) ?? null;
}

/** Every configured card. Used by the dev index and the verification script. */
export function listCards(): CardConfig[] {
  return [...current().values()];
}

/** Everything the landing screen may show before access is granted. */
export function publicCardShape(card: CardConfig) {
  return { slug: card.slug, title: card.title, lang: card.lang ?? "ja" };
}
