export type TextFace = {
  type: "text";
  body: string;
  /**
   * "paragraph" (default): 80-250 characters, as v0.1.
   * "line": one short sentence (1-30 characters) set large and centred — a
   * beat, not a paragraph (spec v0.2 §5).
   */
  style?: "paragraph" | "line";
};

export type ImageFace = {
  type: "image";
  src: string;
  alt: string;
  /** How the image fills its cube face. Defaults to "cover". */
  fit?: "cover" | "contain";
};

export type CardFace = TextFace | ImageFace;

/** Exactly six faces, in fixed display order. */
export type CardFaces = [CardFace, CardFace, CardFace, CardFace, CardFace, CardFace];

/** "2023" | "2023-08" | "2023-08-14". Month or day may be unknown. */
export type FuzzyDate = string;

export type MemoryImage = {
  /** A file in private/cards/<slug>/, served through the media route. */
  src: string;
  alt: string;
  fit?: "cover" | "contain";
};

export type Memory = {
  /** <= 24 characters. */
  title: string;
  date: FuzzyDate;
  /** Shows 頃 after the date: "2023年8月頃". */
  approx?: boolean;
  /** Used when the month is unknown: "2023年夏". Ignored if the month is set. */
  season?: "spring" | "summer" | "autumn" | "winter";
  image?: MemoryImage;
  /** <= 80 characters, shown under the image. */
  caption?: string;
};

/** How precisely the receiver is told when the comet comes back (R17). */
export type ReturnPrecision = "day" | "month" | "season" | "year";

/**
 * The promise comet (R14). One per card.
 *
 * Revision 5 merged the old `satellite` and `comet` into this. They were two
 * objects saying one thing — *we will meet again on this day* — and splitting
 * that across a panel with a countdown and a separate sealed message made the
 * card explain itself twice. Now the promise and the words that come with it
 * ride the same object, and its position in the sky is the countdown.
 */
export type PromiseComet = {
  /** "YYYY-MM-DD" in the card's timeZone: the day it comes back, the day you mean to meet. */
  returnsOn: string;
  /** "YYYY-MM-DD": the day you parted. The comet passed the planet then. */
  leftOn: string;
  /**
   * How the return is shown. Default "day". Coarser values never print the
   * exact date in the card — "次の冬" is a truer promise than a date nobody
   * has actually agreed yet.
   */
  show?: ReturnPrecision;
  /** The promise, one line, <= 40 characters, e.g. "次のクリスマスに、また会おう。" */
  promise?: string;
  /** A short name for the day, <= 16 characters. Used in the reminder email. */
  label?: string;
  /** After it comes back, leave again and return every year on the same day. */
  yearly?: boolean;
  /** The sender's sealed words, <= 250 characters, unreadable until returnsOn. */
  message?: string;
  /**
   * Ask the receiver to put their own words on the comet (the nudge). Default
   * true; offered only when email and COMET_SECRET are configured.
   */
  invite?: boolean;
};

export type ReplyConfig = {
  /** Prompt above the reply field. Default: "ひとこと、返事をどうぞ。" */
  prompt?: string;
};

export type CardAccess = {
  /**
   * Written by the editor: "scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>".
   * The password itself is never stored in the config file, and the hash is
   * never sent to a browser.
   */
  passwordHash?: string;
  /** Shown on the password gate, <= 40 characters. */
  hint?: string;
};

export type SocialPlatform = "instagram" | "github" | "linkedin";

export type SocialLink = {
  platform: SocialPlatform;
  /** Leave empty to hide this link on the closing screen. */
  href: string;
  /** Accessible name, e.g. "Instagram (@handle)". */
  label: string;
};

export type CardConfig = {
  slug: string;
  title: string;
  /** Optional one-line hint shown on the landing screen. */
  subtitle?: string;
  faces: CardFaces;
  /** Shown in the completion state. */
  closing: string;
  /**
   * Optional. One short line hidden *inside* the cube, reachable from the
   * closing screen. It has to be read from 1.5 world units away with walls on
   * every side, so it must stay short — see `SECRET_MAX` in `lib/cardRules.ts`.
   */
  secret?: string;
  /** Optional links shown under the replay button on the closing screen. */
  social?: SocialLink[];

  /* ---------- v0.2. Every one of these is optional, and a card without any
     of them behaves exactly as it did in v0.1 (spec v0.2 §0.3). ---------- */

  /** How the sender signs off, e.g. "みお". Defaults to "送り主". */
  from?: string;
  /** Landing line: "2026年3月に書かれた手紙". */
  writtenAt?: FuzzyDate;
  /** IANA zone, default "Asia/Tokyo". Every date comparison uses it. */
  timeZone?: string;
  /** Path to an SVG of the sender's handwriting. */
  signature?: string;
  /** Default true; false removes sound entirely for this card. */
  sound?: boolean;
  /** 1-20 (`MEMORY_MAX`), shown newest first however they are ordered here. */
  memories?: Memory[];
  /** Replaces the revision-4 `satellite` and `comet` fields (§5.1). */
  comet?: PromiseComet;
  /** Presence enables the reply rocket, if email is configured. */
  reply?: ReplyConfig;
  /** Share password issued by the editor. */
  access?: CardAccess;
};
