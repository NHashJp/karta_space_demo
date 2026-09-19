# KARTA_SPACE — MVP demo

A single six-sided 3D message card. Open a URL, pass an optional password gate,
see the card title, then scroll or swipe through six cube faces — each one a
paragraph of Japanese text or an image.

Implements `KARTA_SPACE_MVP_Implementation_Spec.md` v0.1. No editor, no
dashboard, no database.

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000> — the root redirects to the configured card:
`/c/2026-newyear-7k2m`. Any other slug shows the invalid-card state.

To require a password, put one in `.env.local`:

```
CARD_PASSWORD=hoshizora
```

Leave it unset and the card is link-only. The password is compared
server-side; the browser only ever gets an HttpOnly cookie derived from it.

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

`npm run verify` walks this whole machine — 41 transitions — and asserts that
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

## Social links

`social` in `config/card.config.ts` drives the icons under the replay button.
**The handles there are placeholders** — `npm run verify` prints a NOTE until
you replace them. Any entry with an empty `href` is not rendered.

## Editing the card

Everything lives in `config/card.config.ts` — title, closing message, and
exactly six faces, each either:

```ts
{ type: "text", body: "…" }                       // ~80–250 Japanese characters
{ type: "image", src: "/card/x.png", alt: "…" }   // square, ideally ≥1200×1200
```

Drop replacement images in `public/card/`, edit the config, redeploy. The
current images are generated placeholders — regenerate with `npm run images`.

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

|                     |                                    |
| ------------------- | ---------------------------------- |
| `npm run dev`       | dev server                         |
| `npm run build`     | production build                   |
| `npm run verify`    | rotation math checks               |
| `npm run typecheck` | `tsc --noEmit`                     |
| `npm run images`    | regenerate placeholder card images |

## Deploying to Vercel

Import the repo, set `CARD_PASSWORD` as an environment variable if you want the
gate, deploy. The card is `noindex` via metadata, an `X-Robots-Tag` header, and
`robots.txt`.

## Known limits

Deliberate, per the spec:

- A custom slug is obscurity, not authentication.
- Images in `/public` are directly fetchable by URL. Fine for non-sensitive
  photos; move to private storage if that changes.
- Rate limiting on password attempts is in-memory, so it resets on every
  serverless cold start.
