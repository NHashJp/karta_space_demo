import { NextResponse } from "next/server";
import { editorEnabled, refused, safeSlug } from "@/lib/editorGuard";
import { getCardBySlug } from "@/lib/cards";
import { cardVersion } from "@/lib/cardVersion";

/**
 * Is this card actually live, and is it the version I just saved?
 * (spec v0.2 §15.6.)
 *
 * The one step of publishing the editor cannot do — it does not deploy — is
 * also the step most likely to be forgotten, and the failure is silent: you
 * send someone a link and it 404s. So the editor at least *checks*, by
 * fetching the deployed URL the way a receiver would.
 *
 * Without a cookie, deliberately. A password-protected card answers 200 with
 * the gate, and the `karta-version` meta tag is rendered on the gate too
 * precisely so this check works without anyone's password.
 */
export async function GET(request: Request) {
  if (!editorEnabled) return refused();

  const slug = safeSlug(new URL(request.url).searchParams.get("slug"));
  if (!slug) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (!base) return NextResponse.json({ status: "unreachable", reason: "no_base_url" });

  const card = getCardBySlug(slug);
  const expected = card ? cardVersion(card) : null;

  try {
    const response = await fetch(`${base}/c/${slug}`, {
      redirect: "manual",
      cache: "no-store",
      headers: { "User-Agent": "karta-space-editor" },
    });

    if (response.status === 404) return NextResponse.json({ status: "missing" });
    if (!response.ok) {
      return NextResponse.json({ status: "unreachable", reason: String(response.status) });
    }

    const html = await response.text();
    const version = /name="karta-version" content="([^"]+)"/.exec(html)?.[1] ?? null;

    if (!expected || !version) return NextResponse.json({ status: "live", version });
    return NextResponse.json({
      status: version === expected ? "live" : "stale",
      version,
      expected,
    });
  } catch (cause) {
    // A wrong base URL, a DNS failure and a deployment that is still building
    // all land here, and the editor says the same thing for all three: it
    // could not reach the address you gave it.
    return NextResponse.json({ status: "unreachable", reason: String(cause) });
  }
}
