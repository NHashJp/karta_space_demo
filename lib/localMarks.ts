/**
 * The two small marks a visit leaves, in the reader's own browser (spec v0.2
 * §10.4, §11.6).
 *
 * Nothing about a receiver is stored on a server — no account, no address, no
 * record that they opened anything. But a reply they launched last week should
 * still be a star in their sky when they come back, or the card quietly
 * forgets something they did.
 *
 * So it lives in `localStorage`, which is exactly the right scope for it: it
 * is their mark, on their device, and it disappears when they clear it. Every
 * access is wrapped, because private browsing and blocked storage both throw
 * rather than returning null.
 */

export type ReleasedComet = { releasedOn: string; returnsOn: string };

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private browsing, or storage blocked: the mark is simply not kept */
  }
}

export function readLaunched(slug: string): boolean {
  return read<{ at: string }>(`ks_reply_${slug}`) !== null;
}

export function writeLaunched(slug: string) {
  write(`ks_reply_${slug}`, { at: new Date().toISOString() });
}

export function readReleased(slug: string): ReleasedComet | null {
  return read<ReleasedComet>(`ks_comet_${slug}`);
}

export function writeReleased(slug: string, comet: ReleasedComet) {
  // The token is deliberately not kept. It is the message itself, and the one
  // place it belongs is the email it was sent in (§11.6).
  write(`ks_comet_${slug}`, comet);
}
