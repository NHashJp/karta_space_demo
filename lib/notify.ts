/**
 * Which optional features the environment actually makes possible (spec v0.2
 * §14.7). These return booleans and the address itself — never a secret — so
 * that `toClientCard` can decide what to offer without importing env values
 * into anything the browser sees.
 */

/** `NOTIFY_TO`, or a per-card override `NOTIFY_TO_<SLUG>`. */
export function notifyTo(slug: string): string | undefined {
  const key = `NOTIFY_TO_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return process.env[key] || process.env.NOTIFY_TO || undefined;
}

/** A reply can only be offered if it can actually be delivered. */
export function mailReady(slug: string): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM && notifyTo(slug));
}

/** A receiver's comet can only be offered if it can be sealed. */
export function cometReady(): boolean {
  return Boolean(process.env.COMET_SECRET);
}
