# Experience flow

Source: `lib/experienceState.ts`, `lib/useFaceNavigation.ts`,
`components/card/CardExperience.tsx`

## The machine

Twenty-four states, twenty-one events, one pure reducer. No timers, no side effects,
no async — which is why the whole flow is testable in Node. It also carries a
little session history, which is still pure: whether a reply has been
`launched`, and how many times each ceremony has been watched (below).

v0.1 ended at the closing screen. v0.2 continues past it (spec v0.2 §6), but
**only for a card that has something there**: with `hasOrbit` false the new
events are no-ops, and the walk below is exactly the v0.1 walk, transition for
transition.

```
                    open
      landing ───────────────> entering
                                  │ zoomEnd
                                  v
                               reading <──────────────┐
                              │   ^  │                │
                move (±1)     │   │  │ move(+1) at face 6
                              v   │  v                │
                     transitioning│ leaving           │
                              │   │  │ zoomEnd        │
                  rotationEnd │   │  v                │
                              └───┘ completed ────────┘
                                     │   ^   │  move(-1) or replay
                              reveal │   │   v
                                     │   │  returning ─ zoomEnd ─> reading
                                     v   │ zoomEnd
                              descending │
                                     │   ascending
                             zoomEnd │   ^
                                     v   │ reveal, or any move
                                   inside┘
```

The right-hand branch only exists for a card that has a `secret` — see
[content and cards](./content-and-cards.md). Without one, `reveal` is never
dispatched and those three states are unreachable.

Past the closing screen, for a card with an orbit:

```
                move(+1) / deploy                  deployEnd
      completed ──────────────────> deploying ───────────────> orbit
          ^                                                    │  ^
          │           deployEnd         move(-1) / dock        │  │
          └──────────── undeploying <────────────────────────────┘ │
                                                                   │
                     move(+1) / lookBack          zoomEnd          │
               orbit ────────────────> rewinding ────────> remembering
                                                            │   ^  │
                                          move(±1) in range │   │  │ off either end
                                                            v   │  v
                                                       drifting │ resurfacing
                                                            │   │  │ zoomEnd
                                                    zoomEnd └───┘  └─> orbit

               orbit ── openPanel(p) ──> orbit, panel = p
    panel "reply" ── launch ──> launching (panel closed) ── launchEnd ──> orbit, launched
```

And the comet moment, which a deployment walks into by itself (`afterDeploy`):

```
              first launch this cycle          previewEnd            zoomEnd
   deployEnd ─────────────────────────> previewing ─────────> charting ─────> nudging
       │      not yet watched leaving                 departEnd   ^             │ board
       ├──────────────────────────────> departing ────────────────┘             v
       │      back today, or room for words                               boarding
       ├──────────────────────────────> charting                             │ boardEnd
       └── otherwise ──> orbit                                               v
                                         nudging ── leaveChart ──> homing ── zoomEnd ──> orbit
```

Two rules hold the trail together. **Either end of it returns to orbit** rather
than stopping dead, so a reader scrolling through someone else's memories is
never stranded at the far end of them. And **while a panel is open every `move`
is ignored**, because the reader may be typing a reply into it; the ✕, Escape
and the space around the panel are the ways out.

`launch` and `board` are dispatched *only after the server has accepted* the
reply or the comet's words (§10, §11). `launch` also closes the reply panel: the
form has done its job, and the rocket's flight should have the screen. The animation is a confirmation, never a guess:
if the send fails there is nothing to confirm, and the panel says so instead.

