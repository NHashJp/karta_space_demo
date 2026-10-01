import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/access";
import { checkEditorPassword, editorCookie, editorLocked } from "@/lib/editorAccess";
import { editorEnabled, refused } from "@/lib/editorGuard";

/**
 * Unlocking the editor (spec v0.2 §15.1).
 *
 * The one editor route that does **not** use `editorDenied`, for the obvious
 * reason: it is how you stop being denied. It keeps the production guard, so
 * a deployed build cannot be unlocked at all — there is nothing behind it to
 * unlock.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!editorEnabled) return refused();

  if (!editorLocked()) {
    // No password set: the editor is open, and saying so is not a leak —
    // anyone who can reach this route can already reach the editor itself.
    return NextResponse.json({ ok: true });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`editor:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !checkEditorPassword(password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const cookie = editorCookie();
  if (!cookie) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie);
  return response;
}
