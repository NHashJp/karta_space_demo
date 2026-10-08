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
from `MAIL_FROM`. Plain text, short, and in the **card's language** (`lang`) —
the sender wrote the card, so they read its mail in the same language. The
Japanese text is unchanged; the English is in `lib/i18n.ts` beside it.

| Mail | When | Carries |
|---|---|---|
| Reply | the receiver launches a rocket | their name, their message, the time in the card's zone |
| Comet | the receiver puts words on the comet | the return date and **the link**, which is the only copy |
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

## A feature nobody can deliver is not offered

`toClientCard` decides what the card offers by asking the environment what it
could actually do, so the two features that need mail are absent rather than
broken when it is not set up:

```ts
replyAvailable = Boolean(card.reply) && mailReady(slug)
capsule        = comet.invite !== false && mailReady(slug) && cometReady()
                 && cycle.status === "away"
```

The alternative — showing the button and failing at the end — spends
someone's message to tell them something the server knew before the page was
rendered.

The flags are computed on the server and travel to the browser as booleans.
No env value reaches the client: `notifyTo()` returns the address, `mailReady`
and `cometReady` return yes or no, and nothing in `ClientCard` carries a key.

The practical consequence is that **a local dev server with no
`RESEND_API_KEY` shows neither the reply rocket nor the comet's invite.** That
is correct, and it is the single most common "where did the button go".
[Testing](./testing.md#the-reply-and-the-comet-are-invisible-until-mail-is-configured)
has the setup.

## Testing it without an account

`MAIL_DEV_SINK=1` makes `sendMail` write each message to `.mail/` and return
success, and makes `mailReady` true, so both features can be exercised end to
end with no provider at all.

It swaps the last hop and nothing else — routes, gating, templates, rate
limit, honeypot and the sealed token all behave normally — which is what makes
it worth having: the alternative was that the rocket's flight and the comet's
boarding, the two most elaborate moments in the card, could not be seen
without a Resend account.

Two locks keep it out of production: it is off unless explicitly set, and
`mailSink()` returns false whenever `NODE_ENV === "production"`. A sink that
escaped would silently swallow every message the card exists to deliver, so
neither lock is decoration.

## Nobody needs an account

Not the receiver, and not to read a comet later. There is no user system: no
sign-up, no login, no database, no row anywhere with a person in it. A receiver
opens a link, types a name and a message, and it arrives in the sender's inbox.

The one account in the product is the **deployment's** — a single Resend key,
belonging to whoever runs the server, which is the only thing that can put mail
on the wire at all. With it unset the reply and the comet are simply not
offered, and the card works without them.

## When a send fails, say why — to the operator

Every optional feature here fails quietly at the receiver, deliberately: a
reply that is never offered is better than an error in the middle of someone
reading a letter. The cost is that the failure has to surface *somewhere*, and
for a while it surfaced nowhere.

`sendMail` used to read the provider's response, check `ok`, and throw the body
away — so a failed comet came back as a bare 502 and the one person who could
fix it had nothing to go on. The provider's status and body now go to
`console.error`, never the key. The receiver still sees only that it did not
send, because an error from an email provider is not something the person
writing a message can act on.

Nearly every real failure is one of three, and the provider names which:

| What you see | Almost always |
|---|---|
| 403, "domain is not verified" | `MAIL_FROM` is on a domain not verified in the dashboard. Use `onboarding@resend.dev` locally |
| 403, "you can only send to your own address" | the account is still in test mode; `NOTIFY_TO` must be the address that owns the key |
| 401 | the key is wrong or revoked |

## What is never sent

- The receiver is **never** emailed. They gave no address, and asking for one
  would change what the card is. The satellite reminder goes to the *sender*,
  who reaches out personally — which is the whole point of the feature.
- No environment value ever appears in an email body. `npm run verify`
  section 15 sets each one to a sentinel string and searches all three
  rendered templates for it.
