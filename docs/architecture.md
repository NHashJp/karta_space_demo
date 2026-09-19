# Architecture

## Shape of the thing

One Next.js App Router application, deployed to Vercel, with no database. The
card lives in source control as configuration. There is exactly one card and
exactly one accepted slug.

```
Request  /c/[slug]
    │
    ├─ server component ──> slug unknown?  ──> invalid-card state, nothing else sent
    │                       password set and no valid cookie? ──> PasswordGate
    │                       otherwise ──> CardExperience, with card content
    │
    └─ POST /api/access ──> compare password, set HttpOnly cookie
```

Everything after access is granted happens in the browser. There is no further
server round-trip: no card API, no analytics, no response submission.

## Layers

```
app/                     routing, server-side access decisions
 ├─ c/[slug]/page.tsx    server component: the only place content is gated
 ├─ api/access/route.ts  password check, cookie issue
 └─ layout.tsx           fonts, metadata, noindex

lib/                     logic with no rendering in it
 ├─ access.ts            token derivation, cookie shape, rate limit
 ├─ card.ts              slug lookup, six-face validation
 ├─ experienceState.ts   the state machine (pure)
 └─ useFaceNavigation.ts wheel / touch / keyboard gestures

components/
 ├─ access/              PasswordGate
 ├─ card/                screens and the state machine's host component
 ├─ three/               everything inside the WebGL canvas
 │   ├─ framing.ts       camera and typography maths (pure)
 │   ├─ rotationPresets.ts  orientation maths (pure)
 │   └─ shaders/         GLSL sources
 └─ text/                vendored React Bits StrokeText

config/card.config.ts    the card itself: title, six faces, closing, links
types/card.ts            the content model
scripts/                 placeholder image generator, verification suite
```

The deliberate split is that **anything worth checking is a pure function in a
file with no React in it**. `framing.ts`, `rotationPresets.ts` and
`experienceState.ts` are all importable from a plain Node script, which is what
makes [verification](./verification.md) possible without a browser.

## Server and client boundary

`app/c/[slug]/page.tsx` is a server component. It is the only code that can see
`process.env.CARD_PASSWORD`, and the only place that decides whether to render
the card at all. When access has not been granted it returns `<PasswordGate>`
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

A face is text or image, never both (spec §6). `lib/card.ts` throws at import
time if `faces.length !== 6`, so a miscounted config fails the build rather
than the page.
