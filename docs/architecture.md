# Architecture

One Next.js App Router app with no database. React draws the screens; Three.js
(through React Three Fiber and drei) draws the scene; GLSL shaders draw the
procedural sky, planet, comet and contrail. There is no CSS framework and no
animation library for the 3D work — every animated value is advanced by hand in
`useFrame`, because each one needs an exact end state.

## Code map

```
app/
  page.tsx                 dev: card index · production: a neutral notice
  c/[slug]/page.tsx        the card — the only place access is decided
  c/[slug]/media/[...path] private pictures, behind the card's access check
  c/[slug]/reply|comet     the receiver's two ways of writing back
  comet/[token]/           the sender's link to a comet's sealed words
  api/access               password check → access cookie
  api/cron/comets          daily comet-day reminder
  editor/, api/editor/*    the authoring tool (development only)
components/
  card/                    DOM over the scene: screens, panels, sheets, the bar
  three/                   everything inside the canvas; shaders/ holds the GLSL
  access/, editor/, text/  gates, the editor UI, the vendored StrokeText
lib/                       logic — almost all pure, so it can be checked in Node
config/cards.config.ts     the committed sample cards
.karta/                    real cards and plaintext passwords (gitignored)
private/cards/<slug>/      every picture a card uses
scripts/                   the verify suite and the placeholder generator
```

**Anything worth checking is a pure function in a file with no React in it** —
`experienceState.ts`, `framing.ts`, `rotationPresets.ts`, `cometOrbit.ts`,
`dawn.ts` and the rest. That is what lets `npm run verify` prove the geometry,
the flow and the seals without a browser ([testing](./testing.md)).

## From URL to card

```
/c/<slug>  →  app/c/[slug]/page.tsx (server)
               ├─ unknown slug         → 404, nothing else sent
               ├─ password, no cookie  → PasswordGate (no card data in the page)
               └─ otherwise            → toClientCard() → CardExperience (browser)
                                                            ├─ DOM screens and panels
                                                            └─ CubeScene (the canvas)
```

`toClientCard` (`lib/clientCard.ts`) is the boundary: it drops the password hash,
withholds a sealed comet message until its date, turns picture paths into
gated media URLs, sanitises the signature, and decides from the environment
which features can actually be offered. Everything after that runs in the
browser; the server is called again only for pictures, a reply, or a comet.

## Where data lives

| Data | Where | Notes |
|---|---|---|
| Sample cards | `config/cards.config.ts` | committed, deployed |
| Real cards | `.karta/cards.local.json` | gitignored; local wins over a sample with the same slug |
| Pictures | `private/cards/<slug>/` | committed; served only through the gated media route |
| Plaintext passwords | `.karta/secrets.local.json` | gitignored; the config holds only a hash |
| Secrets and settings | environment (`.env.local` locally) | never sent to the browser |
| Replies | the sender's inbox | never stored |
| The receiver's comet words | an encrypted link, emailed to the sender | the link is the only copy |
| "Seen the intro", "launched a reply" | the reader's `localStorage` | per browser, not shared |

## The state machine

The whole experience is one pure reducer, `lib/experienceState.ts`: 24 states,
21 events, no timers, no I/O. `CardExperience` hosts it with `useReducer`.

```
landing → entering → reading ⇄ transitioning → leaving → completed
                       ↑ (scroll back / replay: returning)   │
                                                             ├─ reveal → descending → inside → ascending
                                                             └─ deploy → deploying → (comet moment) → orbit
orbit ⇄ rewinding / remembering / drifting / resurfacing   (the trail)
orbit → panel "reply" → launching → orbit                   (the rocket)
orbit → undeploying → completed                             (back to the letter)
```

The comet moment, chosen by the reducer on `deployEnd` (`afterDeploy`):

| Condition | Goes to |
|---|---|
| first launch this cycle, comet still away | `previewing` (the intro) → `charting` → `nudging` (the sheet) |
| not yet watched leaving | `departing` → `charting` → `nudging` |
| back today, or still room for words | `charting` → `nudging` |
| otherwise, or no comet | `orbit` |

From the sheet, `board` → `boarding` (words fly to the comet) and `leaveChart` →
`homing` → `orbit`; `replayIntro` plays the intro again and returns to the sheet.
`launch` and `board` are dispatched only after the server accepts the message, so
an animation is a confirmation, never a guess.

Rules worth knowing:

- **Nothing is on a timer.** Each animated phase ends when the thing animating
  says it has arrived: `MessageCube` (`rotationEnd`, `deployEnd`), `CameraRig`
  (`zoomEnd`), `RocketLaunch` (`launchEnd`), `CometDeparture` (`departEnd`),
  `CapsuleBoarding` (`boardEnd`), `CometIntro` (`previewEnd`). Phase and
  animation cannot drift apart at any frame rate.
- **Content is attached only when it is being read**: face text in `reading`,
  the secret line in `inside`, a memory in `remembering`. Derived predicates
  (`revealsText`, `cameraPhase`, `isDeployed`, `dimsScene`, `acceptsInput`, …)
  keep every component reading the same answer.
- **A card with no orbit is the v0.1 card**: with `hasOrbit` false the orbit
  events are no-ops.
- **Reached from orbit, the inside never shows the closing screen**:
  `undeploying → descending → inside → ascending → deploying → orbit`
  (`insideVia` remembers which way in).
- **Ceremonies are counted** (`closings`, `deployments`), so the second
  deployment and closing play at `REPLAY_SCALE` (0.55).

## Input

`lib/useFaceNavigation.ts` turns wheel, swipe and keys (↑ ↓, PageUp/Down,
Space) into at most one `move` per deliberate gesture: wheel deltas accumulate
to 50 then lock until 260 ms of quiet, so trackpad momentum cannot skip a face;
a swipe needs 45 px. Input inside a text field is ignored, and nothing fires
while a transition is in flight.

## Animation without re-rendering

React renders when a *phase* changes — a handful of times a session. Every
continuous value (cube orientation, camera, opacity, uniforms) lives in a ref
and is advanced in `useFrame`, applied straight to three.js objects.

## Development parameters

Inert in production (each checks for itself):

| | |
|---|---|
| `?at=` | replay the reader's own events to a state: `landing`, `face-1`…`face-6`, `closing`, `inside`, `orbit`, `departure`, `chart`, `crossroads`, `trail`, `reply`, `trajectory` |
| `?now=` | move the card's clock, e.g. `?now=2026-12-25` |
| `?visit=` | pretend a `first`, `again` or `sent` visit |
| `MAIL_DEV_SINK=1` | write emails to `.mail/` instead of sending them |

`?at=` has no back door into the reducer — it can only reach states a reader can.
