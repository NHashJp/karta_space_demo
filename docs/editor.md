# The editor

Source: `app/editor/`, `components/editor/`, `app/api/editor/*`,
`lib/secretsFile.ts`, `lib/editorGuard.ts`, `lib/editorAccess.ts`

Development only. Two separate reasons, either one sufficient: a deployed
filesystem is read-only, so a save could not work; and an unauthenticated write
endpoint on a public deployment would let anyone rewrite every card, upload
files into the repository, and probe which slugs exist. The guard lives in
`lib/editorGuard.ts` rather than in each route, so a new route cannot be added
without it — forgetting it on one route is exactly the kind of mistake that is
invisible in the only environment it is ever tested in.

## Getting in

`/editor`, development only — every route refuses in production.

If `EDITOR_PASSWORD` is set, the editor asks for it first and every
`/api/editor/*` route answers **401** until it has been given. Unset it and
the editor is open as before. See
[Access and security](./access-and-security.md#the-editors-own-gate) for how
the lock is built and why it exists on top of the production guard.

## Where a save goes

**`.karta/cards.local.json`**, which is gitignored — not the committed config.
A real card is a letter to one person, and the editor is how real cards get
written, so that is where they belong.
See [Content and cards](./content-and-cards.md#real-cards-are-not-committed).

`config/cards.config.ts` keeps the samples for anyone editing by hand.

**Basics** starts with the card's **Language** — 日本語 or English. Everything
drawn around the letter follows it: buttons, sheets, dates, the countdown, and
the emails the sender receives. See [languages](./languages.md).

## Why it is sections now

v0.1 was one long form, which was right for six faces and a closing line. A
v0.2 card has memories, a satellite, two comets, a signature and a share flow,
and one form for all of that is a form nobody finishes.

The shell owns **all** the card state; sections receive a card and a way to
change it, and nothing else — no fetching, no local copies. That is what keeps
"unsaved changes" one honest flag rather than seven that can disagree.

## The preview earns its column

Most of a v0.2 card is states nobody sees until a specific date: the satellite
on its day, the comet at the end of its orbit, the trail three memories back.
Checking one line of the satellite panel by reading six faces and sitting
through a deployment is the kind of loop that stops people checking at all.

So the preview has **Jump** and **Date**. Both go through the card's own
machinery — `?at=` replays the reader's own events through the reducer (§6.6),
`?now=` moves the card's clock (§14.1) — and both are ignored in production.
There is no preview-only code path that could quietly rot.

## The fuzzy date input

A date picker cannot express "summer 2023", and that is the answer people
actually have about their own memories. Year, month, day, season and "about"
are separate, each optional past the year, with the rules the reader's display
follows: a day needs a month, and a season only stands in for a month that is
not there.

The display string — `2023年夏` — is shown live underneath, because that is
what the receiver reads, and the person typing should see exactly that rather
than a form that happens to produce it.

**The parts are held as typed, not re-derived.** They used to be rendered from
the committed value every keystroke, which meant the field could not be typed
into at all: `parseFuzzyDate` rejects `2`, `20` and `202`, so each of the first
three digits of a year parsed to null, re-rendered the box as empty, and threw
the character away. Only a paste of all four at once ever landed, and the bug
was in every date on the card, not just one. A half-typed date is a normal
state for a text field and a meaningless one for the card, so the two are kept
apart: the draft is what you see, and only a date that parses is sent up.

The control is also one row rather than four. `.field input { width: 100% }`
outranked the width the date boxes asked for, so each date rendered as three
full-width fields stacked — which is most of why the Memories tab was a
scroll.

## Setup: every optional feature fails quietly

A reply that is never offered, a comet that never seals, a reminder that never
sends. All three fail silently by design, because failing loudly *at a
receiver* would be worse. The cost is that the sender has no way to discover
why, so the Setup chip is where they find out: a tick, the variable's name, and
what it enables.

**Secrets are never shown**, and never leave the server — the editor page sends
booleans for them. `ACCESS_SECRET`, `COMET_SECRET` and `CRON_SECRET` have a
Generate button, because nobody should be expected to produce 32 random bytes
by hand; it appends to `.env.local` only if absent (overwriting one would
invalidate every cookie and comet issued under the old value) and returns
nothing but a tick.

The two mail **addresses** are the exception, and are shown in full. They are
not secrets — one of them is printed on every email that leaves — and a tick
beside `NOTIFY_TO` answers the wrong question. What the sender needs to know
before they test anything is *which inbox this is going to*, and a tick cannot
tell them they are pointed at an address they had forgotten about.

### A trap worth knowing

Next.js does **not** override variables already present in the environment. If
the shell that started the server exports `MAIL_FROM` or `NOTIFY_TO`, the shell
wins and `.env.local` is ignored for those keys — including the values the
Setup panel is showing you, which come from `process.env` and are therefore the
shell's. Start the server from a clean shell if the two ever disagree.

## Share: the last mile

The writing is the part people expect to be hard. The part that actually loses
cards is afterwards — a slug to settle, a password to issue, a deploy to
remember, and a link that either works or silently 404s.

The editor cannot deploy (§20). So it does the next most useful thing: it says
exactly what to run, and then **checks**. `GET /api/editor/live?slug=` fetches
the deployed URL the way a receiver would — without a cookie — and compares the
`karta-version` meta tag to the saved card. Four answers: live, live but older,
not live yet, couldn't reach it. The version tag is rendered on the password
gate too, precisely so this works without anyone's password.

### Where a password lives

| What | Where | Committed? |
|---|---|---|
| The plaintext | `.karta/secrets.local.json` | **no** (gitignored) |
| The scrypt hash | `access.passwordHash` in the config | yes |
| The hint | `access.hint` | yes, and shown on the gate |

The hash is computed on the server, both because scrypt at N = 2^15 would block
a tab noticeably and because there is then exactly one implementation of "how a
password becomes a hash" — shared with the gate that checks it.

The consequence of keeping the plaintext out of the repository is stated in the
UI rather than hidden: **on another computer the Share tab cannot show the
password**, and offers to issue a new one. That is the honest behaviour for a
file that is deliberately not shared.

If `CARD_PASSWORD_<SLUG>` is set, the controls are disabled and say so. An
environment password wins over anything the editor can issue, and letting
someone set one that does nothing would be worse than not offering it.

## The signature pad

A trackpad signature does not look like a pen signature, and does not need to.
What it needs to be is *yours* — the one mark on a card a template could not
have produced.

It writes **stroked paths, never fills**. That is not a style preference: the
closing screen draws the signature by walking a dash along each path, and a
filled shape has nothing to walk. It would simply appear, which is not the same
thing.

It is kept **in the card**, like the card's words — never as a file. The pad
posts its strokes to `/api/editor/signature`, which returns the SVG and writes
nothing; the editor stores it as `signature` and it is saved with the card to
`.karta/cards.local.json`. It used to be written to
`public/cards/<slug>/signature.svg`, which is served flat: anyone with the URL
could fetch someone's handwriting without the password, and it was committed
with the repository. Before it reaches the page the server rebuilds it from its
own path data (`cleanSignature` in `lib/signature.ts`), so nothing but stroked
paths is ever put into the document. `npm run verify` checks a configured
signature is inline markup rather than a path, survives that rebuild, and has
paths and no fills.

Pressure is ignored — half the devices this runs on do not report it, and a
signature whose weight depends on the hardware would look different to the
sender than to the receiver.

## Photographs

`POST /api/editor/upload` takes a `to`, because the card has two kinds of
picture and they live in different places:

| | Goes to | Named by | Why |
|---|---|---|---|
| Memory photographs | `private/cards/<slug>/` | its path in the repository | personal, and served through the gated media route (§14.3) |
| Cube faces | `public/cards/<slug>/` | its URL | part of the card itself, loaded as a texture by the scene |

The default is the private one, the safer of the two to get wrong. Handing
back the wrong spelling produces a card that validates and shows nothing, so
the route returns the path the config should name, already in the right form.

Faces only gained an upload recently. Before that the Faces tab offered a
dropdown of files already on disk and a box to type a path into, so putting a
picture on a face meant leaving the editor, copying a file in by hand, and
coming back — while memories had had a file input all along.

One wrinkle worth knowing: the list of files is a server prop, fixed until the
page reloads, so a picture uploaded a moment ago is not in it — and a `select`
whose value is not among its options renders **blank**. The face's own `src`
is therefore always offered as an option, whether or not the listing has
caught up.

Nothing is ever overwritten. Two different photographs both called
`IMG_0042.jpg` should end up as two photographs; silently replacing the first
would lose it with no way back. Filenames are sanitised because they become
path segments, and a name from a phone can be anything at all.

Over 350 KB the editor says so and saves anyway. It is their photograph, and
the cost is a slower trail rather than a broken one.

### Pictures follow the card when its slug changes

A card's media is filed under its slug, and the slug is written into every
media path — so the slug is not just a name, it is half of every picture's
address. The slug field only ever rewrote the slug, which meant renaming a
card, or starting one by copying the sample, left all of its photographs
pointing at the old card's folder.

The two kinds then failed **differently**, which is why it went unnoticed for
so long:

| | What happened | Visible? |
|---|---|---|
| Cube faces | still loaded — `/public` is served flat, and the file really was at that URL | no |
| Memory photographs | 404 — they go through `/c/<slug>/media/`, which resolves inside that card's own folder and refuses anything outside it | **only as empty frames** |

So the trail drew its frames with no photographs in them and said nothing,
because a memory that cannot load must never block the journey (§9.4). The
only trace was a warning in `npm run verify`'s local-card report.

The media route is right and has not changed — one card's reader must not be
able to walk into another card's private pictures. What was wrong is that a
rename did not carry the pictures with it, and now a save does: it repoints
every stray path at this card's own folder and copies the files across. It
**copies, never moves**, because the card it came from may still be using them
— which is exactly the case when someone starts a new card from the sample.

It heals a card that is already broken as well as one being renamed now, which
matters because nobody knows to go looking for a failure this quiet. The save
hands back what it actually wrote, so the Memories tab shows the new paths
rather than the ones it sent.
