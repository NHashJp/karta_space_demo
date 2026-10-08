# KARTA_SPACE — MVP demo

New to the code? Start with the [beginner-friendly architecture guide](./README.architecture.md)
for the current project structure, major file roles, and technical basics.

Six-sided 3D message cards. Open a URL, pass an optional password gate, see the
card title, then scroll or swipe through six cube faces — each one a paragraph
of text or an image. A card is Japanese or English (`lang`), and everything
around it follows; see [`docs/languages.md`](./docs/languages.md).

One deployment serves any number of cards: every card is an entry in
`config/cards.config.ts`, on its own slug, with its own optional password.

Implements `KARTA_SPACE_MVP_Implementation_Spec.md` v0.1. No dashboard, no
database; a rough local editor for the messages, and nothing else.

This README is the how-to. For how it is built and why — the state machine, the
rotation maths, the content model, the access decisions — see
[`docs/`](./docs/README.md).

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000> — in development the root is the card index, so
every configured card is one click away. Any slug that is not in the config
shows the invalid-card state. **In production the root lists nothing**, because
a slug is the only thing standing between a stranger and a card.

To require a password, put one in `.env.local` — per card, or shared:

```
CARD_PASSWORD_2026_NEWYEAR_7K2M=hoshizora   # just this card
CARD_PASSWORD=hoshizora                     # every card with no password of its own
```

The per-card name is the slug, upper-cased, with every non-alphanumeric
character replaced by `_`. A card with neither variable set is link-only.
Passwords are compared server-side; the browser only ever gets an HttpOnly
cookie derived from the password, named `ks_access_<slug>` and scoped to that
card — so access to one card never grants access to another.

## The flow

```
landing ──open──> entering ──zoom in──> reading <──rotate──> transitioning
                                           │
                                     (past face 6)
                                           v
completed <──zoom out── leaving      returning ──zoom in──> reading
    │                                     ^
    └──────── scroll up / replay ─────────┘
```

The camera dollies in from a distance when the card opens and pulls back out
after the last face, with the title and closing screens rushing past the viewer
as it moves. Face text is attached to the cube **only** in the `reading` state,
so card content never shows through the title or closing screen.

`npm run verify` walks this whole machine — 57 transitions — and asserts that
text stays hidden in every other phase.

## Controls

|         |                                                               |
| ------- | ------------------------------------------------------------- |
| Desktop | wheel / trackpad, ↑ ↓, PageUp/PageDown, Space and Shift+Space |
| Mobile  | vertical swipe                                                |

One deliberate gesture moves exactly one face. Input is ignored while a
rotation is in flight, and trackpad momentum can't skip a face.

## The scene

Everything in the background is procedural — no textures to download:

| | |
|---|---|
| `NebulaBackdrop` | domain-warped fractal noise on the inside of a 90-unit sphere. Warping by a second noise field gives it wisps and hollows rather than even fog; the drift vector is built from sine pairs with unrelated periods, so the direction wanders and the motion never repeats. Drops one octave below 700px wide, for phone frame rates. |
| `Starfield` | 1500 points in a spherical shell, each with its own tint, size and twinkle phase. Sizes follow a steep curve, so a few stars are bright and most are faint — roughly how a real sky reads. |
| `WanderingLights` | three drifting lights. Every axis sums two sines whose periods share no common multiple, so a light never retraces its path. Each is a point light, so the cube picks up coloured reflections, plus an additive glow behind it so the light itself reads as nebula haze. |

Shaders live in `components/three/shaders/`. They are plain `ShaderMaterial`
sources, so they can use three's `#include <colorspace_fragment>` chunk and get
the renderer's own output colour conversion.

On the closing screen the whole scene recedes — cube materials, glows, point
lights and nebula intensity all damp down — so the drawn message reads against
it. That is derived from `dimsScene()` in the state machine, not tracked
separately.

