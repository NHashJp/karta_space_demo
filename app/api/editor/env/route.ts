import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { editorDenied } from "@/lib/editorGuard";

/**
 * Generating the three secrets into `.env.local` (spec v0.2 §15.2, §15.7).
 *
 * These are the variables nobody can be expected to produce by hand — 32
 * random bytes, base64 — and getting one wrong fails quietly: a hash-protected
 * card simply never opens, and a comet simply never seals. So the editor
 * makes them.
 *
 * **The value is never returned.** The editor's checklist shows a tick, not a
 * secret. There is no reason for a browser to ever hold one of these, and the
 * habit of passing them around is how they end up in a screenshot.
 */

const GENERATABLE = ["ACCESS_SECRET", "COMET_SECRET", "CRON_SECRET"] as const;
type Generatable = (typeof GENERATABLE)[number];

const ENV_PATH = join(process.cwd(), ".env.local");

export async function POST(request: Request) {
  const denied = await editorDenied();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { generate?: string };
  const name = GENERATABLE.find((key) => key === body.generate) as Generatable | undefined;
  if (!name) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";

  // Appended only if absent. Overwriting a key that is already set would
  // invalidate every cookie and every comet issued under the old one, which is
  // not something a button should do by accident.
  if (new RegExp(`^${name}=.+$`, "m").test(existing)) {
    return NextResponse.json({ ok: true, already: true });
  }

  const value = randomBytes(32).toString("base64");
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  appendFileSync(ENV_PATH, `${prefix}${name}=${value}\n`, "utf8");

  // The dev server reads .env.local at startup, so this needs a restart.
  return NextResponse.json({ ok: true, restartRequired: true });
}

/** Which of the environment's features are configured — never their values. */
export async function GET() {
  const denied = await editorDenied();
  if (denied) return denied;

  const present = (key: string) => Boolean(process.env[key]);
  return NextResponse.json({
    PUBLIC_BASE_URL: present("PUBLIC_BASE_URL"),
    ACCESS_SECRET: present("ACCESS_SECRET"),
    RESEND_API_KEY: present("RESEND_API_KEY"),
    MAIL_FROM: present("MAIL_FROM"),
    NOTIFY_TO: present("NOTIFY_TO"),
    COMET_SECRET: present("COMET_SECRET"),
    CRON_SECRET: present("CRON_SECRET"),
    // Addresses, not secrets — and knowing *which inbox* the test mail is
    // going to is the whole question a tick cannot answer.
    notifyTo: process.env.NOTIFY_TO,
    mailFrom: process.env.MAIL_FROM,
  });
}
