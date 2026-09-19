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

export type CardConfig = {
  slug: string;
  title: string;
  /** Optional one-line hint shown on the landing screen. */
  subtitle?: string;
  faces: CardFaces;
  /** Shown in the completion state. */
  closing: string;
};
