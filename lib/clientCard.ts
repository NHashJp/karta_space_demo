import { civilDate, DEFAULT_TIME_ZONE, satelliteClock } from "./orbitClock.ts";
import { cometWindow } from "./cometOrbit.ts";
import { sortMemoriesNewestFirst } from "./fuzzyDate.ts";
import type { CardConfig, Memory, MemoryImage } from "@/types/card";

/**
 * What the browser is allowed to know about a card (spec v0.2 §14.1).
 *
 * Two things must never cross this boundary, and both are verify checks:
 * `access.passwordHash`, ever; and a sender's comet message before the day it
 * comes back. The seal is the point of a comet — a promise that a message is
 * unreadable until a date is worth nothing if the text is sitting in the page
 * source the whole time.
 */

export type ClientMemory = Memory & { image?: MemoryImage & { url: string } };

export type SenderComet =
  | { status: "away"; releasedOn: string; returnsOn: string }
  | { status: "returned"; releasedOn: string; returnsOn: string; message: string };

export type ClientCard = Omit<CardConfig, "comet" | "reply" | "access"> & {
  from: string;
  /** The hint only. The hash stays on the server. */
  passwordHint?: string;
  senderComet?: SenderComet;
  receiverComet?: { available: boolean; returnsOn: string };
  satelliteStatus?: "waiting" | "returned";
  satelliteNext?: string;
  daysUntil?: number;
  replyAvailable: boolean;
  replyPrompt?: string;
  /**
   * Today's date in the card's own time zone, decided on the server. The
   * browser's clock may be in another zone, or simply wrong, and the comet's
   * position has to agree with the countdown the server computed.
   */
  today: string;
  memories?: ClientMemory[];
  /** True when anything at all exists past the closing screen. */
  hasOrbit: boolean;
};

/** What the environment makes possible, resolved by the caller (never values). */
export type EnvFlags = {
  /** Mail is configured: a reply can actually be delivered to the sender. */
  mailReady: boolean;
  /** COMET_SECRET is set: a receiver's comet can be sealed. */
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

  const clock = card.satellite ? satelliteClock(card.satellite, now, timeZone) : null;

  // The comet's dates default to the satellite's, so a card can carry one
  // without repeating itself.
  const returnsOn = card.comet?.returnsOn ?? clock?.next;
  const releasedOn =
    card.comet?.releasedOn ?? (card.writtenAt ? monthStart(card.writtenAt) : undefined);
  const yearly = card.comet?.yearly ?? card.satellite?.repeat === "yearly";

  let senderComet: SenderComet | undefined;
  if (card.comet?.message && returnsOn && releasedOn) {
    const window = cometWindow({ releasedOn, returnsOn, yearly }, today);
    senderComet =
      window.status === "returned"
        ? { status: "returned", ...dates(window), message: card.comet.message }
        : { status: "away", ...dates(window) };
  }

  const receiverAvailable =
    Boolean(card.comet?.receiverCanRelease) &&
    env.mailReady &&
    env.cometReady &&
    Boolean(returnsOn) &&
    (returnsOn ?? "") > today;

  const replyAvailable = Boolean(card.reply) && env.mailReady;

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
  const hasOrbit = Boolean(
    card.satellite || memories?.length || senderComet || receiverAvailable || replyAvailable,
  );

  const { comet: _comet, reply: _reply, access, ...rest } = card;

  return {
    ...rest,
    from,
    timeZone,
    passwordHint: access?.hint,
    memories,
    senderComet,
    receiverComet: receiverAvailable
      ? { available: true, returnsOn: returnsOn as string }
      : undefined,
    satelliteStatus: clock?.status,
    satelliteNext: clock?.next,
    daysUntil: clock?.daysUntil,
    replyAvailable,
    replyPrompt: replyAvailable ? (card.reply?.prompt ?? DEFAULT_REPLY_PROMPT) : undefined,
    today,
    hasOrbit,
  };
}

/**
 * The quiet line under the landing subtitle (spec v0.2 §7, §21).
 *
 * Three possibilities, in order of what matters most on the day the reader
 * arrives. If the satellite has come back, say that; if the sender's comet
 * has, say that; otherwise say when the letter was written. They replace one
 * another rather than stacking, because a landing screen with three
 * sub-headings is no longer a landing screen.
 */
export function landingNote(card: ClientCard): string | undefined {
  if (card.satelliteStatus === "returned") return "衛星が、戻ってきました。";
  if (card.senderComet?.status === "returned") return "彗星が、戻ってきました。";
  if (!card.writtenAt) return undefined;

  const parsed = /^(\d{4})(?:-(\d{2}))?/.exec(card.writtenAt);
  if (!parsed) return undefined;
  const [, year, month] = parsed;
  return month
    ? `${year}年${Number(month)}月に書かれた手紙`
    : `${year}年に書かれた手紙`;
}

function dates(window: { releasedOn: string; returnsOn: string }) {
  return { releasedOn: window.releasedOn, returnsOn: window.returnsOn };
}

/** "2026-03" or "2026-03-14" -> "2026-03-01": when the letter's month began. */
function monthStart(writtenAt: string): string | undefined {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(writtenAt);
  if (!match) return undefined;
  return `${match[1]}-${match[2] ?? "01"}-01`;
}
