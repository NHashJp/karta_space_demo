import { FUZZY_DATE_PATTERN, isFullDate, parseFuzzyDate } from "./fuzzyDate.ts";
import { isValidTimeZone } from "./orbitClock.ts";
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

/* ---------- v0.2 limits (spec §5) ---------- */

export const MEMORY_MAX = 12;
export const MEMORY_TITLE_MAX = 24;
export const MEMORY_CAPTION_MAX = 80;
export const SATELLITE_LABEL_MAX = 16;
export const SATELLITE_MESSAGE_MAX = 60;
export const COMET_MESSAGE_MAX = 250;
export const LINE_FACE_MIN = 1;
export const LINE_FACE_MAX = 30;
export const CLOSING_MAX = 18;
export const FROM_MAX = 16;
export const HINT_MAX = 40;
/** A slug's random tail below this is a guessable link. */
export const SLUG_RANDOM_MIN = 8;

const PASSWORD_HASH_PATTERN = /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/;

export type Problems = {
  /** Would break the build or the page. The editor refuses to save these. */
  errors: string[];
  /** Against the spec, but harmless to the machinery. Saving is still allowed. */
  warnings: string[];
  /**
   * Worth knowing, never wrong: advice about an existing, valid card. Notes
   * never fail anything — `npm run verify` prints them and moves on.
   *
   * They exist because spec v0.2 §18 requires a v0.1 card to stay exactly as
   * it was, verify included, while §5 adds guidance (a long closing line, a
   * short slug) that such cards will legitimately trip.
   */
  notes: string[];
};

export function imageFolder(slug: string): string {
  return `/cards/${slug}/`;
}

