# Messaging

Source: `lib/mail.ts`, `lib/notify.ts`, `app/c/[slug]/reply/`,
`app/c/[slug]/comet/`, `app/api/cron/comets/`

Everything the receiver writes goes to the sender's inbox, and nowhere else. A
reply exists only as an email; a comet exists only as the link in its email. No
accounts, no stored personal data — and the costs are real: if the sender
deletes that email the comet is gone (the email says so), and a failed send is
not queued.

## The emails

All go to `CARD_NOTIFY_TO_<SLUG>`, else `NOTIFY_TO`, from `MAIL_FROM`, as short
plain text in the **card's language**.

| Email | Sent when | Carries |
|---|---|---|
| Reply | the receiver launches a rocket | their name and message, the time in the card's zone |
| Comet | the receiver puts words on the comet | the return date and **the link** — the only copy |
| Comet day | the daily job, on the return date | the promise, and a nudge to reach out |

The receiver is never emailed. No environment value can appear in a body
(checked by `npm run verify`).

## Only offered when deliverable

`toClientCard` asks the environment before offering anything:

```ts
replyAvailable = card.reply && mailReady(slug)
capsule        = comet.invite !== false && mailReady(slug) && cometReady()
                 && comet still away
mailReady  = RESEND_API_KEY && MAIL_FROM && (CARD_NOTIFY_TO_<SLUG> || NOTIFY_TO)
cometReady = COMET_SECRET
```

So with mail unset the reply button and the comet's invitation are simply
absent — the most common "where did the button go". Only booleans reach the
browser.

## Resend

One `POST https://api.resend.com/emails` with a JSON body; no SDK. A sending-only
key is enough. On failure the receiver is told it did not send; the provider's
status and body go to the server log as `[karta-space] mail send failed: …`.

| Provider says | Usually means |
|---|---|
| 403, domain not verified | `MAIL_FROM` is on a domain not verified in Resend |
| 403, can only send to your own address | the account is in test mode, or `MAIL_FROM` is on `resend.dev`; `NOTIFY_TO` must be the account owner's address |
| 401 | the key is wrong or revoked |

## The daily job

`GET /api/cron/comets`, scheduled in `vercel.json` at `0 0 * * *` UTC. It checks
each committed card's comet in the **card's** time zone and sends the comet-day
email with an `Idempotency-Key` of `comet-<slug>-<date>`, so a double run sends
once. With no `CRON_SECRET` the route refuses everything; Vercel sends the secret
as a bearer token. It is best effort — on the Hobby plan a run may be late or
skipped.

## Testing without an account

`MAIL_DEV_SINK=1` writes each email to `.mail/` instead of sending it and makes
both features available, with everything else — routes, templates, rate limit,
the sealed token — unchanged. It only works outside production. `COMET_SECRET`
is still needed for a real token.
