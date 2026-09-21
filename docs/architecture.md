# Architecture

## Shape of the thing

One Next.js App Router application, deployed to Vercel, with no database.
Cards live in source control as configuration: `config/cards.config.ts` is an
array of them, and `lib/cards.ts` turns that array into a slug registry at
import time. Adding a card is appending an entry and dropping its images in
`public/cards/<slug>/` — no other file changes.

Why this scales far enough for the MVP: a card is a few kilobytes of text, the
registry is a `Map` built once per server start, and the only per-card state
(has this visitor entered the password) lives in a cookie named after the card.
The first thing that would force a database is letting someone *author* a card
without a deploy; everything up to that point is just more entries in the
array.

```
Request  /c/[slug]
    │
    ├─ server component ──> slug not in the registry? ──> invalid-card state, nothing else sent
    │                       password set for this slug and no valid cookie? ──> PasswordGate
    │                       otherwise ──> CardExperience, with card content
    │
    └─ POST /api/access ──> compare password, set HttpOnly cookie
```

Everything after access is granted happens in the browser. There is no further
server round-trip: no card API, no analytics, no response submission.

## Layers

```
app/                     routing, server-side access decisions
 ├─ page.tsx             dev card index; a neutral notice in production
 ├─ c/[slug]/page.tsx    server component: the only place content is gated
 ├─ editor/page.tsx      dev-only authoring UI for the config file
 ├─ api/access/route.ts  password check, cookie issue
 ├─ api/editor/route.ts  dev-only: validate, then rewrite the config file
 └─ layout.tsx           fonts, metadata, noindex

lib/                     logic with no rendering in it
 ├─ access.ts            per-card password, token derivation, cookie, rate limit
 ├─ cards.ts             slug registry, built from the config at import
 ├─ cardRules.ts         validation rules (pure; shared by registry and editor)
 ├─ cardsFile.ts         dev-only: serialise the cards back to the config file
 ├─ experienceState.ts   the state machine (pure)
 └─ useFaceNavigation.ts wheel / touch / keyboard gestures

components/
 ├─ access/              PasswordGate
 ├─ card/                screens and the state machine's host component
 ├─ editor/              the dev-only authoring UI
 ├─ three/               everything inside the WebGL canvas
 │   ├─ framing.ts       camera and typography maths (pure)
 │   ├─ rotationPresets.ts  orientation maths (pure)
 │   └─ shaders/         GLSL sources
 └─ text/                vendored React Bits StrokeText

config/cards.config.ts   every card: title, six faces, closing, links
types/card.ts            the content model
scripts/                 placeholder image generator, verification suite
```

`lib/cardRules.ts` is the reason the editor cannot corrupt the config: the
rules that the registry enforces at import time are the same object the editor
API checks before writing and the same one the UI shows as you type. There is
one definition of a valid card, not three.

The deliberate split is that **anything worth checking is a pure function in a
file with no React in it**. `framing.ts`, `rotationPresets.ts` and
`experienceState.ts` are all importable from a plain Node script, which is what
makes [verification](./verification.md) possible without a browser.

## Server and client boundary

`app/c/[slug]/page.tsx` is a server component. It is the only place that
decides whether to render a card at all, and the only route whose rendering
depends on the card's password. (In development `app/editor/page.tsx` also
reads the environment, but only to report *whether* a password variable is set
— never its value.) When access has not been granted it returns `<PasswordGate>`
and the card object is never serialised into the response.

Everything under `components/card/` and `components/three/` is a client
component. They receive the already-authorised `CardConfig` as props.

## Component tree, once the card is open

```
CardExperience                     state machine host, owns activeFace
├── CubeScene                      the <Canvas>
│   ├── CameraRig                  sole owner of camera distance
│   ├── SpaceEnvironment
│   │   ├── NebulaBackdrop         shader sphere, radius 90
│   │   ├── Starfield              1500 points, custom shader
│   │   └── WanderingLights        3 point lights + additive glows
│   └── MessageCube                orientation, idle drift, dimming
│       ├── TextFace   x n         <Html transform> paragraph on a face
│       └── ImageFace  x n         texture on a face
├── CardLanding | CompletionState  the screens that bracket the experience
├── CardProgress + hint            the reading UI
└── .sr-only                       all face text as plain DOM, for assistive tech
```

`CardExperience` holds the only mutable state. Everything below it is driven by
props, and the three-dimensional components translate those props into
animation in `useFrame` rather than re-rendering.

## Why animation does not re-render

React re-rendering at 60fps would be wasteful and jittery. So every animated
value — cube orientation, camera distance, dim level, shader uniforms — lives
in a `useRef` and is advanced inside `useFrame`. React renders only when a
*phase* changes, which happens a handful of times in a whole session.

The pattern throughout:

```tsx
const value = useRef(0);

useEffect(() => {
  // a phase changed: record where we are and where we are going
}, [phase]);

useFrame((state, delta) => {
  // advance value, apply it to the three.js object directly
});
```

## Dependencies, and why each is here

| Package | Why |
|---|---|
| `next`, `react` | App Router gives the server-side gate without a separate backend |
| `three`, `@react-three/fiber` | the 3D scene |
| `@react-three/drei` | `<Html transform>` for real DOM text on a cube face, `<Edges>` for cube edges, `useTexture`, `useProgress` |
| `gsap` | required by the vendored React Bits StrokeText |

There is no animation library for the 3D work. Cube rotation, the camera dolly
and dimming are hand-rolled in `useFrame`, because all three need exact
end-states — quaternion slerp with a decorative offset, and damping that snaps
its tail — which is more direct to write than to configure.

No CSS framework. `app/globals.css` is one file of plain CSS with custom
properties for the palette.

## Content model

```ts
type CardFace =
  | { type: "text"; body: string }
  | { type: "image"; src: string; alt: string; fit?: "cover" | "contain" };
```

A face is text or image, never both (spec §6). `lib/cards.ts` validates every
card at import time — slug shape, slug uniqueness, exactly six faces, non-empty
title and closing — so a miscounted or duplicated card fails the build rather
than the page. That check is what keeps a config file with dozens of cards in
it safe to edit, by hand or through `/editor`.

The model, the registry, the rules and the editor's design are covered in
[content and cards](./content-and-cards.md).
