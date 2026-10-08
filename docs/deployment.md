# Deploying to Vercel

One Next.js app with no database, so the deploy itself is ordinary. What needs
attention is **which cards travel with it** and **which environment variables
are set** — almost every feature hides itself, rather than failing, when its
variable is missing.

## 1. The one that will catch you

- [ ] **Decide how your real card reaches production.**

Vercel builds from the repository. `.karta/cards.local.json`, where the editor
saves, is gitignored, so a card that exists only there is a 404 on the deployed
site. Today that is `yulmun99`; the four samples deploy.

Pictures travel only if committed under `private/cards/<slug>/` (`yulmun99` has
none yet).

Two ways to ship a real card:

1. **Commit it** into `config/cards.config.ts` with its pictures. Simple; the
   letter then lives in the repository's history.
2. **Keep it out of git** and supply it another way — not built in yet; an
   environment-variable source is a small change.

On the site, a card is behind the same password either way
([security](./security.md)).

## 2. Environment variables

Set them in **Vercel → Project → Settings → Environment Variables** for
Production (tick Preview too if previews should have mail).

| Variable | Enables | Without it |
|---|---|---|
| `ACCESS_SECRET` | editor-issued (hashed) passwords | a hash-protected card **fails closed** |
| `CARD_PASSWORD_<SLUG>` | one card's password | falls back to `CARD_PASSWORD` |
| `CARD_PASSWORD` | a password for every other card | those cards are link-only |
| `COMET_SECRET` | sealing the receiver's words | the comet's invitation is not offered |
| `CRON_SECRET` | the daily comet-day reminder | the cron route refuses everything |
| `RESEND_API_KEY` | sending mail | no reply button, no comet invitation |
| `MAIL_FROM` | the sender address | as above — all three mail variables together |
| `NOTIFY_TO` | your inbox (`CARD_NOTIFY_TO_<SLUG>` per card) | as above |
| `PUBLIC_BASE_URL` | absolute links in emails | links in your emails are broken |

- [ ] `ACCESS_SECRET`, `COMET_SECRET`, `CRON_SECRET` — 32 random bytes each (the
      editor's Setup → Generate). Set `ACCESS_SECRET` even if no card uses a hash
      yet. Changing `COMET_SECRET` later loses every comet in flight.
- [ ] `RESEND_API_KEY` — a *Sending access* key is enough.
- [ ] `MAIL_FROM` — verify your own domain in Resend (DNS records it gives you)
      and use e.g. `KARTA_SPACE <cards@yourdomain>`. On `resend.dev` it delivers
      only to the Resend account owner's address and is likelier to land in spam.
- [ ] `NOTIFY_TO` — your inbox.
- [ ] `PUBLIC_BASE_URL` — the deployed origin, no trailing slash. **Not** the
      `http://localhost:3000` from `.env.local`.
- [ ] `MAIL_DEV_SINK` **not set**. `EDITOR_PASSWORD` is not needed (the editor
      is off in production).

`CARD_PASSWORD` gates the samples too, with no hint; to gate only your card use
`CARD_PASSWORD_<SLUG>` and leave `CARD_PASSWORD` unset.

Mail was verified end to end with the current key: a real send through the
app's `sendMail` was accepted by Resend. Failures are explained in
[messaging](./messaging.md#resend).

## 3. Before you push

- [ ] `npm run check` passes ([testing](./testing.md)).
- [ ] `npm run build` passes — 17 routes, no warnings.
- [ ] `git status` is clean; new pictures under `private/cards/` are committed
      (a missing one is an empty frame, with no error anywhere).
- [ ] §1 decided.

## 4. The Vercel project

- [ ] Import the repository; preset **Next.js**, no overrides.
- [ ] Node.js **22.x**.
- [ ] Production branch `main`; other branches get previews.
- [ ] `vercel.json` already schedules `/api/cron/comets` at `0 0 * * *` **UTC**
      (09:00 in Tokyo). On Hobby it may run late in that hour, or be skipped.
- [ ] Keep the media route on the Node runtime — it reads files from disk.
- [ ] Add your domain, then make `PUBLIC_BASE_URL` match it.

## 5. After the first deploy

The editor's **Share** tab checks the deployed card as a receiver would.
Then, on a phone:

- [ ] `/c/<slug>` shows the gate; the password opens the card.
- [ ] Faces show their pictures, and the trail its photographs.
- [ ] `/editor` 404s. `?at=`, `?now=` and `?visit=` do nothing.
- [ ] The reply and comet buttons are there (if not, a mail variable is missing).
- [ ] Send a reply: it reaches `NOTIFY_TO` (check spam once), with links on your
      domain. Put words on the comet: the link opens `/comet/<token>` and refuses
      before the return date.
- [ ] An English card reads in English.
- [ ] Trigger the reminder once:
      `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/comets`
- [ ] Resend → Logs, and Vercel's function logs (`[karta-space] mail send
      failed`), show any failures.

## 6. Loose ends

- [ ] The four sample cards are publicly reachable behind `CARD_PASSWORD`;
      remove them if you do not want them live. Their short slugs are noted as
      guessable by `npm run verify`.
- [ ] `private/cards/2026-newyear-7k2m/screenshot-2026-09-22-at-11.38.56.png` is
      unused but deployed — delete it if it is not meant to be there.
- [ ] `private/cards/sddsgf/` holds pictures for a card that no longer exists.
- [ ] Pictures that were once in `public/` remain in git history.