The closing message is drawn with [React Bits' StrokeText](https://reactbits.dev/text-animations/stroke-text)
(MIT), vendored into `components/text/`. It carries two local changes, both
marked `LOCAL` in the file: the `"use client"` directive, and a `dashLength`
prop — upstream derives the stroke dash from `fontSize * 7`, which fits Latin
glyphs but leaves part of a dense kanji permanently undrawn.

## The inside of the cube

A card can carry one short line written on the *inside* of the cube. Six
seconds after the closing screen has settled — long enough for it to read as
the ending — the reader is quietly offered a way in, and the camera passes
through a wall to a line that was there the whole time.

```ts
secret: "ずっと、味方でいます。"   // up to 28 characters
```

Leave it out and nothing changes: no offer, no inner shell, no extra geometry.
It is not a seventh face — the card still has exactly six — and it is not more
private than the rest of the card, which sits behind the same password.

Short is not a style note. Inside a cube, a phone has 0.60 world units of view;
a paragraph cannot be read from in there at any size. `npm run verify` checks
the line fits at every viewport.

## Social links

`social` on each card in `config/cards.config.ts` drives the icons under its
replay button. **The handles on the first card are placeholders** — `npm run
verify` prints a NOTE until you replace them. Any entry with an empty `href` is
not rendered.

## Editing the cards

**Every message in the product lives in one file: `config/cards.config.ts`.**
Edit it by hand, or use the editor.

### The editor

```bash
npm run dev     # then open http://localhost:3000/editor
```

A rough authoring UI for that same file: pick a card in the sidebar, edit its
title, its six faces (text or image), its closing message and its links, and
press **Save to file**. It writes `config/cards.config.ts`, the dev server
reloads, and `/c/<slug>` shows the change. Each card's panel also says which
environment variable holds its password and whether that variable is set.

It runs **in development only** — a deployed filesystem is read-only, and an
unauthenticated write endpoint on a public deployment would let anyone rewrite
every card. Publishing is still a deploy. Two consequences worth knowing:

- A save rewrites the whole file from the data, so the header comment survives
  but comments you add further down do not.
- Saving is refused if any card has an error that would break the next build
  (bad or duplicate slug, not six faces, empty title or closing, an image face
  with no path). Spec advice — a paragraph outside 80–250 characters, missing
  alt text — shows as a note and still saves.

### The file

It exports an array of cards; each has a slug, a title, a closing message, an
optional line inside the cube, and exactly six faces, each face either:

```ts
{ type: "text", body: "…" }                                  // ~80–250 characters wide (a Latin letter counts ~half)
{ type: "image", src: "/cards/<slug>/x.png", alt: "…" }      // square, ideally ≥1200×1200
```

### Adding a card

1. **+ Add card** in the editor, or append an entry to the array by hand.
2. Put its images — cube faces and memory photographs — in
   `private/cards/<slug>/` (`npm run images <slug>` writes two placeholders
   there). They are served only to someone who can open the card.
3. Optionally set `CARD_PASSWORD_<SLUG>` in the environment, then restart the
   dev server — passwords are read at server start.
4. `npm run verify`, then redeploy. Send the recipient `/c/<slug>`.

Nothing else in the codebase needs to know the card exists. `lib/cards.ts`
builds the slug registry from that array and validates every entry at import
time — slug shape, slug uniqueness, exactly six faces, non-empty title and
closing — so a broken card fails the build rather than a visitor's page. The
reasoning behind all of that is in
[docs/content-and-cards.md](./docs/content-and-cards.md).

`config/cards.config.ts` ships with a second, text-only example card to show
the shape of an added one. Delete that entry when you have a real card.

The starting images are generated placeholders — regenerate with
`npm run images [slug]`.

## How the rotation works

The cube never uses a random quaternion. Each face has one canonical
orientation (`FACE_ORIENTATIONS`), and a transition is the shortest path
between two of them with a decorative offset layered on top:

- **spins** are whole turns — a multiple of 2π is the identity rotation
- **tilts** swell to a peak mid-flight and return to zero

Both vanish at `t = 1`, so the cube always lands exactly square-on with text
upright, however showy the path was. A preset is picked at random per
transition and never repeats back-to-back. `prefers-reduced-motion` swaps in a
short, plain 320 ms rotation.

`npm run verify` checks this numerically: all six faces land square-on and
upright (error 0°), every preset lands exactly on target from every other face,
and decorative rotation stays inside the spec's 360–540° budget.

## Scripts

|                     |                                                                    |
| ------------------- | ------------------------------------------------------------------ |
| `npm run dev`       | dev server                                                         |
| `npm run build`     | production build                                                   |
| `npm run check`     | typecheck, then verify — the gate before deploying                 |
| `npm run verify`    | the whole checkable surface: geometry, framing, flow, content      |
| `npm run typecheck` | `tsc --noEmit`                                                     |
| `npm run images`    | regenerate placeholder images for a card (`npm run images <slug>`) |

For what to check by hand once those pass — every feature, what it should do,
and the query parameters that make it quick — see
[docs/testing.md](./docs/testing.md).

## Deploying to Vercel

Import the repo, set `CARD_PASSWORD` and/or any `CARD_PASSWORD_<SLUG>`
variables you want, deploy. Cards are `noindex` via metadata, an `X-Robots-Tag`
header, and `robots.txt`.

Adding a card later is a config edit and a redeploy; existing cards and their
outstanding access cookies are unaffected.

## Known limits

Deliberate, per the spec:

- A custom slug is obscurity, not authentication.
- Images in `/public` are directly fetchable by URL. Fine for non-sensitive
  photos; move to private storage if that changes.
- Rate limiting on password attempts is in-memory, so it resets on every
  serverless cold start.
- Cards are configuration, not data: adding one is a deploy. That is the
  deliberate ceiling of this MVP — authoring *without* a deploy is the change
  that would force a database, and nothing before it does.
- The editor runs in development only, and writes to the repository.

The threat model is written out honestly in
[docs/access-and-security.md](./docs/access-and-security.md).
