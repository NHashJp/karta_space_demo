import { NextResponse } from "next/server";
import { canView, rateLimit } from "@/lib/access";
import { getCardBySlug } from "@/lib/cards";
import { mailReady } from "@/lib/notify";
import { replyMail, sendMail } from "@/lib/mail";
import { DEFAULT_TIME_ZONE } from "@/lib/orbitClock";
import { REPLY_MAX, validate, type Body } from "@/lib/submission";

/**
 * The reply rocket (spec v0.2 §14.4).
 *
 * The receiver's words, straight to the sender's inbox, stored nowhere. The
 * route lives under `/c/[slug]/` so the access cookie reaches it: a reply to a
 * password-protected card needs the same key the card does.
 */

export const dynamic = "force-dynamic";

/** Three in ten minutes. Ten password guesses are a person typing; ten replies are not. */
const LIMIT = 3;

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const card = getCardBySlug(slug);

  // Not configured and not permitted look the same from outside: a card with
  // no reply and a card you cannot open are both simply not here.
  if (!card?.reply || !mailReady(slug)) return notFound();
  if (!(await canView(slug))) return notFound();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`reply:${ip}:${slug}`, LIMIT)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const result = validate(body, REPLY_MAX);

  if (!result.ok) {
    // The honeypot was filled: say yes, do nothing. Anything else tells
    // whatever filled it which field gave it away.
    if ("silent" in result) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const mail = replyMail({
    slug,
    title: card.title,
    name: result.value.name,
    message: result.value.message,
    sentAt: new Date(),
    timeZone: card.timeZone ?? DEFAULT_TIME_ZONE,
  });
  if (!mail) return notFound();

  const sent = await sendMail(mail);
  if (!sent.ok) {
    // Never echo the provider's reason. It is not the receiver's problem and
    // it is not something they can act on.
    return NextResponse.json({ error: "send" }, { status: 502 });
  }

  // Only now may the client launch anything. The animation celebrates a
  // delivery that actually happened (§10.2).
  return NextResponse.json({ ok: true });
}

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
