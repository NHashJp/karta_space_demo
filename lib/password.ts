import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Card passwords (spec v0.2 §14.9).
 *
 * Two ideas here. The first is that what the receiver types should be
 * forgiving: a password is often the answer to a hint only the two people know
 * ("the station where we first met"), and a person typing that on a phone
 * should not fail on a katakana keyboard, a stray space, or a capital letter.
 * So both sides are normalised before they are compared.
 *
 * The second is that the hash may be committed to the repository while the
 * password is not, which is why it is scrypt with a per-card salt rather than
 * anything fast.
 */

/** No 0/O or 1/I/L: these get read aloud and typed by hand. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GENERATED_LENGTH = 8;

const SCRYPT_N = 32768; // 2^15
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/**
 * NFKC, then strip what a person can reasonably add or drop, then fold
 * katakana onto hiragana. `カマクラ`, `かまくら` and `ｶﾏｸﾗ` all end up the same,
 * and so do `k7qm 2xpa` and `K7QM-2XPA`.
 */
export function normalisePassword(input: string): string {
  return input
    .normalize("NFKC")
    .trim()
    .replace(/[\s　-]/g, "")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

/**
 * 31 letters is not a power of two, so taking a byte modulo the alphabet would
 * make the first few letters slightly likelier than the rest. Rejecting the
 * bytes that fall past the last whole run keeps all 31 equally likely — about
 * 39.6 bits over eight characters.
 */
export function generatePassword(): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < GENERATED_LENGTH) {
    for (const byte of randomBytes(GENERATED_LENGTH)) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === GENERATED_LENGTH) break;
    }
  }
  return out;
}

/** `K7QM2XPA` -> `K7QM-2XPA`: easier to read out loud and to type. */
export function formatPassword(password: string): string {
  const clean = password.replace(/-/g, "");
  if (clean.length !== GENERATED_LENGTH) return password;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

export function hashPassword(password: string, salt = randomBytes(SALT_LENGTH)): string {
  const derived = scryptSync(normalisePassword(password), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    // scrypt at N = 2^15 needs more than node's default 32 MB.
    maxmem: 128 * SCRYPT_N * SCRYPT_R * 2,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export function isPasswordHash(value: string | undefined): value is string {
  return typeof value === "string" && /^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/.test(value);
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!isPasswordHash(stored)) return false;

  const [, n, r, p, salt, expected] = stored.split("$");
  const expectedBuffer = Buffer.from(expected, "base64");

  // scrypt's output is a prefix under truncation: the first 29 bytes of a
  // 32-byte key are the 29-byte key. A shortened hash would therefore still
  // verify, while matching on far fewer bits, so insist on the full length.
  if (expectedBuffer.length !== KEY_LENGTH) return false;

  let derived: Buffer;
  try {
    derived = scryptSync(normalisePassword(password), Buffer.from(salt, "base64"), expectedBuffer.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * Number(n) * Number(r) * 2,
    });
  } catch {
    return false; // malformed parameters: treat as no match, never as a pass
  }

  return derived.length === expectedBuffer.length && timingSafeEqual(derived, expectedBuffer);
}
