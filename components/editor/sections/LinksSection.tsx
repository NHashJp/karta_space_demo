"use client";

import { PLATFORMS, PLATFORM_LABELS, type SectionProps } from "../shared";
import type { SocialPlatform } from "@/types/card";

/**
 * Where to find you afterwards (spec v0.2 §15.4).
 *
 * On a card with an orbit these move off the closing screen and into the orbit
 * view (§8.1), so they never compete with the drawn line for the last moment
 * of the letter.
 */
export function LinksSection({ card, edit }: SectionProps) {
  function set(platform: SocialPlatform, href: string) {
    const others = (card.social ?? []).filter((link) => link.platform !== platform);
    const social = href.trim()
      ? [...others, { platform, href: href.trim(), label: PLATFORM_LABELS[platform] }]
      : others;
    social.sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform));
    edit({ social });
  }

  return (
    <div className="editor__section">
      {PLATFORMS.map((platform) => {
        const href = card.social?.find((link) => link.platform === platform)?.href ?? "";
        return (
          <label className="field" key={platform}>
            <span>{PLATFORM_LABELS[platform]}</span>
            <input
              value={href}
              onChange={(event) => set(platform, event.target.value)}
              placeholder={`https://…`}
              spellCheck={false}
            />
            {href.includes("your-handle") ? (
              <span className="editor__hint" data-warn="true">
                Still the placeholder — this will show as a dead link.
              </span>
            ) : null}
          </label>
        );
      })}

      <p className="editor__hint">
        Leave one empty to hide it. With an orbit these appear in the orbit
        view; without one, on the closing screen.
      </p>
    </div>
  );
}
