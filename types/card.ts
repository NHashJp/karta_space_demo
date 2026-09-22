export type TextFace = {
  type: "text";
  body: string;
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
};
