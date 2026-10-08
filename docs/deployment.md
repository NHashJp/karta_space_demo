# Deploying to Vercel

A checklist, in the order it is worth doing. Everything here was checked
against this repository rather than written from memory — the version numbers,
the variable names and the failure modes are this project's, not Vercel's
documentation's.

The short version: this is one Next.js App Router app with no database, so the
deploy itself is unremarkable. What needs attention is **what travels with it**
and **which environment variables are set**, because almost every feature here
is designed to disappear quietly rather than fail loudly when its variable is
missing. A card with no mail configured does not show a broken reply button —
it shows no reply button. That is right for a receiver and unhelpful for you,
so the checks below are mostly about noticing absence.

---

## 1. The one that will catch you

- [ ] **Decide how your real card reaches production.**

Your card is not in the repository, and that is deliberate. `.karta/` is
gitignored, so `.karta/cards.local.json` — where the editor saves — never
leaves your machine. Only `config/cards.config.ts` is committed, and that
holds the four sample cards.

So today (checked against this repository), a deploy would serve:

| | On Vercel |
|---|---|
| `/c/2026-newyear-7k2m` | works (sample, Japanese, every feature) |
| `/c/newyear-en-k7m2q9x4` | works (sample, English, every feature) |
| `/c/thanks-sample-3f9q` | works (sample, Japanese, minimal) |
| `/c/thanks-en-r4t8w2p6` | works (sample, English, minimal) |
| `/c/yulmun99` | **404 — your card lives only in `.karta/cards.local.json`** |

Photographs travel only if they are committed under `private/cards/<slug>/` —
cube faces and memories alike, all served through the password-checked media
route. The build traces `private/cards/` into that route, so a committed
photograph is served to someone who can open the card and to nobody else. `yulmun99` has no photograph
folder at all, so its memories would show empty frames even once the card
itself is deployed. (`private/cards/sddsgf/` is the reverse: photographs with
no card config anywhere any more.)

Two ways out, and it is a real decision rather than a formality:

1. **Move the card into `config/cards.config.ts`** and commit it. Simple, and
   it is what the samples do. The cost is the point of the original design:
   the card is a letter to one person, and committing it puts their name and
   what you wanted to say in the history of a repository you may later share,
   fork or hand to someone.
2. **Keep it out and accept the card is local-only** — fine if you are only
   ever showing this on your own machine, useless if you want to send a link.

There is no third path built in today. If you want one — the card supplied as
an environment variable, say, so it is in Vercel and not in git — say so and
it is a small change.

---

## 2. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, for the
Production environment. Nothing here reads a `.env` file on Vercel; the
dashboard *is* the environment.

| Variable | What it enables | Without it |
|---|---|---|
| `ACCESS_SECRET` | editor-issued (hashed) card passwords | a hash-protected card **fails closed — nobody can open it** |
| `CARD_PASSWORD` | one password for every card | no gate, unless a card has its own |
| `CARD_PASSWORD_<SLUG>` | a password for one card; beats the shared one | falls back to `CARD_PASSWORD` |
| `COMET_SECRET` | sealing the receiver's words onto the comet | the comet's invitation is simply not offered |
| `CRON_SECRET` | the daily comet-day reminder | `/api/cron/comets` refuses every request |
| `RESEND_API_KEY` | sending mail | no reply button, no comet invitation |
| `MAIL_FROM` | the address mail is sent from | as above — all three are required together |
| `NOTIFY_TO` | the inbox replies arrive at | as above |
| `PUBLIC_BASE_URL` | absolute links inside emails | the links in your own emails are broken |
| `MAIL_DEV_SINK` | **development only**: writes mail to `./.mail/` | — must not be set on Vercel |

- [ ] `ACCESS_SECRET` — 32 random bytes. Set it even if no card uses a hash
      today, so that issuing one later does not silently lock the card.
- [ ] `COMET_SECRET` — 32 random bytes.
- [ ] `CRON_SECRET` — 32 random bytes. Vercel sends it as
      `Authorization: Bearer $CRON_SECRET` automatically once it is set.
