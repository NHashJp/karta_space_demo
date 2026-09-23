import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

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
 * Per-card password first, then the shared one, then nothing at all — which
 * means link-only access. Cards can therefore be mixed: some gated with their
 * own password, some open, without a config change.
 */
function cardPassword(slug: string): string | undefined {
  return process.env[passwordEnvKey(slug)] || process.env.CARD_PASSWORD || undefined;
}

export function passwordRequired(slug: string): boolean {
  return Boolean(cardPassword(slug));
}

/**
 * Token derived from the password itself, so it cannot be forged without it.
 * Good enough for demo access control — not confidential-document security.
 */
function accessToken(slug: string): string {
  return createHmac("sha256", cardPassword(slug) ?? "")
    .update(`karta-space:${slug}`)
    .digest("hex");
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function checkPassword(slug: string, input: string): boolean {
  const password = cardPassword(slug);
  if (!password) return true;
  return safeEquals(input, password);
}

export async function hasAccess(slug: string): Promise<boolean> {
  if (!passwordRequired(slug)) return true;
  const cookie = (await cookies()).get(accessCookieName(slug))?.value;
  return Boolean(cookie) && safeEquals(cookie!, accessToken(slug));
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

export function accessCookie(slug: string) {
  return {
    name: accessCookieName(slug),
    value: accessToken(slug),
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

/** Keyed per IP *and* card, so many cards share one map without it growing forever. */
export function rateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    for (const [k, v] of attempts) if (now > v.resetAt) attempts.delete(k);
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}
