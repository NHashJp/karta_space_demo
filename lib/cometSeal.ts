import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Sealing a comet (spec v0.2 §11.5).
 *
 * A receiver writes a message that must be unreadable until a date. There is
 * no database, so the message cannot be *kept* somewhere and released later —
 * instead the message **is** the link. Everything about the comet, its dates
 * included, is encrypted into a token that goes in one email.
 *
 * Why the dates are inside the ciphertext: if `returnsOn` were a query
 * parameter beside the token, anyone holding the link could edit it and open
 * the comet early. Inside, changing it means changing the ciphertext, and
 * AES-GCM refuses to decrypt anything that has been altered at all.
 *
 * ## The honest limit
 *
 * This is a promise kept by software, not protection from the operator.
 * Whoever holds `COMET_SECRET` can open any comet whenever they like, and in
 * the MVP the sender *is* the operator. The seal stops a curious person
 * peeking at a link; it does not stop a determined one who also runs the
 * server. `docs/access-and-security.md` says this in plain words, because a
 * seal that is described as stronger than it is is worse than no seal at all.
 *
 * Rotating `COMET_SECRET` loses every comet still on its way. They are not
 * stored anywhere to re-encrypt.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Bound into the ciphertext, so a token from some other system cannot be fed in. */
const AAD = Buffer.from("karta-comet-v1");

export type CometPayload = {
  v: 1;
  slug: string;
  name: string;
  body: string;
  releasedOn: string;
  returnsOn: string;
};

/** AES-256 needs exactly 32 bytes, and a shorter one is a misconfiguration. */
const KEY_BYTES = 32;

function usable(key: Buffer | null): key is Buffer {
  // Checked at every entry point rather than only where the key is read from
  // the environment: silently padding a short key, or throwing deep inside
  // node's cipher, are both worse than refusing to seal.
  return key !== null && key.length === KEY_BYTES;
}

export function cometSecret(): Buffer | null {
  const raw = process.env.COMET_SECRET;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return usable(key) ? key : null;
}

export function seal(payload: CometPayload, key = cometSecret()): string | null {
  if (!usable(key)) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(AAD);

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  // iv ‖ ciphertext ‖ tag, base64url so it survives being a path segment.
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64url");
}

export type Opened =
  | { status: "invalid" }
  /** On its way: the dates, and deliberately **not** the message. */
  | { status: "away"; slug: string; name: string; releasedOn: string; returnsOn: string }
  | {
      status: "returned";
      slug: string;
      name: string;
      releasedOn: string;
      returnsOn: string;
      body: string;
    };

/**
 * Open a token, as far as today allows.
 *
 * Note what this does *not* do: before the return date it decrypts the payload
 * and then does not return the body. The decryption has to happen — the dates
 * are inside it — but the body never leaves this function, so the page that
 * calls it cannot leak what it was never handed.
 */
export function open(token: string, today: string, key = cometSecret()): Opened {
  if (!usable(key)) return { status: "invalid" };

  let payload: CometPayload;
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return { status: "invalid" };

    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(raw.length - TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES, raw.length - TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);

    // `final()` is where a tampered token fails: GCM authenticates the whole
    // message, so a single flipped bit anywhere throws here.
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    payload = JSON.parse(plain) as CometPayload;
  } catch {
    return { status: "invalid" };
  }

  if (payload?.v !== 1 || !payload.returnsOn || !payload.releasedOn) {
    return { status: "invalid" };
  }

  const common = {
    slug: payload.slug,
    name: payload.name,
    releasedOn: payload.releasedOn,
    returnsOn: payload.returnsOn,
  };

  // String comparison is correct for YYYY-MM-DD, and the date it compares
  // against is the card's civil today, decided by the caller.
  if (today < payload.returnsOn) return { status: "away", ...common };
  return { status: "returned", ...common, body: payload.body };
}
