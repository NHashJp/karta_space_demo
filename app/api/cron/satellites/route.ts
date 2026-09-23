import { NextResponse } from "next/server";
import { cards } from "@/config/cards.config";
import { notifyTo } from "@/lib/notify";
import { satelliteMail, sendMail } from "@/lib/mail";
import { civilDate, DEFAULT_TIME_ZONE, isSatelliteDay } from "@/lib/orbitClock";
import { resolveNow } from "@/lib/devTime";
import { firstParam } from "@/lib/devJump";

/**
 * The satellite-day reminder (spec v0.2 §12.1, §14.6).
 *
 * Once a day, for every card whose satellite comes back today **in that card's
 * own time zone**, one email to the sender.
 *
 * Note who it goes to. The receiver is never emailed — they gave no address,
 * and asking for one would change what a card is. The whole feature is that
 * the *sender* is reminded, and reaches out personally: the card's promise was
 * "I will be in touch", and this is what keeps it.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // No secret configured means the route is off, not open. An unauthenticated
  // endpoint that sends email is an endpoint that sends email for anyone.
  if (!secret) return unauthorised();
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return unauthorised();

  const url = new URL(request.url);
  const now = resolveNow(firstParam(url.searchParams.get("now") ?? undefined));

  const sent: string[] = [];
  const failed: string[] = [];

  for (const card of cards) {
    if (!card.satellite || !notifyTo(card.slug)) continue;

    const timeZone = card.timeZone ?? DEFAULT_TIME_ZONE;
    if (!isSatelliteDay(card.satellite, now, timeZone)) continue;

    const mail = satelliteMail({
      slug: card.slug,
      title: card.title,
      label: card.satellite.label,
      message: card.satellite.message,
      // The key that makes a second run of the same day harmless.
      today: civilDate(now, timeZone),
    });
    if (!mail) continue;

    const result = await sendMail(mail);
    if (result.ok) sent.push(card.slug);
    else failed.push(card.slug);
  }

  // For the logs, and for the editor's setup checklist to call by hand.
  return NextResponse.json({ checked: cards.length, sent, failed });
}

function unauthorised() {
  return NextResponse.json({ error: "unauthorised" }, { status: 401 });
}
