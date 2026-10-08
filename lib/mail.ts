import { MAIL_SINK_DIR, mailSink, notifyTo } from "./notify.ts";
import { DEFAULT_TIME_ZONE } from "./orbitClock.ts";
import { formatFuzzyDate } from "./fuzzyDate.ts";
import { strings, type Lang } from "./i18n.ts";

/**
 * Everything the receiver writes goes to the sender, by email (spec v0.2
 * §14.8, R2). KARTA_SPACE stores none of it.
 *
 * That is a real constraint and worth stating plainly: there is no database, so
 * a reply exists in exactly one place — the sender's inbox — and a comet exists
 * in exactly one place, the link in that email. If the sender deletes the
 * email, the comet is gone. The templates say so, in the email itself, because
 * the only honest place to warn someone about that is where they will see it.
 *
 * Resend's HTTP API directly rather than its SDK: this is one POST with a JSON
 * body, and a dependency for that would be a dependency to keep updated.
 */

const ENDPOINT = "https://api.resend.com/emails";

export type Mail = {
  to: string;
  subject: string;
  text: string;
  /**
   * Resend de-duplicates on this. The cron route builds one from the slug and
   * the date, so a scheduler that fires twice in a day still sends once.
   */
  idempotencyKey?: string;
};

export type SendResult = { ok: true } | { ok: false; reason: "unconfigured" | "failed" };

export async function sendMail(mail: Mail): Promise<SendResult> {
  // Development only, and only when asked for: write it down instead.
  if (mailSink()) return writeToSink(mail);

  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return { ok: false, reason: "unconfigured" };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(mail.idempotencyKey ? { "Idempotency-Key": mail.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      }),
    });

    if (response.ok) return { ok: true };

    /*
     * The reason never reaches the receiver — a failure to deliver is the
     * sender's problem, and an error from an email provider is not something
     * the person writing a reply can do anything about.
     *
     * It does reach the **operator**, though, and for a long time it did not:
     * every failure came back as a bare 502 with the provider's explanation
     * thrown on the floor, so the one person who could fix it had nothing to
     * go on. Almost every real failure here is one of three things, and the
     * provider names which in its body: an unverified `MAIL_FROM` domain, an
     * account still in test mode (which will only deliver to the address that
     * owns it), or a key that is wrong or revoked.
     */
    const detail = await response.text().catch(() => "");
    report(`${response.status} ${response.statusText} ${detail}`.trim());
    return { ok: false, reason: "failed" };
  } catch (error) {
    // No network at all, DNS, TLS: the request never reached the provider.
    report(error instanceof Error ? error.message : String(error));
    return { ok: false, reason: "failed" };
  }
}

/**
 * Server-side only, and never the key.
 *
 * Deliberately `console.error` rather than anything cleverer: the operator is
 * looking at the terminal running the server when a send fails, and that is
 * where this has to appear.
 */
function report(detail: string) {
  console.error(`[karta-space] mail send failed: ${detail}`);
}

/** `PUBLIC_BASE_URL`, without a trailing slash. */
/**
 * The sink's postbox: one plain-text file per message, in `.mail/`, named so
 * they sort in the order they were sent.
 *
 * Deliberately the same text that would have gone over the wire, headers and
 * all, because half the point of sending a test message is reading what the
 * other person will actually get — the line breaks, the link, the warning
 * about not deleting the email.
 *
 * `node:fs` is imported here rather than at the top of the file so that it is
 * only ever loaded when the sink actually fires.
 */
async function writeToSink(mail: Mail): Promise<SendResult> {
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const dir = join(process.cwd(), MAIL_SINK_DIR);
    await mkdir(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = mail.subject.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 48);
    const path = join(dir, `${stamp}-${slug}.txt`);

    await writeFile(
      path,
      [
        `To: ${mail.to}`,
        `Subject: ${mail.subject}`,
        ...(mail.idempotencyKey ? [`Idempotency-Key: ${mail.idempotencyKey}`] : []),
        "",
        mail.text,
        "",
      ].join("\n"),
      "utf8",
    );

    // The path, in the terminal running `next dev`: without this the message
    // is delivered to a folder nobody thought to look in.
    console.info(`[mail sink] ${path}`);
    return { ok: true };
  } catch {
    // A sink that cannot write is a failed send, and should look like one.
    return { ok: false, reason: "failed" };
  }
}

export function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
}

/** "2026年9月23日 21:04", in the card's own time zone. */
export function formatSentAt(at: Date, timeZone = DEFAULT_TIME_ZONE, lang: Lang = "ja"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const date = formatFuzzyDate(`${get("year")}-${get("month")}-${get("day")}`, { lang });
  return `${date} ${get("hour")}:${get("minute")}`;
}

/* -------------------------------------------------------------------------
 * The three templates (§14.8). Plain text, in the card's language, and
 * deliberately short.
 * ---------------------------------------------------------------------- */

export function replyMail(input: {
  slug: string;
  title: string;
  name: string;
  message: string;
  sentAt: Date;
  timeZone?: string;
  lang?: Lang;
}): Mail | null {
  const to = notifyTo(input.slug);
  if (!to) return null;
  const t = strings(input.lang).mail;

  return {
    to,
    subject: t.replySubject(input.title),
    text: [
      t.replyLead(input.name),
      "",
      input.message,
      "",
      `— ${formatSentAt(input.sentAt, input.timeZone, input.lang)}`,
      "KARTA_SPACE",
    ].join("\n"),
  };
}

export function cometMail(input: {
  slug: string;
  title: string;
  name: string;
  returnsOn: string;
  token: string;
  lang?: Lang;
}): Mail | null {
  const to = notifyTo(input.slug);
  if (!to) return null;
  const t = strings(input.lang).mail;

  const date = formatFuzzyDate(input.returnsOn, { lang: input.lang });
  return {
    to,
    subject: t.cometSubject(input.name, date),
    text: [
      t.cometLead(input.title, input.name),
      t.cometSealed(date),
      "",
      t.cometLink,
      `${baseUrl()}/comet/${input.token}`,
      "",
      // The one warning that matters, in the one place it will be read.
      t.cometKeep,
      "KARTA_SPACE",
    ].join("\n"),
  };
}

export function cometDayMail(input: {
  slug: string;
  title: string;
  label: string;
  promise: string;
  today: string;
  lang?: Lang;
}): Mail | null {
  const to = notifyTo(input.slug);
  if (!to) return null;
  const t = strings(input.lang).mail;

  return {
    to,
    subject: t.daySubject(input.label),
    text: [
      t.dayLead(input.title),
      "",
      input.promise,
      "",
      t.dayNudge,
      t.dayCard(`${baseUrl()}/c/${input.slug}`),
      "",
      t.dayOpen,
      "KARTA_SPACE",
    ].join("\n"),
    // One reminder per card per day, whatever the scheduler does (§12.1).
    idempotencyKey: `comet-${input.slug}-${input.today}`,
  };
}
