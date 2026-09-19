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

## Controls^

|         |                                                               |
| ------- | ------------------------------------------------------------- |
| Desktop | wheel / trackpad, ↑ ↓, PageUp/PageDown, Space and Shift+Space |
| Mobile  | vertical swipe                                                |

One deliberate gesture moves exactly one face. Input is ignored while a
rotation is in flight, and trackpad momentum can't skip a face.

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
