"use client";

import { FuzzyDateInput } from "../FuzzyDateInput";
import { TIME_ZONES, type SectionProps } from "../shared";
import { FROM_MAX } from "@/lib/cardRules";
import { strings } from "@/lib/i18n";

/** Who the card is from, when it was written, and where its clock is (§15.4). */
export function BasicsSection({ card, edit }: SectionProps) {
  const lang = card.lang ?? "ja";
  const defaults = strings(lang).defaults;
  return (
    <div className="editor__section">
      {/*
        The card's language. Everything around the letter — buttons, sheets,
        dates, the countdown, the emails to you — follows it, so pick the one
        the letter itself is written in.
      */}
      <label className="field">
        <span>Language</span>
        <select
          value={lang}
          onChange={(event) =>
            edit({ lang: event.target.value === "en" ? "en" : undefined })
          }
        >
          <option value="ja">日本語 (Japanese)</option>
          <option value="en">English</option>
        </select>
        <span className="editor__hint">
          The card&rsquo;s buttons, dates and countdown — and the emails you
          receive — are shown in this language.
        </span>
      </label>

      <label className="field">
        <span>Title</span>
        <input
          value={card.title}
          onChange={(event) => edit({ title: event.target.value })}
          lang={lang}
        />
      </label>

      <label className="field">
        <span>Subtitle</span>
        <input
          value={card.subtitle ?? ""}
          onChange={(event) => edit({ subtitle: event.target.value || undefined })}
          lang={lang}
        />
      </label>

      <div className="editor__row">
        <label className="field">
          <span>
            How you sign off &middot; {card.from?.length ?? 0}/{FROM_MAX}
          </span>
          <input
            value={card.from ?? ""}
            onChange={(event) => edit({ from: event.target.value || undefined })}
            placeholder={defaults.from}
            lang={lang}
          />
          {/* It is not decoration: it appears in the satellite's promise. */}
          <span className="editor__hint">
            Used in sentences such as “{strings(lang).reply.note(card.from || defaults.from, Boolean(card.comet))}”
          </span>
        </label>

        <label className="field">
          <span>Time zone</span>
          <select
            value={card.timeZone ?? "Asia/Tokyo"}
            onChange={(event) => edit({ timeZone: event.target.value })}
          >
            {TIME_ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          {/*
            This decides when "the day" is. A card whose satellite returns on
            the 25th returns on the 25th *here*, not wherever it is served.
          */}
          <span className="editor__hint">
            Every date on this card — the satellite, the comets, the reminder —
            is compared in this zone.
          </span>
        </label>
      </div>

      <div className="editor__row">
        <div className="field">
          <FuzzyDateInput
            label="Written"
            value={card.writtenAt}
            onChange={(next) => edit({ writtenAt: next.date })}
          />
          <span className="editor__hint">
            Shown on the landing screen, and used as the sender&rsquo;s comet
            departure date if you don&rsquo;t set one.
          </span>
        </div>

        <label className="field">
          <span>Sound</span>
          <label className="editor__toggle">
            <input
              type="checkbox"
              checked={card.sound !== false}
              onChange={(event) => edit({ sound: event.target.checked ? undefined : false })}
            />
            Play the ambient sound and cues
          </label>
          <span className="editor__hint">
            On by default, and the reader can always turn it off. Unticking this
            removes the toggle and the engine entirely for this card.
          </span>
        </label>
      </div>
    </div>
  );
}