function faceProblems(face: CardFace, index: number, slug: string, out: Problems): void {
  const at = `face ${index + 1}`;

  if (face.type === "text") {
    const chars = face.body.trim().length;

    // A "line" face is a beat, not a paragraph: its own range replaces the
    // 80-250 check entirely (spec v0.2 §5).
    if (face.style === "line") {
      if (chars < LINE_FACE_MIN || chars > LINE_FACE_MAX) {
        out.warnings.push(`${at}: a line face is ${chars} characters, outside ${LINE_FACE_MIN}-${LINE_FACE_MAX}`);
      }
      return;
    }
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
  const out: Problems = { errors: [], warnings: [], notes: [] };

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

  v02Problems(card, out);

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

/* ---------------------------------------------------------------------------
   v0.2 additions. Every field is optional, so each block runs only when its
   field is present: a v0.1 card collects none of these.
   --------------------------------------------------------------------------- */

function memoryProblems(card: CardConfig, out: Problems): void {
  const memories = card.memories;
  if (!memories?.length) return;

  if (memories.length > MEMORY_MAX) {
    out.errors.push(`${memories.length} memories, over the limit of ${MEMORY_MAX}`);
  }

  memories.forEach((memory, index) => {
    const at = `memory ${index + 1}`;

    if (!FUZZY_DATE_PATTERN.test(memory.date ?? "") || !parseFuzzyDate(memory.date)) {
      out.errors.push(`${at}: "${memory.date}" is not a date (YYYY, YYYY-MM or YYYY-MM-DD)`);
    }

    const title = memory.title?.trim() ?? "";
    if (!title) out.warnings.push(`${at}: no title`);
    else if (title.length > MEMORY_TITLE_MAX) {
      out.warnings.push(`${at}: title is ${title.length} characters, over ${MEMORY_TITLE_MAX}`);
    }
    if ((memory.caption?.trim().length ?? 0) > MEMORY_CAPTION_MAX) {
      out.warnings.push(`${at}: caption is over ${MEMORY_CAPTION_MAX} characters`);
    }

    const image = memory.image;
    if (!image) return;
    const src = image.src?.trim() ?? "";
    if (!src) out.errors.push(`${at}: image has no path`);
    else if (src.endsWith("/")) out.errors.push(`${at}: image path is a folder, not a file`);
    else if (!src.startsWith(privateFolder(card.slug))) {
      // A warning, not an error: the file still loads, but from /public it is
      // fetchable by anyone with the URL (spec v0.2 §14.3).
      out.warnings.push(`${at}: image should live in ${privateFolder(card.slug)}`);
    }
    if (!image.alt?.trim()) out.warnings.push(`${at}: image has no alt text`);
  });
}

export function privateFolder(slug: string): string {
  return `private/cards/${slug}/`;
}

function satelliteProblems(card: CardConfig, out: Problems): void {
  const satellite = card.satellite;
  if (!satellite) return;

  if (!isFullDate(satellite.date)) {
    out.errors.push(`satellite: "${satellite.date}" is not a YYYY-MM-DD date`);
  }
  if ((satellite.label?.trim().length ?? 0) > SATELLITE_LABEL_MAX) {
    out.warnings.push(`satellite: label is over ${SATELLITE_LABEL_MAX} characters`);
  }
  if ((satellite.message?.trim().length ?? 0) > SATELLITE_MESSAGE_MAX) {
    out.warnings.push(`satellite: message is over ${SATELLITE_MESSAGE_MAX} characters`);
  }
}

function cometProblems(card: CardConfig, out: Problems): void {
  const comet = card.comet;
  if (!comet) return;

  const returnsOn = comet.returnsOn ?? card.satellite?.date;
  if (!comet.returnsOn && !card.satellite) {
    out.errors.push("comet: needs returnsOn, or a satellite to take its date from");
  }
  if (comet.returnsOn && !isFullDate(comet.returnsOn)) {
    out.errors.push(`comet: returnsOn "${comet.returnsOn}" is not a YYYY-MM-DD date`);
  }
  if (comet.releasedOn && !isFullDate(comet.releasedOn)) {
    out.errors.push(`comet: releasedOn "${comet.releasedOn}" is not a YYYY-MM-DD date`);
  }
  if (comet.releasedOn && returnsOn && comet.releasedOn >= returnsOn) {
    out.errors.push("comet: releasedOn is on or after returnsOn — it would arrive before it left");
  }
  if (!comet.message && !comet.receiverCanRelease) {
    out.errors.push("comet: has neither a message of its own nor receiverCanRelease");
  }
  if ((comet.message?.trim().length ?? 0) > COMET_MESSAGE_MAX) {
    out.warnings.push(`comet: message is over ${COMET_MESSAGE_MAX} characters`);
  }
}

function v02Problems(card: CardConfig, out: Problems): void {
  memoryProblems(card, out);
  satelliteProblems(card, out);
  cometProblems(card, out);

  if (card.writtenAt && !parseFuzzyDate(card.writtenAt)) {
    out.errors.push(`writtenAt: "${card.writtenAt}" is not a date`);
  }
  if (card.timeZone && !isValidTimeZone(card.timeZone)) {
    out.errors.push(`timeZone: "${card.timeZone}" is not a time zone this runtime knows`);
  }
  if ((card.from?.trim().length ?? 0) > FROM_MAX) {
    out.warnings.push(`from: "${card.from}" is over ${FROM_MAX} characters`);
  }
  if (card.closing && card.closing.trim().length > CLOSING_MAX) {
    out.notes.push(
      `the closing line is ${card.closing.trim().length} characters — it draws at about 14px on a phone`,
    );
  }

  const access = card.access;
  if (access?.passwordHash && !PASSWORD_HASH_PATTERN.test(access.passwordHash)) {
    out.errors.push("access: passwordHash is not in the scrypt$... format the editor writes");
  }
  if ((access?.hint?.trim().length ?? 0) > HINT_MAX) {
    out.warnings.push(`access: hint is over ${HINT_MAX} characters`);
  }
  // A hash with no key to sign cookies with means the card stays shut for
  // everyone, right password or not (§14.9). While developing that is worth
  // saying once; shipping it would be shipping a card nobody can open.
  if (access?.passwordHash && !process.env.ACCESS_SECRET) {
    const message =
      "access: passwordHash is set but ACCESS_SECRET is not — this card stays locked for everyone";
    if (process.env.NODE_ENV === "production") out.errors.push(message);
    else out.notes.push(message);
  }

  // An unguessable slug is the only thing protecting a link-only card.
  const randomPart = card.slug?.split("-").pop() ?? "";
  if (randomPart.length < SLUG_RANDOM_MIN) {
    out.notes.push(
      `slug "${card.slug}" ends in ${randomPart.length} random characters — a guessable link`,
    );
  }
}