| State | Camera | Face text | Secret line | Accepts input |
|---|---|---|---|---|
| `landing` | far back | hidden | hidden | no |
| `entering` | dollying in | hidden | hidden | no |
| `returning` | dollying in | hidden | hidden | no |
| `reading` | at reading distance | **shown** | hidden | yes |
| `transitioning` | at reading distance | hidden | hidden | no |
| `leaving` | dollying out | hidden | hidden | no |
| `completed` | far back | hidden | hidden | yes (to go back, or in) |
| `descending` | through the wall | hidden | hidden | no |
| `inside` | within the cube | hidden | **shown** | yes (to leave) |
| `ascending` | back out | hidden | hidden | no |
| `deploying` | pulling out to orbit | hidden | hidden | no |
| `orbit` | the orbit pose | hidden | hidden | yes |
| `undeploying` | back to far | hidden | hidden | no |
| `rewinding` | joining the trail | hidden | hidden | no |
| `remembering` | at one memory | hidden | hidden | yes |
| `drifting` | along the trail | hidden | hidden | no |
| `resurfacing` | leaving the trail | hidden | hidden | no |
| `departing` | the orbit pose | hidden | hidden | no |
| `previewing` | the orbit pose | hidden | hidden | no |
| `charting` | closing on the comet | hidden | hidden | no |
| `nudging` | the chart, sheet open | hidden | hidden | the sheet only |
| `boarding` | the chart | hidden | hidden | no |
| `homing` | back to the orbit pose | hidden | hidden | no |
| `launching` | the orbit pose | hidden | hidden | no |

A memory's title, date and caption follow the same rule face text does, in
`remembering` and nowhere else — `revealsMemory`.

Derived predicates keep those columns honest, so no component tracks them
independently:

```ts
cameraPhase(state)   // "far" | "near" | "inside" | "orbit" | "trail"
isZoomedIn(state)    // cameraPhase !== "far"
revealsText(state)   // reading, and only reading
revealsSecret(state) // inside, and only inside
revealsMemory(state) // remembering, and only remembering
isWithinCube(state)  // descending | inside | ascending — mounts the inner shell
showsCompletion(x)   // the closing screen — takes the whole experience, not
                     // just the state, because the way in from orbit passes
                     // through `descending` without ever showing it
isDeployed(state)    // everything past the closing screen — cube in satellite form
dimsScene(state)     // leaving | completed | returning | ascending | undeploying
acceptsInput(state)  // reading | completed | inside | orbit | remembering
```

`isZoomedIn` was a boolean until the cube acquired an inside; the camera now has
three positions rather than two, so `cameraPhase` is the real signal and
`isZoomedIn` is derived from it.

## The first launch: the comet, explained (`previewing`)

The first time the cube becomes a satellite in a comet's cycle, the machine
goes to `previewing` before anything asks for words. `CometIntro` (the words)
and `CometPreview` (the scene) play one timeline from `lib/cometPreview.ts`:

1. **announce** — the countdown alone, あと **X** 日, over the sender's own
   promise as entered in the editor (falling back to また会えます);
2. **draw** — the comet's way home as a dashed gold line;
3. **run** — the real comet flown home along it while the number counts down,
   and the scene's own dawn (`DawnProvider`'s `intro`) rising from today's to
   the reunion morning's, so the background at zero is exactly the sky this
   card will show on the day — warm light and meteor shower included;
4. **arrive**, then everything rewinds to today and `previewEnd` goes on to
   the chart and the 言葉をのせる sheet. スキップ ends it at any point.

"First" is remembered in the comet's visit record (`introduced`, in
`lib/cometVisit.ts`), per cycle, alongside `departed`; the intro marks both,
since it shows the same journey the departure did, and all of it. A returned
comet skips it.

Once the reader's words are aboard, the comet sheet offers it again under
軌道へもどる — 彗星の軌道をもう一度見る. That dispatches `replayIntro`, which the
reducer accepts only from the open sheet (`nudging`) and only while the comet
is still away; the replay ends where the intro always does, back on the sheet.

## Why the inside is three states, not one

`descending`, `inside` and `ascending` mirror `entering` / `reading` /
`leaving`, for the same reason: the arrival has to be *announced* by whatever is
animating. The camera says when it has passed through the wall; only then is the
line attached, which is why `revealsSecret` is true in `inside` alone and the
line fades up after the motion has stopped rather than during it.

`dimsScene` deliberately excludes `descending`: the scene is dimmed on the
closing screen, and lifting that dimming on the way in makes the cube brighten
as you enter it. `ascending` dims again, so the closing screen is exactly as it
was when you left it.

