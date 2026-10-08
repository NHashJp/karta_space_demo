import { NextResponse } from "next/server";
import { canView, rateLimit } from "@/lib/access";
import { getCardBySlug } from "@/lib/cards";
import { cometReady, mailReady } from "@/lib/notify";
import { cometMail, sendMail } from "@/lib/mail";
import { seal } from "@/lib/cometSeal";
import { civilDate, DEFAULT_TIME_ZONE } from "@/lib/orbitClock";
import { cometCycle } from "@/lib/cometOrbit";
import { COMET_MAX, validate, type Body } from "@/lib/submission";

/**
 * Putting the receiver's words on the comet (spec v0.2 rev 5, §14.5).
 *
 * Revision 5 does not send a *second* comet back. There is one comet carrying
 * one promise, and the receiver's words ride along with the sender's — which
 * is the whole point of the object. The words are encrypted into a token and
 * emailed as a link; nothing is stored here.
 */

export const dynamic = "force-dynamic";

const LIMIT = 3;

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const card = getCardBySlug(slug);

  if (!card?.comet || card.comet.invite === false) return notFound();
  if (!mailReady(slug) || !cometReady()) return notFound();
  if (!(await canView(slug))) return notFound();

  const timeZone = card.timeZone ?? DEFAULT_TIME_ZONE;
  const now = new Date();
  const today = civilDate(now, timeZone);

  // The cycle is the card's, not the client's: dates that came from the
  // browser would be dates the receiver could choose.
  const cycle = cometCycle(card.comet, today);
  // Words can only board a comet that is still on its way.
  if (cycle.status !== "away") return notFound();

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
    v: 2,
    slug,
    name: result.value.name,
    body: result.value.message,
    leftOn: cycle.leftOn,
    returnsOn: cycle.returnsOn,
    boardedOn: today,
  });
  if (!token) return notFound();

  const mail = cometMail({
    slug,
    title: card.title,
    name: result.value.name,
    returnsOn: cycle.returnsOn,
    token,
    lang: card.lang,
  });
  if (!mail) return notFound();

  const sent = await sendMail(mail);
  if (!sent.ok) return NextResponse.json({ error: "send" }, { status: 502 });

  /*
   * The token goes back to the browser as well as into the email, for the one
   * thing the sheet offers afterwards: a "copy the link" button, so the
   * receiver can keep a copy of their own if they want one. It is deliberately
   * **not** written to localStorage on their behalf (§11.5) — the words are
   * theirs to keep or not, and quietly storing them is not our decision.
   */
  return NextResponse.json({
    ok: true,
    token,
    returnsOn: cycle.returnsOn,
    boardedOn: today,
  });
}

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
