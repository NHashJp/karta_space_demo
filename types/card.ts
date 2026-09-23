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

export type Satellite = {
  /** <= 16 characters, e.g. "次のクリスマス". */
  label: string;
  /** <= 60 characters. */
  message: string;
  /** "YYYY-MM-DD", in the card's timeZone. */
  date: string;
  repeat?: "none" | "yearly";
};

export type Comet = {
  /** "YYYY-MM-DD" the comets come back. Defaults to the satellite's next date. */
  returnsOn?: string;
  /** After the first return, come back every year. Default: satellite.repeat === "yearly". */
  yearly?: boolean;
  /** The sender's own comet: its message, <= 250 characters. */
  message?: string;
  /** "YYYY-MM-DD" the sender's comet set off. */
  releasedOn?: string;
  /** Let the receiver release a comet back to the sender. */
  receiverCanRelease?: boolean;
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
  /** 1-12, shown newest first however they are ordered here. */
  memories?: Memory[];
  satellite?: Satellite;
  comet?: Comet;
  /** Presence enables the reply rocket, if email is configured. */
  reply?: ReplyConfig;
  /** Share password issued by the editor. */
  access?: CardAccess;
};