## Two ways into the cube, and `insideVia`

The inside can be reached from two places, and they are not the same journey.

From the **closing screen**, 中をのぞく is a detour: the reader is standing on
that screen, steps inside, and should be put back on it.

From **orbit**, looking into the satellite is a journey. The satellite *is*
the cube, so it leads to the same place — but `reveal` only transitions from
`completed`, because the camera is out at the hub and there is no cube to be
inside of until the satellite has folded up. So it is two moves chained:

```
orbit → undeploying → descending → inside → ascending → deploying → orbit
```

Note what is missing: **`completed` never appears.** The reader came from
orbit, has already finished with the closing screen, and putting it in front
of them for the length of the fold-up would be introducing a screen in order
to dismiss it. `showsCompletion()` suppresses it for the same reason, and the
final `deployEnd` goes straight to the hub rather than through `afterDeploy`,
so the comet moment does not replay just because someone looked inside.

`insideVia` is what remembers which of the two it is. It is reducer state
rather than a ref in the component, because *where leaving goes back to* is a
property of the journey, and the reducer is where journeys live.

## Why `entering` and `returning` are separate

Both dolly the camera in and both resolve to `reading`, so they could have been
one state. They are separate because **a different screen is departing**:
`entering` comes from the landing screen, `returning` from the closing screen.
Keeping them distinct lets each screen stay mounted and play its own exit
animation instead of vanishing the instant the phase changes.

## Why text is gated on `reading` alone

An earlier version revealed a face's text whenever that face was active and the
cube was not mid-rotation. That is true on the landing screen too — so the
first face's paragraph was drawn behind the title. Worse, drei's `<Html>`
renders into its own z-index band, so it painted *over* the overlay.

Two fixes, both still in place:

- text reveals only when `revealsText(state)` is true, which is `reading` only;
- `.screen` sits at `z-index: 60`, above `<Html>`'s `zIndexRange` of `[20, 10]`.

The [verification suite](./verification.md) asserts the first of these at every
step of a full journey, because it is the kind of regression that is easy to
reintroduce and easy to miss.

## Counting the ceremonies

