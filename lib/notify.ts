/**
 * Which optional features the environment actually makes possible (spec v0.2
 * §14.7). These return booleans and the address itself — never a secret — so
 * that `toClientCard` can decide what to offer without importing env values
 * into anything the browser sees.
 */

/**
 * Development only: deliver to a folder instead of to a person.
 *
 * The rocket's flight and the comet's boarding are dispatched only on a 200
 * from the route, deliberately — the animation is a confirmation, not a guess
 * (§10.2). The honest consequence is that neither can be seen at all without
 * a real mail provider behind it, which is a steep price for looking at an
 * animation, and it meant the two most elaborate moments in the card were the
 * two nobody checked.
 *
 * So the send is swapped, and nothing else. The routes, the gating, the
 * templates, the rate limit, the honeypot and the sealed token all run exactly
 * as they will in production; only the last hop writes a file instead of
 * making a request. What you are testing is therefore the real thing, with a
 * different postbox.
 *
 * Two locks, because a sink that reached production would silently swallow
 * every message the card exists to deliver: it is off unless explicitly asked
 * for, and it refuses to exist outside development.
 */
export function mailSink(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.MAIL_DEV_SINK === "1";
}

/** Where the sink writes, relative to the project root. */
export const MAIL_SINK_DIR = ".mail";

/**
 * `NOTIFY_TO`, or a per-card override `CARD_NOTIFY_TO_<SLUG>` (§14.7).
 *
 * Under the sink there is always an address, so the templates — which return
 * null without one — can be exercised on an otherwise empty `.env.local`.
 */
export function notifyTo(slug: string): string | undefined {
  const key = `CARD_NOTIFY_TO_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return (
    process.env[key] ||
    process.env.NOTIFY_TO ||
    (mailSink() ? "sink@localhost" : undefined)
  );
}

/** A reply can only be offered if it can actually be delivered. */
export function mailReady(slug: string): boolean {
  if (mailSink()) return true;
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM && notifyTo(slug));
}

/** A receiver's comet can only be offered if it can be sealed. */
export function cometReady(): boolean {
  return Boolean(process.env.COMET_SECRET);
}
