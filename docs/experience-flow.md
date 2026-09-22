# Experience flow

Source: `lib/experienceState.ts`, `lib/useFaceNavigation.ts`,
`components/card/CardExperience.tsx`

## The machine

Ten states, six events, one pure reducer. No timers, no side effects, no
async — which is why the whole flow is testable in Node.

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

Derived predicates keep those columns honest, so no component tracks them
independently:

```ts
cameraPhase(state)   // "far" | "near" | "inside"
isZoomedIn(state)    // cameraPhase !== "far"
revealsText(state)   // reading, and only reading
revealsSecret(state) // inside, and only inside
isWithinCube(state)  // descending | inside | ascending — mounts the inner shell
dimsScene(state)     // leaving | completed | returning | ascending
acceptsInput(state)  // reading | completed | inside
```

`isZoomedIn` was a boolean until the cube acquired an inside; the camera now has
three positions rather than two, so `cameraPhase` is the real signal and
`isZoomedIn` is derived from it.

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

## Who ends a phase

Nothing is on a timer. Each animated phase ends when the thing that is
animating says it has arrived:

| Phase | Ended by | Event |
|---|---|---|
| `transitioning` | `MessageCube`, when rotation progress reaches 1 | `rotationEnd` |
| `entering`, `returning`, `leaving` | `CameraRig`, when the dolly reaches its target | `zoomEnd` |
| `descending`, `ascending` | `CameraRig`, same mechanism, third target | `zoomEnd` |

So the phase and the animation cannot drift apart, whatever the frame rate.

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
