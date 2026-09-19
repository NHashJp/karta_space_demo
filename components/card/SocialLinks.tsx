"use client";

import type { SocialLink, SocialPlatform } from "@/types/card";

/** Inline paths, so the closing screen needs no icon dependency. */
const ICONS: Record<SocialPlatform, React.ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  github: (
    <path d="M9 19c-4.3 1.4-4.3-2.2-6-2.6m12 4.6v-3.6a3.2 3.2 0 0 0-.9-2.5c2.9-.3 6-1.4 6-6.5a5 5 0 0 0-1.4-3.5 4.7 4.7 0 0 0-.1-3.5s-1.1-.3-3.6 1.4a12.3 12.3 0 0 0-6.4 0C6.1 1.1 5 1.4 5 1.4a4.7 4.7 0 0 0-.1 3.5A5 5 0 0 0 3.5 8.4c0 5.1 3.1 6.2 6 6.5a3.2 3.2 0 0 0-.9 2.5V21" />
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="7.6" y1="10.4" x2="7.6" y2="17" />
      <circle cx="7.6" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <path d="M11.4 17v-3.6a2.3 2.3 0 0 1 4.6 0V17" />
      <line x1="11.4" y1="10.4" x2="11.4" y2="17" />
    </>
  ),
};

export function SocialLinks({ links }: { links: SocialLink[] }) {
  const shown = links.filter((link) => link.href.trim().length > 0);
  if (shown.length === 0) return null;

  return (
    <nav className="social" aria-label="Links">
      {shown.map((link) => (
        <a
          key={link.platform}
          className="social__link"
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          title={link.label}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[link.platform]}
          </svg>
        </a>
      ))}
    </nav>
  );
}
