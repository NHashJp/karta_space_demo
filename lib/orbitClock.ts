import { daysInMonth, isFullDate, parseFuzzyDate } from "./fuzzyDate.ts";
import type { Satellite } from "@/types/card";

/**
 * Every date comparison in v0.2 happens in the card's own time zone, not the
 * server's and not the reader's: a satellite due on 12月25日 must turn on at
 * midnight in Tokyo wherever the request is served from (spec v0.2 §8.4).
 *
 * The approach throughout is to reduce an instant to a *civil date* —
 * "YYYY-MM-DD" as seen in that zone — and then do plain calendar arithmetic on
 * it. That sidesteps offsets and DST entirely.
 */

export const DEFAULT_TIME_ZONE = "Asia/Tokyo";

/** How long a satellite stays "returned" after each yearly anniversary. */
export const RETURN_WINDOW_DAYS = 14;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The civil date in `timeZone` at this instant, as "YYYY-MM-DD". */
export function civilDate(now: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Civil dates compare correctly as strings, but say so out loud. */
function toUtcMidnight(date: string): number {
  const parsed = parseFuzzyDate(date);
  if (!parsed) return Number.NaN;
  return Date.UTC(parsed.year, (parsed.month ?? 1) - 1, parsed.day ?? 1);
}

/** Whole days from `from` to `to`, both civil dates. Negative if `to` is past. */
export function daysBetween(from: string, to: string): number {
  const delta = toUtcMidnight(to) - toUtcMidnight(from);
  return Math.round(delta / 86_400_000);
}

/**
 * The anniversary of `date` in `year`.
 *
 * 29 February has no anniversary in three years out of four; it is observed on
 * the 28th rather than slipping into March, so the day never lands in the wrong
 * month. This is a choice, not a standard — recorded here because verify checks
 * it and someone will wonder.
 */
function anniversaryIn(year: number, month: number, day: number): string {
  const clamped = Math.min(day, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

/**
 * The occurrence a reader is currently living with: the next one in the future,
 * or the most recent one while it is still inside the return window.
 */
export function nextOccurrence(date: string, today: string, yearly: boolean): string {
  if (!yearly) return date;

  const parsed = parseFuzzyDate(date);
  const now = parseFuzzyDate(today);
  if (!parsed || !now || parsed.month === undefined || parsed.day === undefined) return date;

  // Never earlier than the original date: a yearly satellite does not have
  // anniversaries before it was set.
  for (let year = Math.max(parsed.year, now.year - 1); year <= now.year + 1; year++) {
    const candidate = anniversaryIn(year, parsed.month, parsed.day);
    if (candidate < date) continue;
    const age = daysBetween(candidate, today);
    if (age < 0) return candidate; // still ahead
    if (age <= RETURN_WINDOW_DAYS) return candidate; // here, and still glowing
  }
  return anniversaryIn(now.year + 1, parsed.month, parsed.day);
}

export type SatelliteClock = {
  /** The occurrence being counted down to, or the one that just arrived. */
  next: string;
  status: "waiting" | "returned";
  /** Days from today to `next`. Zero on the day, negative inside the window. */
  daysUntil: number;
};

export function satelliteClock(
  satellite: Satellite,
  now: Date,
  timeZone = DEFAULT_TIME_ZONE,
): SatelliteClock | null {
  if (!isFullDate(satellite.date)) return null;

  const today = civilDate(now, timeZone);
  const yearly = satellite.repeat === "yearly";
  const next = nextOccurrence(satellite.date, today, yearly);
  const daysUntil = daysBetween(today, next);

  // A one-off satellite stays returned forever once its day has passed; a
  // yearly one returns for the window and then starts counting down again.
  const arrived = daysUntil <= 0;
  const withinWindow = !yearly || -daysUntil <= RETURN_WINDOW_DAYS;

  return { next, status: arrived && withinWindow ? "returned" : "waiting", daysUntil };
}

/** Exactly the day itself, in the card's zone — what the reminder job asks. */
export function isSatelliteDay(
  satellite: Satellite,
  now: Date,
  timeZone = DEFAULT_TIME_ZONE,
): boolean {
  if (!isFullDate(satellite.date)) return false;
  const today = civilDate(now, timeZone);
  const yearly = satellite.repeat === "yearly";
  return nextOccurrence(satellite.date, today, yearly) === today;
}
