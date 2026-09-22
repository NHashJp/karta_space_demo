import type { CardConfig, CardFace } from "@/types/card";

/**
 * Validation rules, with no filesystem, React or config imports — so the same
 * rules run in three places: `lib/cards.ts` at import time (build fails),
 * the editor API before it writes (save refused), and the editor UI as you
 * type (shown inline).
 */

/** A slug is part of a URL, a cookie name and an environment variable name. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/;

/** Spec §7. Outside this range the text no longer fits a cube face on a phone. */
export const BODY_MIN = 80;
export const BODY_MAX = 250;

export const FACE_COUNT = 6;

/**
 * The secret line is read from inside the cube, where the whole viewport is
 * barely half a world unit across on a phone. Past this it sets too small.
 */
export const SECRET_MAX = 28;

export type Problems = {
  /** Would break the build or the page. The editor refuses to save these. */
  errors: string[];
  /** Against the spec, but harmless to the machinery. Saving is still allowed. */
  warnings: string[];
};

export function imageFolder(slug: string): string {
  return `/cards/${slug}/`;
}

function faceProblems(face: CardFace, index: number, slug: string, out: Problems): void {
  const at = `face ${index + 1}`;

  if (face.type === "text") {
    const chars = face.body.trim().length;
    // Empty is only a warning: a half-written card should still be saveable,
    // and an empty face renders as an empty face rather than breaking.
    if (chars === 0) out.warnings.push(`${at}: the message is empty`);
    else if (chars < BODY_MIN) out.warnings.push(`${at}: ${chars} characters, under ${BODY_MIN}`);
    else if (chars > BODY_MAX) out.warnings.push(`${at}: ${chars} characters, over ${BODY_MAX}`);
    return;
  }

  // An image face with no usable source would throw inside the texture loader.
  const src = face.src.trim();
  if (!src) out.errors.push(`${at}: no image path`);
  else if (src.endsWith("/")) out.errors.push(`${at}: image path is a folder, not a file`);
  else if (!src.startsWith(imageFolder(slug))) {
    out.warnings.push(`${at}: image should live in public${imageFolder(slug)}`);
  }
  if (!face.alt.trim()) out.warnings.push(`${at}: no alt text (needed for screen readers)`);
}

/** `seenSlugs` lets the caller detect duplicates across the whole array. */
export function cardProblems(card: CardConfig, seenSlugs: Iterable<string> = []): Problems {
  const out: Problems = { errors: [], warnings: [] };

  if (!SLUG_PATTERN.test(card.slug ?? "")) {
    out.errors.push("slug must be 3-64 characters of a-z, 0-9 and hyphens");
  } else if ([...seenSlugs].includes(card.slug)) {
    out.errors.push(`slug "${card.slug}" is already used by another card`);
  }
  if (!card.title?.trim()) out.errors.push("the title is empty");
  if (!card.closing?.trim()) out.errors.push("the closing message is empty");
  if (card.faces?.length !== FACE_COUNT) {
    out.errors.push(`a card needs exactly ${FACE_COUNT} faces (found ${card.faces?.length ?? 0})`);
  }

  card.faces?.forEach((face, index) => faceProblems(face, index, card.slug, out));

  const secret = card.secret?.trim();
  if (secret && secret.length > SECRET_MAX) {
    out.warnings.push(
      `the secret line is ${secret.length} characters, over ${SECRET_MAX} — it sets too small inside the cube`,
    );
  }

  for (const link of card.social ?? []) {
    const href = link.href.trim();
    if (!href) continue; // an empty link is simply not rendered
    if (!/^https?:\/\//.test(href)) {
      out.warnings.push(`${link.platform}: link should start with https://`);
    }
    if (!link.label?.trim()) {
      out.warnings.push(`${link.platform}: no label (it is the link's accessible name)`);
    }
  }

  return out;
}

/** Problems for every card, indexed the same way as the input array. */
export function allProblems(cards: CardConfig[]): Problems[] {
  const seen: string[] = [];
  return cards.map((card) => {
    const problems = cardProblems(card, seen);
    seen.push(card.slug);
    return problems;
  });
}