Two moments in the card are ceremonies rather than transitions: the cube
becoming a satellite, and the closing line being written out by hand under the
sender's signature. Both are worth their full length the first time and a toll
every time after it, so both play at `REPLAY_SCALE` from the second time on
(see [Cube and motion](./cube-and-motion.md#the-second-trip-is-shorter)).

"The second time" is a fact about the reader's journey, so it lives in the
reducer beside `launched`, as two counts:

| Field | Counts | Read by |
|---|---|---|
| `deployments` | arrivals at `deploying` | the deploy animation, and the sound under it |
| `closings` | arrivals at `completed` | the closing line, the signature, the two invitations, and how long the replay button stays faint |

Counts rather than booleans, because what a screen actually asks is *is this
the first time* — and a count answers that on arrival, where a flag would need
a second field to say when it may be set.

They are incremented in a thin wrapper around the reducer rather than in the
transitions themselves:

```ts
export function reduceExperience(current, event) {
  const next = transition(current, event);
  if (next.state === current.state) return next;
  if (next.state === "completed") return { ...next, closings: next.closings + 1 };
  if (next.state === "deploying") return { ...next, deployments: next.deployments + 1 };
  return next;
}
```

`completed` is reached from three places — the end of the letter, coming back
out of the inside of the cube, and docking from orbit — and `deploying` from
two. A transition that forgot to count itself would look right in every test
and be wrong on exactly one route through the card, which is the hardest kind
of bug to see. The `next.state === current.state` guard is what keeps a refused
gesture from ticking a counter; verify checks all of this by walking each
route.

Note what is *not* here: none of it is written to storage. A reader who comes
back tomorrow gets the full ceremony again, which is right — they have come
back to see it.

## Who ends a phase

Nothing is on a timer. Each animated phase ends when the thing that is
animating says it has arrived:

| Phase | Ended by | Event |
|---|---|---|
| `transitioning` | `MessageCube`, when rotation progress reaches 1 | `rotationEnd` |
| `entering`, `returning`, `leaving` | `CameraRig`, when the dolly reaches its target | `zoomEnd` |
| `descending`, `ascending` | `CameraRig`, same mechanism, third target | `zoomEnd` |
| `rewinding`, `drifting`, `resurfacing` | `CameraRig`, arriving along the trail | `zoomEnd` |
| `deploying`, `undeploying` | `MessageCube`, when the panels finish | `deployEnd` |
| `launching` | `RocketLaunch` | `launchEnd` |
| `releasing` | `CometRelease` | `releaseEnd` |

So the phase and the animation cannot drift apart, whatever the frame rate.

The last three components are built in later phases (spec §19 phases 6, 13,
14). Until they exist, `CardExperience` ends those phases on a timer of the
same duration and dispatches the same event, so the flow is walkable end to end
and nothing but the visuals changes when they take over.

`CameraRig` needs one thing the phase alone cannot tell it: **which** memory it
is heading for. Moving from one memory to the next never leaves the `trail`
phase, so without a `leg` the rig would think it had already arrived and the
second memory would never announce itself.

## One gesture, one face

`lib/useFaceNavigation.ts` turns raw input into at most one `move` per
deliberate gesture.

**Wheel and trackpad.** Deltas accumulate until they cross 50, then fire. After
firing, input is held off until the gesture goes *quiet* — 260ms with no wheel
event. Trackpad momentum keeps restarting that timer, so a single flick cannot
skip two faces however long the inertia runs.

```
wheel events ──> accumulate ──> |Σ| ≥ 50 ? ──> fire, then cool
                                                  │
                          260ms with no events ───┘ (release)
```

**Touch.** Record Y on `touchstart`, compare on `touchend`, fire if the
distance is at least 45px. `touchmove` is registered non-passive and calls
`preventDefault`, which is what stops iOS rubber-banding and pull-to-refresh
from stealing the swipe.

**Keyboard.** `↑ ↓`, `PageUp/PageDown`, `Space` and `Shift+Space`.

**Except in a text field.** Every listener returns early when the event's
target is inside an `input`, `textarea`, `select` or `[contenteditable]`. Once
a card can carry a reply form, Space means "a space" there, and scrolling a
long message means scrolling the message — not turning the cube behind it.

Inside the cube, *any* `move` in either direction leaves — there is nowhere
else to go in there, so asking the reader to find the right direction would be
a puzzle with one answer. The button on screen does the same thing, which is
what makes the way out reachable by keyboard and screen reader.

All three consult a `locked` ref before firing, so a transition in flight
swallows input without the listeners being torn down and rebuilt.

## Loading

`useProgress()` from drei reports asset loading. The landing button stays
disabled, reading `カードを準備しています…`, until a 700ms settle timer has
elapsed *and* nothing is loading. The settle timer exists because `useProgress`
reports `active: false` before loading has begun — without it the button would
flash enabled for a frame.

If `errors.length > 0`, the whole experience is replaced by the asset-failure
state with a reload button (spec §28).

## Starting somewhere else (`?at=`, development only)

The editor's live preview cannot walk the whole journey every time a line
changes, so `/c/<slug>?at=orbit` starts there instead (spec v0.2 §6.6).

The reducer has **no** second way in. `lib/devJump.ts` computes the events a
reader would have sent to reach the target, and `CardExperience` replays them
at once. So the preview can only reach states a reader can reach, there is no
alternative path into any state that could quietly rot, and a card that cannot
reach the target simply stops at the last state it does have.

It is ignored in production, for the same reason `?now=` is — a query parameter
that walks past the closing screen, or unseals a comet, would be no seal at all.
Targets, as `JUMP_TARGETS` in `lib/devJump.ts` lists them: `landing`,
`face-1`…`face-6`, `closing`, `inside`, `orbit`, `departure`, `chart`,
`crossroads`, `trail`, `reply`, `trajectory`.

`departure` and `chart` are the two halves of the comet moment — the first
stops mid-flight, the second lands on the chart with the sheet open — and
`orbit` deliberately goes *past* both, into the plain hub.
