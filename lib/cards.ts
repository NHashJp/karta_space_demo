import { cards } from "@/config/cards.config";
import { allProblems } from "@/lib/cardRules";
import type { CardConfig } from "@/types/card";

/**
 * Built once at import. Every card is validated here rather than on request,
 * so a miscounted or duplicated card fails the build instead of a visitor's
 * page — which is what keeps a growing config file safe to edit.
 *
 * The rules themselves live in `lib/cardRules.ts`, so the editor can apply the
 * same ones before it writes the file.
 */
const registry = new Map<string, CardConfig>();

allProblems(cards).forEach((problems, index) => {
  const card = cards[index];
  if (problems.errors.length > 0) {
    const which = card.slug ? `"${card.slug}"` : `at index ${index}`;
    throw new Error(
      `cards.config.ts: card ${which} is invalid - ${problems.errors.join("; ")}`,
    );
  }
  registry.set(card.slug, card);
});

export function getCardBySlug(slug: string): CardConfig | null {
  return registry.get(slug) ?? null;
}

/** Every configured card. Used by the dev index and the verification script. */
export function listCards(): CardConfig[] {
  return [...registry.values()];
}

/** Everything the landing screen may show before access is granted. */
export function publicCardShape(card: CardConfig) {
  return { slug: card.slug, title: card.title };
}
