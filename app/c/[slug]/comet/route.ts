import { NextResponse } from "next/server";
import { canView, rateLimit } from "@/lib/access";
import { getCardBySlug } from "@/lib/cards";
import { cometReady, mailReady } from "@/lib/notify";
import { cometMail, sendMail } from "@/lib/mail";
import { seal } from "@/lib/cometSeal";
import { civilDate, DEFAULT_TIME_ZONE, satelliteClock } from "@/lib/orbitClock";
import { COMET_MAX, validate, type Body } from "@/lib/submission";

/**
 * Releasing a comet back to the sender (spec v0.2 §14.5).
 *
 * The message is encrypted into a token and emailed as a link. Nothing is
 * stored here — not the message, not the token, not the fact that a comet was
 * released. The link in that one email is the comet.
 */

export const dynamic = "force-dynamic";

const LIMIT = 3;

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const card = getCardBySlug(slug);

  if (!card?.comet?.receiverCanRelease || !mailReady(slug) || !cometReady()) return notFound();
  if (!(await canView(slug))) return notFound();

  const timeZone = card.timeZone ?? DEFAULT_TIME_ZONE;
  const now = new Date();
  const today = civilDate(now, timeZone);

  // The comet's return date is the card's, not the client's: a date that came
  // from the browser would be a date the receiver could choose.
  const returnsOn =
    card.comet.returnsOn ??
    (card.satellite ? satelliteClock(card.satellite, now, timeZone)?.next : undefined);
  if (!returnsOn || returnsOn <= today) return notFound();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`comet:${ip}:${slug}`, LIMIT)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const result = validate(body, COMET_MAX);

  if (!result.ok) {
    if ("silent" in result) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const token = seal({
    v: 1,
    slug,
    name: result.value.name,
    body: result.value.message,
    releasedOn: today,
    returnsOn,
  });
  if (!token) return notFound();

  const mail = cometMail({
    slug,
    title: card.title,
    name: result.value.name,
    returnsOn,
    token,
  });
  if (!mail) return notFound();

  const sent = await sendMail(mail);
  if (!sent.ok) return NextResponse.json({ error: "send" }, { status: 502 });

  /*
   * The token goes back to the browser as well as into the email, for the one
   * thing §11.3 offers afterwards: a "copy the link" button, so the receiver
   * can keep a copy of their own if they want one. It is deliberately **not**
   * written to localStorage on their behalf (§11.6) — the message is theirs to
   * keep or not, and quietly storing it on their device is not our decision.
   */
  return NextResponse.json({ ok: true, token, returnsOn, releasedOn: today });
}

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
