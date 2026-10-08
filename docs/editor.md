# The editor

Source: `app/editor/`, `components/editor/`, `app/api/editor/*`,
`lib/editorGuard.ts`, `lib/secretsFile.ts`

`/editor`, **development only**. Every page and route refuses in production
through one guard (`lib/editorGuard.ts`): a deployed filesystem is read-only,
and a public write endpoint would let anyone rewrite every card. If
`EDITOR_PASSWORD` is set, the editor asks for it first.

## Saving

A save writes `.karta/cards.local.json` (gitignored) — see
[cards](./cards.md#where-cards-live). Errors block a save; warnings and notes are
shown and the save goes through, because a half-written card is normal while
writing. The editor holds the whole card in one place and sections only edit it,
so "unsaved changes" is one honest flag.

## Sections

- **Basics** — language first (日本語 / English: everything around the letter
  follows it), title, sign-off, time zone, when it was written.
- **Faces** — six faces, text or image; images can be uploaded straight onto a
  face.
- **Memories** — up to 20, each with a fuzzy date (year, month, day, season,
  "about" — the display string is shown live as the reader will see it) and an
  optional photograph.
- **Orbit** — the comet's dates, promise, sealed message, and the reply prompt.
- **Closing** — the closing line, the signature pad, the secret line.
- **Links** — social links under the closing screen.
- **Share** — slug, password and the deploy check.

The **preview** beside them has *Jump* and *Date*, which use the card's own
`?at=` and `?now=` — so checking the comet's return day does not mean reading
six faces and sitting through a deployment.

## Pictures

Uploads go to `private/cards/<slug>/` and come back as the path the config
should name; nothing is ever overwritten (two `IMG_0042.jpg`s become two
pictures), filenames are sanitised, and files over 350 KB save with a warning.
Renaming a card, or starting one from a sample, repoints every picture at the
new card's folder on save and **copies** the files — copies, because the
original card may still use them.

## The signature pad

Records strokes and posts them to `/api/editor/signature`, which returns SVG
markup and writes no file; the markup is saved inside the card. Pressure is
ignored, so the signature looks the same on every device.

## Setup

Every optional feature hides itself when its variable is missing, so the Setup
chip shows what the server actually has: a tick per variable, secrets as ticks
only, the two mail addresses in full (they are not secret, and *which inbox* is
the useful answer). `ACCESS_SECRET`, `COMET_SECRET` and `CRON_SECRET` have a
Generate button that appends to `.env.local` only if absent, since replacing one
would invalidate every cookie or comet issued under it.

If the panel disagrees with `.env.local`, the shell that started the server is
exporting that variable — Next.js does not override the existing environment.

## Share

Settles the slug (with an unguessable random part), issues a password — the
plaintext goes to `.karta/secrets.local.json`, a scrypt hash and an optional
hint into the card — and prints the exact commands to deploy. If
`CARD_PASSWORD_<SLUG>` is set, the controls are disabled: the environment wins.
On another computer the plaintext is not available, and the tab offers to issue
a new one.

It then **checks the deployed card** the way a receiver would, without a
cookie, comparing the page's `karta-version` tag with the saved card: live,
live but older, not live yet, or unreachable.
