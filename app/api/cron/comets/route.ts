import { NextResponse } from "next/server";
import { cards } from "@/config/cards.config";
import { notifyTo } from "@/lib/notify";
import { cometDayMail, sendMail } from "@/lib/mail";
import { strings } from "@/lib/i18n";
import { civilDate, DEFAULT_TIME_ZONE, isCometDay } from "@/lib/orbitClock";
import { resolveNow } from "@/lib/devTime";
import { firstParam } from "@/lib/devJump";

/**
 * The comet-day reminder (spec v0.2 rev 5, §12.1, §14.6).
 *
 * Once a day, for every card whose comet comes back today **in that card's own
 * time zone**, one email to the sender.
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
    if (!card.comet || !notifyTo(card.slug)) continue;

    const timeZone = card.timeZone ?? DEFAULT_TIME_ZONE;
    if (!isCometDay(card.comet, now, timeZone)) continue;

    const mail = cometDayMail({
      slug: card.slug,
      title: card.title,
      // Both are optional in the config; the email needs something to say.
      label: card.comet.label ?? strings(card.lang).mail.fallbackLabel,
      promise: card.comet.promise ?? strings(card.lang).mail.fallbackPromise,
      lang: card.lang,
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
