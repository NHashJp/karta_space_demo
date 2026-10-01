import { createHmac, timingSafeEqual } from "node:crypto";
import { normalisePassword } from "./password.ts";

/**
 * A password in front of the editor (spec v0.2 §15, extending §14.9).
 *
 * The editor already refuses to exist in production, and that is the guard
 * that matters. This is the second one, for the ways a development server
 * stops being private: a laptop on a shared network, a tunnel opened to show
 * someone the preview, a machine left unlocked. The editor writes to the
 * repository and shows every card's plaintext password in its Share tab, so
 * "only on my machine" is worth one more lock than nothing.
 *
 * Built on the same parts as the card gate — normalise, compare in constant
 * time, derive the cookie from the secret itself — so there is one idea of
 * what a password is in this codebase rather than two.
 */

const COOKIE_NAME = "ks_editor";
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours: one working day, not a week

export const editorCookieName = COOKIE_NAME;

/** The password, or undefined when none is set and the editor is simply open. */
export function editorPassword(): string | undefined {
  return process.env.EDITOR_PASSWORD || undefined;
}

/** Whether the editor asks for anything at all. */
export function editorLocked(): boolean {
  return Boolean(editorPassword());
}

/**
 * Derived from the password, so it cannot be forged without it — and so
 * changing the password invalidates every cookie already issued, without
 * needing anywhere to record that it changed.
 */
export function editorToken(): string | null {
  const password = editorPassword();
  if (!password) return null;
  return createHmac("sha256", normalisePassword(password))
    .update("karta-space:editor")
    .digest("hex");
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * The same forgiving comparison the card gate uses (§7): case, spaces, hyphens
 * and width are all ignored. This one is typed by the author rather than by a
 * receiver reading a hint, so the forgiveness matters less — but two rules for
 * what counts as "the right password" in one codebase is one rule too many.
 */
export function checkEditorPassword(input: string): boolean {
  const password = editorPassword();
  if (!password) return true;
  return safeEquals(normalisePassword(input), normalisePassword(password));
}

/** Null when there is no password to sign with, so nothing can be issued. */
export function editorCookie() {
  const value = editorToken();
  if (!value) return null;

  return {
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/**
 * Whether this request may use the editor.
 *
 * Imported inside the function rather than at the top of the file, so the rest
 * of this module stays plain Node and `npm run verify` can exercise the token
 * and the comparison without a request context.
 */
export async function hasEditorAccess(): Promise<boolean> {
  if (!editorLocked()) return true;
  const expected = editorToken();
  if (!expected) return false; // fail closed
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  return Boolean(cookie) && safeEquals(cookie!, expected);
}
