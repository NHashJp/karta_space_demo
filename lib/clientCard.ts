import { civilDate, DEFAULT_TIME_ZONE } from "./orbitClock.ts";
import { cometCycle, type CometStatus } from "./cometOrbit.ts";
import { returnLabel, type ReturnLabel } from "./returnLabel.ts";
import { sortMemoriesNewestFirst } from "./fuzzyDate.ts";
import type { CardConfig, Memory, MemoryImage } from "@/types/card";

/**
 * What the browser is allowed to know about a card (spec v0.2 §14.1).
 *
 * Two things must never cross this boundary, and both are verify checks:
 * `access.passwordHash`, ever; and the comet's sealed words before the day it
 * comes back. The seal is the point of the comet — a promise that a message is
 * unreadable until a date is worth nothing if the text is sitting in the page
 * source the whole time.
 */

export type ClientMemory = Memory & { image?: MemoryImage & { url: string } };

/**
 * The promise comet, as the browser is allowed to know it.
 *
 * `message` — the sender's sealed words — is present only once the comet has
 * come back. Before then it is not in this object, not in the payload, and not
 * in the page. The promise is kept by absence rather than by a flag.
 */
export type ClientComet = {
  status: CometStatus;
  leftOn: string;
  returnsOn: string;
  /** What the card *says* about the return, at the configured precision. */
  label: ReturnLabel;
  promise?: string;
  /** The receiver may put words on it, and they could actually be delivered. */
  capsule: boolean;
  /** Present only on and after the return. */
  message?: string;
};

export type ClientCard = Omit<CardConfig, "comet" | "reply" | "access"> & {
  from: string;
  /** The hint only. The hash stays on the server. */
  passwordHint?: string;
  comet?: ClientComet;
  replyAvailable: boolean;
  replyPrompt?: string;
  memories?: ClientMemory[];
  /**
   * Today's date in the card's own time zone, decided on the server. The
   * browser's clock may be in another zone, or simply wrong, and the comet's
   * position has to agree with the label the server computed.
   */
  today: string;
  /** True when anything at all exists past the closing screen. */
  hasOrbit: boolean;
  /** The crossroads only appears when it has somewhere to point (§8.8). */
  hasCrossroads: boolean;
};

/** What the environment makes possible, resolved by the caller (never values). */
export type EnvFlags = {
  /** Mail is configured: a reply can actually be delivered to the sender. */
  mailReady: boolean;
  /** COMET_SECRET is set: the receiver's words can be sealed. */
  cometReady: boolean;
};

export const DEFAULT_FROM = "送り主";
export const DEFAULT_REPLY_PROMPT = "ひとこと、返事をどうぞ。";

/**
 * A memory image is served through the media route, never from /public.
 *
 * The config names the file by its real path in the repository —
 * `private/cards/<slug>/x.png` — so that someone reading the config can see
 * where the file actually is. The route is addressed relative to that folder,
 * so the prefix comes off here.
 */
function mediaUrl(slug: string, src: string): string {
  const folder = `private/cards/${slug}/`;
  const path = src.replace(/^\/+/, "").replace(folder, "");
  return `/c/${slug}/media/${path}`;
}

export function toClientCard(card: CardConfig, now: Date, env: EnvFlags): ClientCard {
  const timeZone = card.timeZone ?? DEFAULT_TIME_ZONE;
  const today = civilDate(now, timeZone);
  const from = card.from?.trim() || DEFAULT_FROM;

  const replyAvailable = Boolean(card.reply) && env.mailReady;

  let comet: ClientComet | undefined;
  if (card.comet) {
    const cycle = cometCycle(card.comet, today);
    /*
     * Opened words stay open (§8.10).
     *
     * The test is the **config's** returnsOn — the first return — not the
     * current cycle's. A yearly comet is "away" again a fortnight after it
     * came back, and re-sealing words someone has already read would be a
     * strange thing to do to them.
     */
    const opened = today >= card.comet.returnsOn;

    comet = {
      status: cycle.status,
      leftOn: cycle.leftOn,
      returnsOn: cycle.returnsOn,
      label: returnLabel(cycle.returnsOn, card.comet.show, now, timeZone),
      promise: card.comet.promise,
      // Words can only be offered while the comet is still on its way, and
      // only if there is any way to deliver them.
      capsule:
        card.comet.invite !== false &&
        env.mailReady &&
        env.cometReady &&
        cycle.status === "away",
      ...(opened && card.comet.message ? { message: card.comet.message } : {}),
    };
  }

  const memories = card.memories?.length
    ? sortMemoriesNewestFirst(card.memories).map((memory) => ({
        ...memory,
        image: memory.image
          ? { ...memory.image, url: mediaUrl(card.slug, memory.image.src) }
          : undefined,
      }))
    : undefined;

  // Everything past the closing screen is optional; without any of it the card
  // ends where v0.1 ended.
  const hasOrbit = Boolean(comet || memories?.length || replyAvailable);
  // The crossroads asks "where next?"; with nowhere to go it is skipped.
  const hasCrossroads = Boolean(memories?.length || replyAvailable);

  const { comet: _comet, reply: _reply, access, ...rest } = card;

  return {
    ...rest,
    from,
    timeZone,
    passwordHint: access?.hint,
    memories,
    comet,
    replyAvailable,
    replyPrompt: replyAvailable ? (card.reply?.prompt ?? DEFAULT_REPLY_PROMPT) : undefined,
    today,
    hasOrbit,
    hasCrossroads,
  };
}

/**
 * The quiet line under the landing subtitle (spec v0.2 §7, §21).
 *
 * The comet coming back is the most important thing true of the card that day,
 * so it replaces the writing date rather than sitting beside it. A landing
 * screen with three sub-headings is no longer a landing screen.
 */
export function landingNote(card: ClientCard): string | undefined {
  if (card.comet?.status === "returned") return "彗星が、戻ってきました。";
  if (!card.writtenAt) return undefined;

  const parsed = /^(\d{4})(?:-(\d{2}))?/.exec(card.writtenAt);
  if (!parsed) return undefined;
  const [, year, month] = parsed;
  return month ? `${year}年${Number(month)}月に書かれた手紙` : `${year}年に書かれた手紙`;
}