- [ ] `RESEND_API_KEY` — a key with **Sending access** is enough, and is the
      safer kind: the app only ever calls `POST /emails`.
- [ ] `MAIL_FROM` — see *Resend* below. With `onboarding@resend.dev` it works
      **only while `NOTIFY_TO` is the address that owns the Resend account**.
- [ ] `NOTIFY_TO` — your own inbox. Per-card override is
      `CARD_NOTIFY_TO_<SLUG>`.
- [ ] `PUBLIC_BASE_URL` — the deployed origin, **no trailing slash**, e.g.
      `https://karta.example.com` or `https://<project>.vercel.app`. Your local
      `.env.local` has `http://localhost:3000`; do not copy that value across,
      or every link in your emails points at your own laptop.
- [ ] **`MAIL_DEV_SINK` must NOT be set.** It writes mail to `./.mail/`
      instead of sending it, and on Vercel that means every reply is written to
      a read-only filesystem and lost.
- [ ] `EDITOR_PASSWORD` is not needed. Every editor route refuses in
      production regardless, so this only matters locally.

**On the password decision:** `CARD_PASSWORD` applies to *every* card,
including the four samples — and the samples ship with no `access.hint`, so
anyone opening one gets a password box with no clue on it. If you only want
your own card gated, give it its own — `CARD_PASSWORD_YULMUN99` for
`yulmun99` — and leave `CARD_PASSWORD` unset.

### Resend

Checked against your key today: it is a valid, sending-only key, and a real
test email sent through the app's own `sendMail` (a reply mail, with the dev
sink off) was **accepted by Resend**. So the integration works end to end.

What it is sending *from* is the thing to decide. `MAIL_FROM` is on
`resend.dev`, Resend's shared test domain, which only delivers to the email
address of the Resend account's owner. This app only ever emails you, so that
is workable — but:

- [ ] **For a launch, verify your own domain** in Resend → Domains (add the
      DNS records it gives you; usually SPF and DKIM, plus a DMARC record is
      recommended), then set `MAIL_FROM` to e.g.
      `KARTA_SPACE <cards@yourdomain>`. Mail from a shared test domain is more
      likely to land in spam, and it stops working the day `NOTIFY_TO` is not
      the account owner.
- [ ] Resend's free tier is 100 emails a day and 3,000 a month — far more than
      a handful of cards will send, but worth knowing.
- [ ] After deploying, Resend → **Logs** shows every send and why one failed.
      The app logs failures too, as `[karta-space] mail send failed: …` in the
      Vercel function logs.

---

## 3. Before you push

- [ ] `npm run check` — typecheck plus the verify suite and the 8-point grid.
      The verify scripts use `node --experimental-strip-types`, so they need
      **Node 22.6 or newer** locally; on Node 20 run them with
      `npx tsx scripts/verify-rotation.mts` (and `verify-spacing`,
      `verify-orbiters`) instead. Vercel does not run them.
- [ ] `npm run build` — passes today (17 routes, no warnings). Worth running
      once locally, because a build that fails on Vercel costs a round trip.
      It used to warn that the reply route traced the whole project, `public/`
      included; the development-only mail sink's paths are now marked
      untraced, so the functions ship only what they read.
- [ ] `git status` is clean, and any new photographs under `private/cards/`
      are committed. They are **not** gitignored, but they are easy to leave
      untracked after an upload, and a missing one is an empty face or frame
      with no error anywhere.
- [ ] Decide §1 — and if your card is going, commit its photographs too.

---

## 4. The Vercel project

- [ ] Import the repository. Framework preset: **Next.js**. No build-command
      override needed.
- [ ] **Node.js version: 22.x** (Settings → Build and Deployment). Next 16
      needs 20.9 or newer; 22 matches what the checks expect.
- [ ] Production branch: the one you merge into (`main`). Every other branch
      gets a preview deployment — with Production variables only if you also
      tick *Preview* for them, so a preview with no mail configured simply has
      no reply button.
