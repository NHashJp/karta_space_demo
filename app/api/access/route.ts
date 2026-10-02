import { NextResponse } from "next/server";
import { accessCookie, checkPassword, passwordRequired, rateLimit } from "@/lib/access";
import { getCardBySlug } from "@/lib/cards";

export async function POST(request: Request) {
  const { slug, password } = (await request.json().catch(() => ({}))) as {
    slug?: string;
    password?: string;
  };

  if (!slug || !getCardBySlug(slug)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!passwordRequired(slug)) {
    return NextResponse.json({ ok: true });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`${ip}:${slug}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (typeof password !== "string" || !checkPassword(slug, password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const cookie = accessCookie(slug);
  if (!cookie) {
    // A hash-protected card with no ACCESS_SECRET: the password may be right,
    // but there is no key to sign a cookie with, so the card stays shut.
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie);
  return response;
}
