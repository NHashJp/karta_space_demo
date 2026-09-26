/**
 * The handful of glyphs the orbit chrome needs (mockups M12–M14, M5).
 *
 * Inline rather than from a package: there are six of them, they are all one
 * or two paths, and a card that is mostly a 3D scene should not ship an icon
 * font to draw a chevron. They inherit `currentColor` and size from the CSS
 * that places them, so each call site decides how loud it is.
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** The ✕ every sheet and panel closes with. */
export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** `›` — this card leads somewhere. */
export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** `‹` — and this one comes back. */
export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/**
 * The seal. It appears wherever the card says something is written but not
 * readable yet, which is the comet's whole proposition (§11.5).
 */
export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
    </svg>
  );
}

/** Two sheets: the link is going onto the clipboard, not being followed. */
export function CopyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 6.5A2.5 2.5 0 0 0 12.5 4H6.5A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15" />
    </svg>
  );
}

/** The rocket: a reply that arrives now (M14a). */
export function RocketIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3c2.6 2 4 5 4 8.4L12 16l-4-4.6C8 8 9.4 5 12 3Z" />
      <circle cx="12" cy="9.2" r="1.5" />
      <path d="M9.4 16.2 8 21l3.1-1.9M14.6 16.2 16 21l-3.1-1.9" />
    </svg>
  );
}

/** The trail: a way back through what the two of them already have (M14a). */
export function TrailIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 19.5C7 13 11 7.5 19 4.5" />
      <circle cx="19" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12.4" cy="9.4" r="1" fill="currentColor" stroke="none" opacity="0.7" />
      <circle cx="7.8" cy="14.6" r="0.8" fill="currentColor" stroke="none" opacity="0.5" />
    </svg>
  );
}
