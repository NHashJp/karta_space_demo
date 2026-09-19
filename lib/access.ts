import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ACCESS_COOKIE = "ks_access";
const COOKIE_MAX_AGE = 60 * 60 * 18; // 18 hours

/** Link-only access when CARD_PASSWORD is unset. */
export function passwordRequired(): boolean {
  return Boolean(process.env.CARD_PASSWORD);
}

/**
 * Token derived from the password itself, so it cannot be forged without it.
 * Good enough for demo access control — not confidential-document security.
 */
function accessToken(slug: string): string {
  const password = process.env.CARD_PASSWORD ?? "";
  return createHmac("sha256", password).update(`karta-space:${slug}`).digest("hex");
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function checkPassword(input: string): boolean {
  const password = process.env.CARD_PASSWORD;
  if (!password) return true;
  return safeEquals(input, password);
}

export async function hasAccess(slug: string): Promise<boolean> {
  if (!passwordRequired()) return true;
  const cookie = (await cookies()).get(ACCESS_COOKIE)?.value;
  return Boolean(cookie) && safeEquals(cookie!, accessToken(slug));
}

export function accessCookie(slug: string) {
  return {
    name: ACCESS_COOKIE,
    value: accessToken(slug),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/** Small in-memory throttle. Resets on every serverless cold start — deliberately basic. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function rateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}
