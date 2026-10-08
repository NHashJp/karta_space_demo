# KARTA_SPACE SUMMARY

## What it is

A farewell card you open in a web browser. It is a cube floating in space with a message on each of its six sides. You scroll to turn it. When you reach the end, the cube unfolds into a satellite and flies into orbit, and the card keeps going: old photographs strung out behind it, and a comet carrying a sealed message that comes back on a date the sender chose.

One person writes it. One person reads it. There are no accounts, no database, and no feed.

## The two people

|                                 |                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| **The sender** writes the card  | Edits a config file, usually through the built-in editor at `/editor`. Deploys it. Sends the link. |
| **The receiver** reads the card | Opens the link, types a password if there is one, and reads. Can write back.                       |

The receiver never signs in and never gives an email address. Anything they
write is emailed straight to the sender and stored nowhere.

## The journey, in order

1. **Landing** — the card's title, and a button.
2. **Six faces** — scroll or swipe; the cube turns one face per gesture. Each
   face is a paragraph of text — Japanese or English, per card — or a
   photograph.
3. **The closing screen** — a farewell line drawn stroke by stroke, as if by
   hand, then the sender's signature.
4. **Inside the cube** — optional. One short line written on the inner wall.
5. **Deployment** — the cube grows solar panels and becomes a satellite.
6. **Orbit** — the hub. The satellite in the middle, a planet in the corner, a
   trail of memories off to one side, a comet passing, and a rock crossing the
   deep field every half-minute or so.
7. **The comet** — the first time, the card shows how many days until it
   comes back and plays its whole way home fast while the number counts down;
   then it offers to put the receiver's words on it. They cannot be read until
   the date it comes back.
8. **The crossroads** — where next: send a reply by rocket, walk the trail of
   memories, or look at the comet's orbit.

Steps 4–8 are all optional. A card with none of them ends at step 3.

## The ideas worth knowing

**The card is a file.** No database. `config/cards.config.ts` holds two sample
cards and is committed; a _real_ card lives in `.karta/cards.local.json`, which
is gitignored, because a real card is a letter to one person and should not be
in a repository's history. The editor saves there.
→ [Content and cards](./content-and-cards.md)

**One gesture, one face.** A scroll, a swipe and an arrow key are the same
event. The cube is never between two faces when it stops.
→ [Experience flow](./experience-flow.md)

**Rotation always lands square.** Decorative spins are whole turns and tilts
return to zero, so however showy the path, the face ends exactly facing you.
→ [Cube and motion](./cube-and-motion.md)

**The comet's position is the countdown.** There is no number ticking down.
The comet is far away for most of the wait and swings home at the end; where it
is in the sky _is_ how long is left.
→ [The orbit](./orbit.md)

**The sky is how long ago it was sent.** The gas thins and cools as the card
ages, so a letter opened a year on is read against a sky further from home.
Half the change happens in six months, and it never finishes.
→ [The orbit](./orbit.md)

**A sealed message is a link, not a row.** The receiver's words are encrypted
into the URL that goes to the sender. Nothing is stored. If the sender deletes
that email, the comet is gone — and the email says so.
→ [Messaging](./messaging.md)

**A feature nobody can deliver is not offered.** If no mail is configured, the
reply button and the comet's invitation simply do not appear, rather than
appearing and failing.
→ [Access and security](./access-and-security.md)

**Two ways to send, differing only in speed.** The rocket overtakes the comet
and arrives now. The comet carries words that cannot be read until the date.
Both say which they are.

## Where things live

```
app/                 routes: the card, the editor, the API
  c/[slug]/          the card itself, and its reply + comet endpoints
  editor/            the authoring UI, development only
components/
  card/              the DOM over the scene: panels, sheets, buttons
  three/             the 3D scene: cube, satellite, planet, comet, trail
  three/shaders/     GLSL
  editor/            the authoring UI
lib/                 pure logic: state machine, dates, passwords, maths
config/cards.config.ts   the two sample cards (committed)
.karta/cards.local.json  real cards, and plaintext passwords (gitignored)
docs/                these documents
scripts/             npm run verify
```

The split that matters: **`lib/` is almost entirely pure** — no React, no
three.js — so `npm run verify` can check the maths in plain Node, without a
browser. If a number matters, it lives there. (One file, `useFaceNavigation.ts`,
is a hook; it is the exception.)

## The rules that are enforced, not just written down

`npm run verify` runs about two dozen checks. It renders nothing and sends
nothing — it proves the arithmetic. A few examples:

- every cube face lands exactly square-on, from every rotation preset
- the satellite's orbit never passes through the planet
- a sealed comet refuses to open before its date, and a tampered link opens never
- the satellite's parts all fade out together when it leaves
- the reply rocket flies towards the comet, not towards the camera
- the sky only ever ages, and never by enough to catch it in a day
- no passing rock can come within two units of the satellite, from any seed

→ [Verification](./verification.md), and [Testing](./testing.md) for the parts
a human has to look at.

## Running it

```console
$ npm install
$ npm run dev          # http://localhost:3000
$ npm run verify       # the maths
$ npm run check        # typecheck + verify
```

Going live is [Deployment](./deployment.md) — mostly environment variables, and
one decision about whether a real card belongs in the repository.

Two sample cards ship with it. `/c/2026-newyear-7k2m` has everything;
`/c/thanks-sample-3f9q` is text only.

In development, three query parameters make this bearable: `?at=` jumps to a
state, `?now=` moves the clock, `?visit=` pretends you have been here before.
All three are inert in production.

## Things that will confuse you

**The editor is development-only.** It writes to the repository, so it refuses
to exist in production. If `EDITOR_PASSWORD` is set it asks for that too.

**The reply and the comet need email configured.** Without it they are not
offered at all. `MAIL_DEV_SINK=1` writes the emails to `./.mail/` instead of
sending them, so both can be tested with no account.

**Japanese is the primary language.** The receiver-facing text is Japanese; the
editor and these documents are English.

**The comet is drawn where the composition wants it**, not on its true orbit.
Anything aiming at the comet must use `cometAt`, not the orbital maths.

## What the checks cannot tell you

`npm run verify` proves arithmetic. It renders nothing, so it cannot tell you
whether the scene _looks_ right — whether a fade reads as one object leaving,
whether a drift feels alive or twitchy, whether a line is large enough to read
as handwriting. Those are decided by looking, on a real screen, and
[Testing](./testing.md) is the list of what to look at.

A practical warning for anyone driving this in an automated browser: Chrome
stops `requestAnimationFrame` for a backgrounded window. The whole scene is
rendered on that loop, so with the window behind something else the canvas
freezes on its last frame **and the state machine stalls**, because camera
animations are what dispatch the events that advance it. Buttons then appear
to do nothing. Keep the window in front.

## Current state

Implementing spec v0.2 「またね」, with the orbit composition of revision 6 and
the dawn of revision 7.1. Where they disagree, the later revision wins. V7 adds
English cards ([languages](./languages.md)), the first-launch comet intro, an
elliptical comet orbit, and a contrail that ages and bends as it goes back.
→ [Spec v0.2](./spec-v0.2.md), [Revision 6](./spec-v0.2-r6-orbit.md)
