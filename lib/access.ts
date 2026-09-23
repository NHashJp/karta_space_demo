import { createHmac, timingSafeEqual } from "node:crypto";
import { getCardBySlug } from "./cards.ts";
import { isPasswordHash, normalisePassword, verifyPassword } from "./password.ts";

const COOKIE_PREFIX = "ks_access_";
const COOKIE_MAX_AGE = 60 * 60 * 18; // 18 hours

/**
 * One cookie per card, so opening a second card does not evict access to the
 * first — and so a cookie is useless on any other card.
 */
export function accessCookieName(slug: string): string {
  return `${COOKIE_PREFIX}${slug}`;
}

/** `2026-newyear-7k2m` -> `CARD_PASSWORD_2026_NEWYEAR_7K2M`. */
export function passwordEnvKey(slug: string): string {
  return `CARD_PASSWORD_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

/**
 * How a card is protected, in the order spec v0.2 §14.9 sets out:
 *
 *   per-card env  →  the hash the editor wrote into config  →  shared env  →  none
 *
 * An environment password always wins, so every card that worked in v0.1 keeps
 * behaving exactly as it did.
 */
export type CardSecret =
  | { kind: "env"; password: string }
  | { kind: "hash"; hash: string }
  | { kind: "none" };

export function cardSecret(slug: string, card = getCardBySlug(slug)): CardSecret {
  const perCard = process.env[passwordEnvKey(slug)];
  if (perCard) return { kind: "env", password: perCard };

  const hash = card?.access?.passwordHash;
  if (isPasswordHash(hash)) return { kind: "hash", hash };

  const shared = process.env.CARD_PASSWORD;
  if (shared) return { kind: "env", password: shared };

  return { kind: "none" };
}

export function passwordRequired(slug: string): boolean {
  return cardSecret(slug).kind !== "none";
}

/**
 * Token derived from the secret itself, so it cannot be forged without it.
 * Good enough for demo access control — not confidential-document security.
 *
 * A hash-protected card signs with ACCESS_SECRET over the hash, so changing the
 * password invalidates every outstanding cookie, exactly as changing an
 * environment password does. Without ACCESS_SECRET there is no key to sign
 * with, and the card fails closed (§14.9).
 */
export function accessToken(slug: string, card = getCardBySlug(slug)): string | null {
  const secret = cardSecret(slug, card);

  if (secret.kind === "env") {
    return createHmac("sha256", secret.password).update(`karta-space:${slug}`).digest("hex");
  }
  if (secret.kind === "hash") {
    const key = process.env.ACCESS_SECRET;
    if (!key) return null;
    return createHmac("sha256", key)
      .update(`karta-space:${slug}:${secret.hash}`)
      .digest("hex");
  }
  return null;
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Both paths normalise first, so the forgiving input of §7 applies to
 * environment passwords too, not just editor-issued ones.
 */
export function checkPassword(slug: string, input: string): boolean {
  const secret = cardSecret(slug);

  if (secret.kind === "none") return true;
  if (secret.kind === "hash") return verifyPassword(input, secret.hash);
  return safeEquals(normalisePassword(input), normalisePassword(secret.password));
}

export async function hasAccess(slug: string): Promise<boolean> {
  if (!passwordRequired(slug)) return true;
  const expected = accessToken(slug);
  if (!expected) return false; // fail closed: no ACCESS_SECRET, no access
  // Imported here rather than at the top of the file so that the rest of this
  // module — the precedence rules and the password check — stays plain Node and
  // can be exercised by `npm run verify`.
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).get(accessCookieName(slug))?.value;
  return Boolean(cookie) && safeEquals(cookie!, expected);
}

/**
 * The one check every receiver-facing route under /c/[slug] makes: a link-only
 * card passes, a password card needs its cookie (spec v0.2 §14).
 *
 * This is *card* access, not receiver authentication — the receiver never signs
 * in and has no identity here.
 */
export async function canView(slug: string): Promise<boolean> {
  return !passwordRequired(slug) || (await hasAccess(slug));
}

/** Null when the card cannot issue a cookie at all (no secret, or no key). */
export function accessCookie(slug: string) {
  const value = accessToken(slug);
  if (!value) return null;

  return {
    name: accessCookieName(slug),
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: `/c/${slug}`,
    maxAge: COOKIE_MAX_AGE,
  };
}

/** Small in-memory throttle. Resets on every serverless cold start — deliberately basic. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/**
 * Keyed per IP *and* card, so many cards share one map without it growing
 * forever. `max` differs by what is being limited: ten password guesses are a
 * person typing, but ten replies in ten minutes are not.
 */
export function rateLimit(key: string, max = MAX_ATTEMPTS): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    for (const [k, v] of attempts) if (now > v.resetAt) attempts.delete(k);
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}
