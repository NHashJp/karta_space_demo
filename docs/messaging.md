# Messaging

Source: `lib/mail.ts`, `lib/notify.ts`, `app/c/[slug]/reply/`,
`app/c/[slug]/comet/`, `app/api/cron/satellites/`

## Everything the receiver writes goes to the sender

There is no database, and this is a design decision rather than a stage of
construction (spec v0.2 R2). A reply exists in exactly one place — the sender's
inbox. A comet exists in exactly one place — the link in the email announcing
it.

What that buys:

- the receiver never authenticates, never has an account, and gives no contact
  details at all. A name is the only thing they type that identifies them;
- nothing personal is stored on a server anyone has to look after;
- the whole feature set works on a deployment with no persistence.

What it costs, and the cost is real:

- **if the sender deletes the email, the comet is gone.** There is no copy.
  The email says so, in the email, because that is the only place the warning
  will be read;
- a failed send is a lost message. The receiver is told it failed and can try
  again, but nothing is queued;
- rotating `COMET_SECRET` invalidates every comet still on its way.

Storing comets server-side, so a lost email does not lose the message, is
listed in §20 as deferred to v0.3.

## The three emails

All three go to `notifyTo(slug)` — `CARD_NOTIFY_TO_<SLUG>`, else `NOTIFY_TO` —
from `MAIL_FROM`. Plain text, Japanese, and short.

| Mail | When | Carries |
|---|---|---|
| Reply | the receiver launches a rocket | their name, their message, the time in the card's zone |
| Comet | the receiver releases a comet | the return date and **the link**, which is the only copy |
| Satellite day | the daily cron, on the satellite's date | the promise, and a nudge to reach out |

The timestamp is formatted in the **card's** time zone, not the server's. A
card written in Tokyo and served from Virginia should say when the reply was
written, not when a machine received it.

## Idempotency

The satellite reminder carries `Idempotency-Key: satellite-<slug>-<date>`, so a
scheduler that fires twice in a day still sends one email. This matters because
the alternative — storing "already sent" somewhere — would need the database
this whole design is avoiding.

It is **best effort**, and documented as such: Vercel cron may skip a run, and
on the Hobby plan it fires at some point within the scheduled hour. A missed run
means no reminder that year. It is a nudge, not a guarantee, and the card never
promises the receiver that one will arrive.

## The daily job

`GET /api/cron/satellites`, scheduled in `vercel.json` at `0 0 * * *` UTC.

Two details that are easy to get wrong:

- **The date check is in the card's time zone, not the server's.** 15:00 UTC on
  the 24th is already the 25th in Tokyo. A card written in Japan is reminded on
  its own date, wherever the job happens to run.
- **No secret configured means the route is off, not open.** An
  unauthenticated endpoint that sends email is an endpoint that sends email for
  anyone. It answers 401 until `CRON_SECRET` is set, and 401 to anything
  without the matching bearer token.

It answers `{ checked, sent, failed }` for the logs, and can be called by hand
with the same header to test a card before its date arrives.

## Resend over HTTP, no SDK

One `POST` with a JSON body. An SDK for that would be a dependency to keep
updated in exchange for saving six lines.

A send failure never surfaces the provider's error to the receiver. "It didn't
go" is actionable; a 422 from an email API is not, and it is not their problem.

## What is never sent

- The receiver is **never** emailed. They gave no address, and asking for one
  would change what the card is. The satellite reminder goes to the *sender*,
  who reaches out personally — which is the whole point of the feature.
- No environment value ever appears in an email body. `npm run verify`
  section 15 sets each one to a sentinel string and searches all three
  rendered templates for it.
