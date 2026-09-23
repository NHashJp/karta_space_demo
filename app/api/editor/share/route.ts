import { NextResponse } from "next/server";
import { editorEnabled, refused } from "@/lib/editorGuard";
import { formatPassword, generatePassword, hashPassword } from "@/lib/password";

/**
 * Issuing a link and a password (spec v0.2 §15.6, §15.7).
 *
 * The hash is computed here rather than in the browser for the obvious reason
 * — scrypt at N = 2^15 would block a tab for a noticeable moment — and for a
 * better one: there is then exactly one implementation of "how a password
 * becomes a hash", shared with the gate that checks it.
 */

/** No 0/O or 1/I/L, the same alphabet as a generated password (§14.9). */
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SLUG_RANDOM = 10;

export async function POST(request: Request) {
  if (!editorEnabled) return refused();

  const body = (await request.json().catch(() => ({}))) as {
    generate?: boolean;
    password?: string;
    slugPrefix?: string;
  };

  if (typeof body.slugPrefix === "string") {
    return NextResponse.json({ slug: makeSlug(body.slugPrefix) });
  }

  if (body.generate) {
    const password = generatePassword();
    return NextResponse.json({
      // Shown as K7QM-2XPA, hashed as the plain characters: the gate
      // normalises hyphens away, so the two are the same password.
      password: formatPassword(password),
      hash: hashPassword(password),
    });
  }

  if (typeof body.password === "string" && body.password.trim() !== "") {
    return NextResponse.json({ hash: hashPassword(body.password) });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}

/**
 * `<prefix>-<10 random>`. The random part is what actually protects a
 * link-only card, so it is generated here rather than typed: a slug someone
 * chooses is a slug someone else can guess.
 */
function makeSlug(prefix: string): string {
  const clean = prefix
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const bytes = new Uint8Array(SLUG_RANDOM * 2);
  crypto.getRandomValues(bytes);

  let random = "";
  const limit = 256 - (256 % SLUG_ALPHABET.length);
  for (const byte of bytes) {
    if (byte >= limit) continue;
    random += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
    if (random.length === SLUG_RANDOM) break;
  }

  return clean ? `${clean}-${random}` : random;
}
