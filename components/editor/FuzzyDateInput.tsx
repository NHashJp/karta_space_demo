"use client";

import { formatFuzzyDate, parseFuzzyDate, type Season } from "@/lib/fuzzyDate";

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
 */
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
  const parsed = value ? parseFuzzyDate(value) : null;
  const year = parsed?.year ? String(parsed.year) : "";
  const month = parsed?.month ? String(parsed.month).padStart(2, "0") : "";
  const day = parsed?.day ? String(parsed.day).padStart(2, "0") : "";

  function set(next: { year?: string; month?: string; day?: string }) {
    const y = (next.year ?? year).replace(/\D/g, "").slice(0, 4);
    if (!y) return onChange({ date: undefined, approx, season });

    const m = (next.month ?? month).replace(/\D/g, "").slice(0, 2);
    // A day without a month is not a date anyone can read, so it goes with it.
    const d = m ? (next.day ?? day).replace(/\D/g, "").slice(0, 2) : "";

    const date = [y, m.padStart(2, "0"), d.padStart(2, "0")]
      .slice(0, d ? 3 : m ? 2 : 1)
      .join("-");

    // A season only means anything when the month is unknown.
    onChange({ date, approx, season: m ? undefined : season });
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
