import { daysBetween, civilDate, DEFAULT_TIME_ZONE } from "./orbitClock.ts";
import type { ReturnPrecision } from "@/types/card";

/**
 * How the receiver is told when the comet comes back (spec v0.2 rev 5, §11.3).
 *
 * The point of `show` is that **an exact date is often a lie**. "We'll meet at
 * Christmas" is a real promise; "2026年12月25日" is a commitment neither person
 * has actually made. Coarser precisions let the card say the true thing — 次の冬,
 * 2028年 — without inventing a day.
 *
 * It is presentation, not secrecy, and that is worth being plain about: the
 * exact `returnsOn` is in the page payload regardless, because the comet's
 * position in the sky is computed from it (§14.1). Anyone who opens the
 * network tab can read it. What `show` changes is what the card *says*.
 */

export type ReturnLabel = { label: string; relative: string };

const SEASON_NAME = ["春", "夏", "秋", "冬"] as const;

/**
 * Which season a month belongs to: 春 3–5, 夏 6–8, 秋 9–11, 冬 12–2.
 *
 * A winter belongs to the year of its **December**, so January 2027 is part of
 * winter 2026. Without that, a December return and the January after it would
 * be different winters, and "次の冬" would mean two different things a week
 * apart.
 */
function seasonInstance(year: number, month: number): { index: number; year: number } {
  if (month === 12) return { index: 3, year };
  if (month <= 2) return { index: 3, year: year - 1 };
  return { index: Math.floor((month - 3) / 3), year };
}

/** Ordering key for a season instance, so "which comes first" is arithmetic. */
function seasonOrder(instance: { index: number; year: number }): number {
  return instance.year * 4 + instance.index;
}

export function returnLabel(
  returnsOn: string,
  show: ReturnPrecision = "day",
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): ReturnLabel {
  const today = civilDate(now, timeZone);
  const [year, month, day] = returnsOn.split("-").map(Number);
  const days = daysBetween(today, returnsOn);

  return { label: buildLabel(show, year, month, day, today), relative: relative(show, days) };
}

function buildLabel(
  show: ReturnPrecision,
  year: number,
  month: number,
  day: number,
  today: string,
): string {
  if (show === "year") return `${year}年`;
  if (show === "month") return `${year}年${month}月`;
  if (show === "day") return `${year}年${month}月${day}日`;

  // Season: compare season *instances*, not names, or "次の冬" would be true
  // of every winter there has ever been.
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const here = seasonInstance(todayYear, todayMonth);
  const there = seasonInstance(year, month);
  const name = SEASON_NAME[there.index];

  if (seasonOrder(there) === seasonOrder(here)) return `この${name}`;

  /*
   * 次の = the season immediately after this one, not "the next time this
   * season comes round". §11.3's wording says the latter, but all three of its
   * own examples need the former: in autumn 2026 a return in autumn 2027 is
   * `2027年の秋`, which under "next time this season comes round" would have
   * been `次の秋`. The examples are right and match how the phrase is used —
   * in autumn, 次の冬 is the winter coming up.
   */
  if (seasonOrder(there) === seasonOrder(here) + 1) return `次の${name}`;
  return `${year}年の${name}`;
}

/** 18 months, past which the answer is in years rather than months. */
const MONTHS_LIMIT_DAYS = 548;
const DAYS_PER_MONTH = 30.44;
const DAYS_PER_YEAR = 365.25;

function relative(show: ReturnPrecision, days: number): string {
  if (days === 0) return "今日";
  // Inside the returned window: it came back, and how long ago matters more
  // than how far away it is.
  if (days < 0) return `${-days}日前`;

  // A day-precise promise can afford a day-precise countdown; a season-precise
  // one cannot, so it only ever says "soon".
  if (show === "day" && days <= 100) return `あと${days}日`;
  if (show !== "day" && days <= 30) return "もうすぐ";

  if (days < MONTHS_LIMIT_DAYS) {
    return `約${Math.max(1, Math.round(days / DAYS_PER_MONTH))}か月後`;
  }

  // Rounded to the half year: "約1年半後" is how people say this.
  const halves = Math.round((days / DAYS_PER_YEAR) * 2) / 2;
  return Number.isInteger(halves) ? `約${halves}年後` : `約${Math.floor(halves)}年半後`;
}

/** `{label} · {relative}`, which is how it is always shown. */
export function formatReturn(value: ReturnLabel): string {
  return `${value.label} · ${value.relative}`;
}
