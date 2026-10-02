import { createHash } from "node:crypto";
import type { CardConfig } from "@/types/card";

/**
 * A short one-way hash of the card's content, rendered into the page as
 * <meta name="karta-version">. The editor compares it with the version it just
 * saved to tell whether a deployment is up to date (spec v0.2 §14.1).
 *
 * It reveals nothing: 12 hex characters of SHA-256 over the serialised card.
 */
export function cardVersion(card: CardConfig): string {
  return createHash("sha256").update(JSON.stringify(card)).digest("hex").slice(0, 12);
}