- [ ] Node runtime — the media route reads from disk with `node:fs`, so it
      must not be moved to the edge runtime. Nothing here does that today;
      just do not add `export const runtime = "edge"` to anything under
      `app/c/[slug]/media/`.
- [ ] `vercel.json` is already committed and schedules the reminder:
      `{"crons":[{"path":"/api/cron/comets","schedule":"0 0 * * *"}]}`.
      That is **UTC**, so it fires at 09:00 Asia/Tokyo. On the Hobby plan
      Vercel may run it anywhere within that hour, and may skip a run — the
      reminder is best-effort by design, and says so in
      [messaging](./messaging.md).
- [ ] Set your custom domain, then come back and make `PUBLIC_BASE_URL` match
      it. These two disagreeing is the most common way the comet links in an
      email end up pointing at a preview deployment.

---

## 5. After the first deploy

The editor's **Share** tab has a live check built in for exactly this: it
fetches the deployed URL the way a receiver would, with no cookie, and
compares the `karta-version` meta tag to the card you have saved. Four answers:
live, live but older, not live yet, couldn't reach it.

Then, by hand, on a phone:

- [ ] `/c/<slug>` loads, and shows the password gate if you set one.
- [ ] The password works and the card opens.
- [ ] Read through to the closing screen, deploy to orbit, open the trail —
      **the memory photographs appear.** This is the one that was broken
      locally; it goes through the gated media route, which behaves
      differently from everything else.
- [ ] `/editor` refuses. It should 404 rather than render.
- [ ] `?at=orbit`, `?now=2027-01-01` and `?visit=again` all do **nothing** on
      the deployed site. They are inert outside development, and a `?now=`
      that still worked would be the comet's seal undone.
- [ ] The reply and comet buttons are **there**. If they are missing, a mail
      variable is missing — features hide rather than break.
- [ ] Send yourself a reply from the card. It arrives at `NOTIFY_TO` (check
      spam the first time), and the links inside it are absolute and point at
      your domain, not `localhost`.
- [ ] Open an English sample card (`/c/newyear-en-k7m2q9x4`) and check the
      interface, dates and countdown are in English.
- [ ] Put words on the comet. The email arrives; the link opens
      `/comet/<token>`; it refuses to show the message before the return date.
- [ ] Trigger the cron once by hand rather than waiting a day:
      ```
      curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/comets
      ```

---

## 6. What you do not need to do

Worth knowing so you do not go looking:

- **The editor does not need disabling.** `lib/editorGuard.ts` refuses every
  `/api/editor/*` route and the page itself whenever `NODE_ENV` is production.
  That is one guard in one file, so a new editor route cannot miss it.
- **The dev query parameters do not need removing.** `?at=`, `?now=` and
  `?visit=` each check for production themselves.
- **There is no database to provision, and no migration.** A card is a file.
- **Nothing the receiver writes is stored.** Replies are emailed; comet words
  are encrypted into the link that goes to you. If you delete that email, the
  comet is gone — and the email says so.

---

## 7. Loose ends in this repository

Not blockers, but you should know before you deploy rather than after:

- [x] **Signatures are no longer public files.** They are kept in the card
      itself (`.karta/cards.local.json`), like its words, and reach the
      browser only behind the card's password — see `lib/signature.ts`.
- [ ] **The four sample cards will be publicly reachable** on your domain,
      gated only by whatever `CARD_PASSWORD` you set. Decide whether you want
      them deployed at all; their slugs also end in short random parts, which
      `npm run verify` notes as guessable.
- [ ] `private/cards/2026-newyear-7k2m/` holds a stray
      `screenshot-2026-09-22-at-11.38.56.png` that no card uses. It is deployed
      with the media route; delete it if it is not meant to be public.

---

See also: [access and security](./access-and-security.md) for how the gate and
the secrets fit together, [messaging](./messaging.md) for what mail actually
sends, and [testing](./testing.md) for the by-hand pass worth doing once per
release.
