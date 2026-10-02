import type { CardConfig, CardFace, CardFaces, SocialPlatform } from "@/types/card";

/**
 * What every editor section is handed (spec v0.2 §15.4).
 *
 * One card, one way to change it, and the environment's answer about what is
 * possible. Sections never fetch and never own card state: the shell holds it,
 * so "unsaved changes" is one flag rather than seven.
 */
export type SectionProps = {
  card: CardConfig;
  edit: (patch: Partial<CardConfig>) => void;
  env: EnvFlags;
};

/**
 * Which features the environment allows (§15.2).
 *
 * Secrets are booleans and nothing else: there is no reason for a browser to
 * hold one, and passing them around is how they end up in a screenshot.
 *
 * The two mail *addresses* are the exception, and deliberately so. They are
 * not secrets — one of them is printed on every email that leaves — and a tick
 * beside `NOTIFY_TO` answers the wrong question. What the sender needs to know
 * before they test anything is **which inbox this is going to**, and a tick
 * cannot tell them they are still pointed at an address they stopped using.
 */
export type EnvFlags = {
  PUBLIC_BASE_URL: boolean;
  ACCESS_SECRET: boolean;
  RESEND_API_KEY: boolean;
  MAIL_FROM: boolean;
  NOTIFY_TO: boolean;
  COMET_SECRET: boolean;
  CRON_SECRET: boolean;
  /** Where replies and comets arrive, shown so it can be checked. */
  notifyTo?: string;
  /** Who they arrive from. */
  mailFrom?: string;
};

export const EMPTY_ENV: EnvFlags = {
  PUBLIC_BASE_URL: false,
  ACCESS_SECRET: false,
  RESEND_API_KEY: false,
  MAIL_FROM: false,
  NOTIFY_TO: false,
  COMET_SECRET: false,
  CRON_SECRET: false,
};

/** Email needs all three together, so it is one idea rather than three. */
export function mailConfigured(env: EnvFlags): boolean {
  return env.RESEND_API_KEY && env.MAIL_FROM && env.NOTIFY_TO;
}

export const SECTIONS = [
  "Basics",
  "Faces",
  "Closing",
  "Memories",
  "Orbit",
  "Links",
  "Share",
] as const;

export type Section = (typeof SECTIONS)[number];

export const PLATFORMS: SocialPlatform[] = ["instagram", "github", "linkedin"];
export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  github: "GitHub",
  linkedin: "LinkedIn",
};

/**
 * The arc a six-face letter tends to want. Shown as a hint, never enforced —
 * it is a suggestion from someone who has written one before, not a template.
 */
export const FACE_ARC = [
  "挨拶",
  "思い出",
  "感謝",
  "言えなかったこと",
  "願い",
  "ひとこと",
];

export const emptyTextFace = (): CardFace => ({ type: "text", body: "" });

export function newCard(existing: CardConfig[]): CardConfig {
  let slug = "new-card";
  for (let n = 2; existing.some((card) => card.slug === slug); n++) slug = `new-card-${n}`;
  return {
    slug,
    title: "",
    subtitle: "",
    closing: "",
    social: [],
    faces: Array.from({ length: 6 }, emptyTextFace) as unknown as CardFaces,
  };
}

/**
 * A handful of zones, rather than the full IANA list. A card is written by one
 * person for another, and a search box over 400 entries would be a worse
 * experience than six options and the ability to type one.
 */
export const TIME_ZONES = [
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];
