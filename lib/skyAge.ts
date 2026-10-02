import { daysBetween } from "./orbitClock.ts";

/**
 * The sky ages with the letter.
 *
 * A card is sent on a day and read on another one, and often on several
 * others — a week later, the following spring, a year on. Until now every one
 * of those readings looked identical, which quietly said that nothing had
 * happened in between. The one thing the card knows for certain about the gap
 * is how long it is, so that is what the background is made of: how far from
 * home the letter has got.
 *
 * Fresh, the gas is close and dense and still warm from the planet it left.
 * Later it has thinned, cooled towards the blue end, and more of the deep
 * field shows through it. Nothing is added or removed — it is the same sky,
 * further out.
 *
 * Three properties matter, and verify checks all three:
 *
 * - **It is monotone.** Older never looks fresher. A reader coming back to a
 *   card should never find it has wound backwards.
 * - **It never arrives.** The curve approaches `AGE_CEILING` and stops short
 *   of it, so there is no day on which the card becomes finished. 「またね」
 *   is not a countdown to the sky going out.
 * - **It cannot be caught moving.** The input is a civil date, so it steps
 *   once a day, by at most a third of a per cent of the whole range. Two
 *   readings a day apart are the same picture; two a season apart are not.
 */

/**
 * Half of the change happens in the first six months.
 *
 * Chosen against how these cards are actually read: within the first week it
 * should look like the card you were sent, by the next season it should be
 * visibly further away, and a year later it should be a different sky — while
 * still being recognisably the same card. A half-life rather than a deadline,
 * because a card does not expire.
 */
export const AGE_HALF_LIFE_DAYS = 180;

/** The curve stops short of 1: see "it never arrives", above. */
export const AGE_CEILING = 0.92;

/** How the sky is made, at a given age. The far column is the age-1 end. */
const GAS_FAR = 0.52;
const WARMTH_FAR = 0.18;
const STARS_FAR = 1.45;

/** Fresh, these are the backdrop's own colours; far, the cooler versions. */
const DEEP_FRESH = "#10203a";
const DEEP_FAR = "#0a1626";
const NEBULA_FRESH = "#4a3676";
const NEBULA_FAR = "#2f3a63";

export type SkyEpoch = {
  /** "the day this was written", the card's own statement of when it was sent. */
  writtenAt?: string;
  comet?: { leftOn: string };
};

export type Sky = {
  /** Multiplier on how much gas there is. */
  gas: number;
  /** How much of the warm half of the palette survives: embers, warm knots. */
  warmth: number;
  /** Multiplier on the starfield's brightness — the field showing through. */
  stars: number;
  /** The backdrop's two body colours, already cooled for this age. */
  deep: string;
  nebula: string;
};

/**
 * The day the card was sent.
 *
 * `writtenAt` first: it is what the sender chose to say about when this was
 * sent, and it is already printed on the landing screen, so the sky and that
 * line cannot disagree. A card without one falls back to the comet's `leftOn`
 * — the day you parted — which is the same instant by another name.
 *
 * A fuzzy `writtenAt` of "2026" or "2026-03" resolves to the first of the
 * month or the year, the same way every other date comparison in the card
 * does (`daysBetween`). That is coarse, and it is the sender's own choice of
 * precision; nothing here should invent a day they did not give.
 */
export function cardEpoch(card: SkyEpoch): string | undefined {
  return card.writtenAt ?? card.comet?.leftOn;
}

/**
 * Days from the send date to `today`, both civil dates in the card's zone.
 *
 * Zero for a card with no date at all, and zero rather than negative for a
 * card dated in the future: a sender post-dating a letter, or a reader whose
 * clock is wrong, should see the card as it was sent, not an inverted sky.
 */
export function elapsedDays(card: SkyEpoch, today: string): number {
  const epoch = cardEpoch(card);
  if (!epoch) return 0;
  const days = daysBetween(epoch, today);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** How far out the letter has got, 0 (just sent) to just under `AGE_CEILING`. */
export function skyAge(days: number): number {
  if (!(days > 0)) return 0;
  return AGE_CEILING * (1 - Math.pow(2, -days / AGE_HALF_LIFE_DAYS));
}

/** The whole background, at an age. The one place these numbers are decided. */
export function sky(age: number): Sky {
  const a = Math.min(Math.max(age, 0), 1);
  return {
    gas: 1 + (GAS_FAR - 1) * a,
    warmth: 1 + (WARMTH_FAR - 1) * a,
    stars: 1 + (STARS_FAR - 1) * a,
    deep: blend(DEEP_FRESH, DEEP_FAR, a),
    nebula: blend(NEBULA_FRESH, NEBULA_FAR, a),
  };
}

/** The card's sky today, in one call: what the scene actually asks for. */
export function skyFor(card: SkyEpoch, today: string): Sky {
  return sky(skyAge(elapsedDays(card, today)));
}

/** Same arithmetic as `sceneLight`'s blend, on the same kind of hex string. */
function blend(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const mixed = a.map((channel, i) => Math.round(channel + (b[i] - channel) * amount));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
