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
holds the two sample cards.

So today, a deploy would serve:

| | On Vercel |
|---|---|
| `/c/2026-newyear-7k2m` | works (sample) |
| `/c/thanks-sample-3f9q` | works (sample) |
| `/c/sddsgf` | **404 — the card does not exist there** |

The photographs are fine: `private/cards/` and `public/cards/` are both
tracked, and `private/cards/sddsgf/` is committed. It is the card *config*
that stays behind.

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

- [ ] `ACCESS_SECRET` — 32 random bytes. Set it even if no card uses a hash
      today, so that issuing one later does not silently lock the card.
- [ ] `COMET_SECRET` — 32 random bytes.
- [ ] `CRON_SECRET` — 32 random bytes. Vercel sends it as
      `Authorization: Bearer $CRON_SECRET` automatically once it is set.
- [ ] `RESEND_API_KEY`, and **verify your `MAIL_FROM` domain in Resend** — an
      unverified sending domain is the usual reason the first real send fails.
- [ ] `NOTIFY_TO` — your own inbox. Per-card override is
      `CARD_NOTIFY_TO_<SLUG>`.
- [ ] `PUBLIC_BASE_URL` — the deployed origin, **no trailing slash**, e.g.
      `https://karta.example.com`.
- [ ] **`MAIL_DEV_SINK` must NOT be set.** It writes mail to `./.mail/`
      instead of sending it, and on Vercel that means every reply is written to
      a read-only filesystem and lost.
- [ ] `EDITOR_PASSWORD` is not needed. Every editor route refuses in
      production regardless, so this only matters locally.

**On the password decision:** `CARD_PASSWORD` applies to *every* card,
including the two samples — and the samples ship with no `access.hint`, so
anyone opening one gets a password box with no clue on it. If you only want
your own card gated, use `CARD_PASSWORD_SDDSGF` and leave `CARD_PASSWORD`
unset. Your card's hint is currently `Discord見てね`.

---

## 3. Before you push

- [ ] `npm run check` — typecheck plus 29 verify sections and the 8-point grid.
- [ ] `npm run build` — passes today (18 routes, exit 0). Worth running once
      locally, because a build that fails on Vercel costs a round trip.
- [ ] `git status` is clean, and any new photographs under `private/cards/` or
      `public/cards/` are committed. They are **not** gitignored, but they are
      easy to leave untracked after an upload, and a missing one is an empty
      frame on the trail with no error anywhere.
- [ ] Decide §1.

---

## 4. The Vercel project

- [ ] Import the repository. Framework preset: **Next.js**. No build-command
      override needed.
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
- [ ] Send yourself a reply from the card. It arrives at `NOTIFY_TO`, and the
      links inside it are absolute and work.
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

- [ ] **The signature path on your card points at the sample's folder** —
      `/cards/2026-newyear-7k2m/signature.svg?v=…`. It works, because
      `/public` is served flat, and it will keep working on Vercel. It is the
      same class of thing as the memory photographs that *were* broken, and
      the save-time repair does not yet cover signatures. Tidy, not urgent.
- [ ] **The two sample cards will be publicly reachable** on your domain,
      gated only by whatever `CARD_PASSWORD` you set. Decide whether you want
      them deployed at all.

---

See also: [access and security](./access-and-security.md) for how the gate and
the secrets fit together, [messaging](./messaging.md) for what mail actually
sends, and [testing](./testing.md) for the by-hand pass worth doing once per
release.
