/**
 * Dev-only time travel (spec v0.2 §14.1): `?now=2026-12-25` moves the clock so
 * a returned satellite or an arrived comet can be looked at without waiting.
 *
 * It must do nothing in production — a query parameter that changes what a
 * sealed message reveals would be the whole seal, undone. Verify checks that.
 */
export function resolveNow(param: string | string[] | undefined, real = new Date()): Date {
  if (process.env.NODE_ENV === "production") return real;
  const value = Array.isArray(param) ? param[0] : param;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return real;

  // Noon UTC, so the date is the same one in every plausible card time zone.
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? real : parsed;
}
