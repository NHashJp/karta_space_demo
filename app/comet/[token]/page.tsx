import type { Metadata } from "next";
import { open } from "@/lib/cometSeal";
import { civilDate, DEFAULT_TIME_ZONE } from "@/lib/orbitClock";
import { getCardBySlug } from "@/lib/cards";
import { resolveNow } from "@/lib/devTime";
import { firstParam } from "@/lib/devJump";
import { CometPage } from "@/components/comet/CometPage";
import { langOf } from "@/lib/i18n";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The sender's view of a comet (spec v0.2 §11.7).
 *
 * Opened from the email. Per-request, never prerendered, for the same reason
 * the card is: the comet's position and whether it can be read at all are both
 * decided by comparing today to a date, and a build-time answer would freeze
 * that at deploy time.
 *
 * There is no access check here, and that is correct: the token *is* the
 * credential. Anyone holding the link is, by construction, someone the
 * receiver sent it to.
 */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { token } = await params;
  const now = resolveNow(firstParam((await searchParams).now));

  // The comet's slug is inside the ciphertext, so the card's own time zone can
  // only be looked up *after* opening it. Until then, the default.
  const provisional = open(token, civilDate(now, DEFAULT_TIME_ZONE));
  const card = provisional.status === "invalid" ? null : getCardBySlug(provisional.slug);
  const timeZone = card?.timeZone ?? DEFAULT_TIME_ZONE;

  const today = civilDate(now, timeZone);
  const comet = timeZone === DEFAULT_TIME_ZONE ? provisional : open(token, today);

  return <CometPage comet={comet} today={today} lang={langOf(card?.lang)} />;
}
