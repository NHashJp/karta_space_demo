import { strings, type Lang } from "./i18n.ts";
import type { FuzzyDate, Memory } from "@/types/card";

/**
 * Dates a person half-remembers. "2023-08-14", "2023-08" and "2023" are all
 * valid, and a memory may be marked approximate or placed in a season instead
 * of a month (spec v0.2 §5).
 *
 * Pure: no Date arithmetic, no time zone, no formatting library. Japanese date
 * order is fixed, so the formatter is string assembly.
 */

export const FUZZY_DATE_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/;

export type Season = NonNullable<Memory["season"]>;

/** Month a season sits at, for sorting only. Northern hemisphere. */
const SEASON_MIDPOINT: Record<Season, number> = {
  spring: 4,
  summer: 7.5,
  autumn: 10,
  winter: 1,
};

const SEASON_INDEX: Record<Season, number> = { spring: 0, summer: 1, autumn: 2, winter: 3 };

export type ParsedFuzzyDate = {
  year: number;
  /** 1-12, or undefined when the date is a bare year. */
  month?: number;
  /** 1-31, or undefined when the date has no day. */
  day?: number;
};

/** Null rather than a throw: callers are validators and formatters. */
export function parseFuzzyDate(value: FuzzyDate): ParsedFuzzyDate | null {
  if (typeof value !== "string" || !FUZZY_DATE_PATTERN.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || year > 9999) return null;
  if (month !== undefined && (month < 1 || month > 12)) return null;
  if (day !== undefined && (day < 1 || day > daysInMonth(year, month!))) return null;

  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "YYYY-MM-DD" exactly — the format satellite and comet dates must use. */
export function isFullDate(value: string | undefined): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return parseFuzzyDate(value) !== null;
}

type FormatOptions = { approx?: boolean; season?: Season; lang?: Lang };

/**
 * The table in spec v0.2 §5, and nothing more — in the card's own language
 * ("2023年4月頃", "around April 2023").
 */
export function formatFuzzyDate(value: FuzzyDate, options: FormatOptions = {}): string {
  const parsed = parseFuzzyDate(value);
  if (!parsed) return "";

  const { dates } = strings(options.lang);
  const { year, month, day } = parsed;
  const approx = (text: string) => (options.approx ? dates.approx(text) : text);

  if (month === undefined) {
    // A season only stands in for a month that is not there.
    if (options.season) return dates.seasonOf(year, dates.seasons[SEASON_INDEX[options.season]]);
    return approx(dates.year(year));
  }
  if (day === undefined) return approx(dates.month(year, month));
  return approx(dates.day(year, month, day));
}

/**
 * Comparable number for ordering. A missing month falls back to its season's
 * midpoint, then to mid-year; a missing day to the 15th — so a fuzzy date sorts
 * among precise ones rather than at the edge of its year.
 */
export function fuzzyDateSortKey(value: FuzzyDate, season?: Season): number {
  const parsed = parseFuzzyDate(value);
  if (!parsed) return Number.NEGATIVE_INFINITY;

  const month = parsed.month ?? (season ? SEASON_MIDPOINT[season] : 6.5);
  const day = parsed.day ?? 15;
  return parsed.year * 10000 + month * 100 + day;
}

/**
 * Newest first, config order breaking ties. Memories are always displayed this
 * way; the order they are written in is not the order they are shown in.
 */
export function sortMemoriesNewestFirst<T extends { date: FuzzyDate; season?: Season }>(
  memories: readonly T[],
): T[] {
  return memories
    .map((memory, index) => ({ memory, index }))
    .sort((a, b) => {
      const delta =
        fuzzyDateSortKey(b.memory.date, b.memory.season) -
        fuzzyDateSortKey(a.memory.date, a.memory.season);
      return delta !== 0 ? delta : a.index - b.index;
    })
    .map((entry) => entry.memory);
}
