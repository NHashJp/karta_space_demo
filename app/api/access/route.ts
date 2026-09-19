import { NextResponse } from "next/server";
import { accessCookie, checkPassword, passwordRequired, rateLimit } from "@/lib/access";
import { getCardBySlug } from "@/lib/card";

export async function POST(request: Request) {
  const { slug, password } = (await request.json().catch(() => ({}))) as {
    slug?: string;
    password?: string;
  };

  if (!slug || !getCardBySlug(slug)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!passwordRequired()) {
    return NextResponse.json({ ok: true });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`${ip}:${slug}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (typeof password !== "string" || !checkPassword(password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(accessCookie(slug));
  return response;
}
