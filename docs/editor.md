# The editor

Source: `app/editor/`, `components/editor/`, `app/api/editor/*`,
`lib/secretsFile.ts`, `lib/editorGuard.ts`

Development only. Two separate reasons, either one sufficient: a deployed
filesystem is read-only, so a save could not work; and an unauthenticated write
endpoint on a public deployment would let anyone rewrite every card, upload
files into the repository, and probe which slugs exist. The guard lives in
`lib/editorGuard.ts` rather than in each route, so a new route cannot be added
without it — forgetting it on one route is exactly the kind of mistake that is
invisible in the only environment it is ever tested in.

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

## Setup: every optional feature fails quietly

A reply that is never offered, a comet that never seals, a reminder that never
sends. All three fail silently by design, because failing loudly *at a
receiver* would be worse. The cost is that the sender has no way to discover
why, so the Setup chip is where they find out: a tick, the variable's name, and
what it enables.

**Values are never shown**, and never leave the server — the editor page sends
booleans. `ACCESS_SECRET`, `COMET_SECRET` and `CRON_SECRET` have a Generate
button, because nobody should be expected to produce 32 random bytes by hand;
it appends to `.env.local` only if absent (overwriting one would invalidate
every cookie and comet issued under the old value) and returns nothing but a
tick.

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
thing. `npm run verify` checks any configured signature is a real file, is an
SVG, and has paths and no fills.

Pressure is ignored — half the devices this runs on do not report it, and a
signature whose weight depends on the hardware would look different to the
sender than to the receiver.

## Photographs

`POST /api/editor/upload` writes into `private/cards/<slug>/`, not `public/`,
because memory photographs are served through the gated media route (§14.3).

Nothing is ever overwritten. Two different photographs both called
`IMG_0042.jpg` should end up as two photographs; silently replacing the first
would lose it with no way back. Filenames are sanitised because they become
path segments, and a name from a phone can be anything at all.

Over 350 KB the editor says so and saves anyway. It is their photograph, and
the cost is a slower trail rather than a broken one.
