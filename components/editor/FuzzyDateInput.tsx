"use client";

import { useEffect, useState } from "react";
import { daysInMonth, formatFuzzyDate, parseFuzzyDate, type Season } from "@/lib/fuzzyDate";

/**
 * A date you only half remember (spec v0.2 §15.4).
 *
 * A normal date picker cannot express "summer 2023", and that is the answer
 * people actually have about their own memories. So the parts are separate and
 * each is optional past the year: a day needs a month, and a season only
 * stands in for a month that is not there.
 *
 * The display string is shown live underneath, because `2023年夏` is what the
 * receiver will read and the person typing should see exactly that rather than
 * a form that happens to produce it.
 *
 * **The parts are held here, as typed.** They used to be derived from the
 * committed value on every render, which meant the field could not be typed
 * into at all: `parseFuzzyDate` rejects `2`, `20` and `202`, so each of the
 * first three keystrokes of a year parsed to null, re-rendered the input as
 * empty, and threw the character away. Only a paste of all four digits at once
 * ever landed. A half-typed date is a normal state for a text field and a
 * meaningless one for the card, so the two are kept apart: the draft is what
 * you see, and only a date that actually parses is sent up.
 */

type Parts = { year: string; month: string; day: string };

/**
 * The draft as a date the card can store, or undefined while it is still
 * being typed. Also what decides whether an incoming `value` is news: if it
 * already matches what the draft composes to, the draft is left alone.
 */
function composeDate(parts: Parts): string | undefined {
  const year = parts.year.replace(/\D/g, "").slice(0, 4);
  if (year.length !== 4) return undefined;

  const month = parts.month.replace(/\D/g, "").slice(0, 2);
  if (!month) return year;
  const mm = month.padStart(2, "0");
  if (Number(mm) < 1 || Number(mm) > 12) return year;

  // A day without a month is not a date anyone can read, so it goes with it.
  const day = parts.day.replace(/\D/g, "").slice(0, 2);
  if (!day) return `${year}-${mm}`;
  const dd = day.padStart(2, "0");
  if (Number(dd) < 1 || Number(dd) > daysInMonth(Number(year), Number(mm))) {
    return `${year}-${mm}`;
  }
  return `${year}-${mm}-${dd}`;
}

function partsOf(value: string | undefined): Parts {
  const parsed = value ? parseFuzzyDate(value) : null;
  return {
    year: parsed?.year ? String(parsed.year) : "",
    month: parsed?.month ? String(parsed.month).padStart(2, "0") : "",
    day: parsed?.day ? String(parsed.day).padStart(2, "0") : "",
  };
}
export function FuzzyDateInput({
  value,
  approx,
  season,
  onChange,
  label = "Date",
}: {
  value: string | undefined;
  approx?: boolean;
  season?: Season;
  onChange: (next: { date?: string; approx?: boolean; season?: Season }) => void;
  label?: string;
}) {
  const [draft, setDraft] = useState<Parts>(() => partsOf(value));
  const { year, month, day } = draft;

  /*
   * Follow the value when it changes from somewhere else — another card
   * selected, a reset — but not when it changed because of what was just
   * typed here, or the draft would be overwritten mid-word.
   */
  useEffect(() => {
    setDraft((current) =>
      (composeDate(current) ?? "") === (value ?? "") ? current : partsOf(value),
    );
  }, [value]);

  function set(next: Partial<Parts>) {
    const parts: Parts = {
      year: (next.year ?? year).replace(/\D/g, "").slice(0, 4),
      month: (next.month ?? month).replace(/\D/g, "").slice(0, 2),
      day: (next.day ?? day).replace(/\D/g, "").slice(0, 2),
    };
    // Clearing the month clears the day with it: a day alone says nothing.
    if (!parts.month) parts.day = "";
    setDraft(parts);

    // A season only means anything when the month is unknown.
    onChange({
      date: composeDate(parts),
      approx,
      season: parts.month ? undefined : season,
    });
  }

  const display = value ? formatFuzzyDate(value, { approx, season }) : "";

  return (
    <div className="fuzzy">
      <span className="fuzzy__label">{label}</span>

      <div className="fuzzy__parts">
        <input
          className="fuzzy__input fuzzy__input--year"
          value={year}
          onChange={(event) => set({ year: event.target.value })}
          placeholder="2023"
          inputMode="numeric"
          aria-label="Year"
        />
        <span className="fuzzy__sep">年</span>
        <input
          className="fuzzy__input"
          value={month}
          onChange={(event) => set({ month: event.target.value })}
          placeholder="—"
          inputMode="numeric"
          aria-label="Month (optional)"
        />
        <span className="fuzzy__sep">月</span>
        <input
          className="fuzzy__input"
          value={day}
          onChange={(event) => set({ day: event.target.value })}
          placeholder="—"
          inputMode="numeric"
          disabled={!month}
          aria-label="Day (optional)"
        />
        <span className="fuzzy__sep">日</span>
      </div>

      <div className="fuzzy__parts">
        {!month ? (
          <select
            className="fuzzy__input fuzzy__input--season"
            value={season ?? ""}
            onChange={(event) =>
              onChange({ date: value, approx, season: (event.target.value || undefined) as Season })
            }
            aria-label="Season (instead of a month)"
          >
            <option value="">no season</option>
            <option value="spring">春 spring</option>
            <option value="summer">夏 summer</option>
            <option value="autumn">秋 autumn</option>
            <option value="winter">冬 winter</option>
          </select>
        ) : null}

        <label className="fuzzy__check">
          <input
            type="checkbox"
            checked={Boolean(approx)}
            onChange={(event) => onChange({ date: value, approx: event.target.checked, season })}
          />
          about (頃)
        </label>
      </div>

      {/* What the receiver will actually read. */}
      <p className="fuzzy__preview" lang="ja">
        {display || "—"}
      </p>
    </div>
  );
}
