import { cardConfig } from "@/config/card.config";
import type { CardConfig } from "@/types/card";

if (cardConfig.faces.length !== 6) {
  throw new Error(
    `card.config.ts must define exactly six faces (found ${cardConfig.faces.length}).`,
  );
}

export function getCardBySlug(slug: string): CardConfig | null {
  return slug === cardConfig.slug ? cardConfig : null;
}

/** Everything the landing screen may show before access is granted. */
export function publicCardShape(card: CardConfig) {
  return { slug: card.slug, title: card.title };
}
