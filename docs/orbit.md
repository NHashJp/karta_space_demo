# The orbit

Source: `lib/experienceState.ts`, `lib/deployment.ts`, `lib/cometOrbit.ts`,
`lib/trailCurve.ts`, `components/three/`, `components/card/`

## What v0.2 is for

v0.1 was a letter you could read. It ended, well, at the end.

v0.2 asks a different question: *what happens after the last face?* The answer
is not more content. It is that the letter turns out to be **an object that
keeps going** — it unfolds into a satellite, takes up an orbit, and carries
things that will come back on dates you can know in advance. The point is not
the feature list. It is that when the receiver closes the card, the story has a
future in it.

## The journey

```
landing → six faces → closing screen
                         │
                         │  この手紙には、続きがあります。
                         ↓
                      deploying ── the cube becomes a satellite
                         ↓
                       orbit ─────────────────────────────┐
                    ╱    │    ╲                           │
              satellite  trail  comets                    │ 手紙に戻る
                    ╲    │    ╱                           │
                         └────────────────────────────────┘
```

Every branch is optional. A card with none of them ends exactly where v0.1
ended, and the state machine proves it: with `hasOrbit` false the new events
are no-ops and the v0.1 journey still walks the same 57 transitions.

## Why each thing is the thing it is

### The cube becomes a satellite, rather than opening a menu

The closing screen could have grown three buttons. Instead the object you have
been reading *turns into* the thing that carries the rest — panels out, thruster
lit, up onto an orbit — because that is the one moment that says "this
continues" without a word of explanation. It is the most expensive animation in
the product and the most load-bearing.

Docking plays the same timeline backwards, which is what guarantees the closing
screen comes back exactly as it was left. See
[cube and motion](./cube-and-motion.md).

### The trail runs backwards in time

Memories are read newest first, receding into the distance. Forwards is
*further back*, which is the opposite of a gallery and the point of a contrail:
you are following where something has been.

Either end returns to orbit rather than stopping dead. Nobody should be
stranded at the far end of someone else's memories with no way out but the
browser's back button.

**Every move along the trail follows the curve**, and so does the way back. The
camera never interpolates between two memories in a straight line through
space: `poseOnTrail(u)` walks the curve parameter, so the path it takes is the
trail's own shape. Leaving the trail *retraces* it — the camera runs `u` back
down to the near end over the first 72% of the move, then pulls out to orbit —
and it does so much faster than the way out, about 320 ms per memory against
1100 going forward. Cutting straight home would throw away the one thing the
reader has just learned about this card: what its trail looks like.

The colours drift — two to four of the palette blending along its length, any
one point taking 20–40 seconds to become another colour. It should never be
*caught* changing. Each card's trail has its own colours and its own bend, both
seeded from the slug.

### The satellite is a promise, not a calendar entry

One date, one line, and then: *{from} will be in touch.*

There is deliberately no "add to calendar" button and no reminder to the
receiver. A card that put a date in someone's calendar would be asking **them**
to keep the promise. This tells them it is being kept for them — and the daily
job emails the *sender* on the day, so it actually is.

### The time capsule is a comet

A sealed message needs to say two things at once: *you cannot read this yet*,
and *you will be able to, on a date you can know*. A padlock says only the
first. A message into deep space never comes back at all.

A comet does both, and its **position is the countdown**. Real Kepler motion
spends most of the wait far out and faint, then swings home in the last tenth
with a growing tail — so for months it is a speck you have to look for, and in
the final weeks it is unmistakably coming back. Nobody has to read a number to
feel that the day is near.

Both people can send one. The sender's is ion-blue, set in the config, and
already on its way when the card is first opened. The receiver's is warm,
released from the orbit view, and goes to the sender as a link. See
[messaging](./messaging.md) for what that link is and what it costs.

### The reply meets the letter

The rocket pauses beside the satellite for a moment before going on. That pause
is the animation: without it, something is being fired into space; with it, the
reply visibly meets the letter that prompted it.

It plays **only after the server has accepted the message**. The animation is a
confirmation, never a guess — if the send fails there is nothing to confirm,
and the panel says so instead.

## Composition

| Object | Where |
|---|---|
| The cube | a small tilted ellipse, 2.9 × 2.1, near the middle of the frame, one lap every 48 s |
| Orbit ring | one hairline at 18% — without it the cube is a wandering speck |
| Planet 「あなたの星」 | radius 2.9, down in the lower-right and deliberately cropped, turning once every two minutes |
| Trail | a curve from just behind the ring out to z ≈ −70 |
| The comet | wherever its dates put it, on an orbit tilted 22° off the cube's |

**This departs from the spec's §8.9, on purpose.** There the planet is centred
and low and the cube rings it — which put the planet in the middle of the frame
and, because the orbit's semi-minor axis (2.6) barely cleared the planet's
radius (2.2), sent the cube *through* the planet's disc twice a lap.

So the two are separated. The **cube is the subject**: it travels a small
ellipse near the middle, where the eye already is. The planet is scenery —
larger, further away, in the corner, turning visibly. They move alongside each
other rather than one around the other.

Two consequences worth recording:

- `orbitSamples()` frames **the cube's orbit only**. Framing the planet as well
  pushed the camera from 15 units back to 41 on a phone, which made the subject
  a speck. The planet is instead *placed* so this frame crops it: its upper-left
  arc rises into the lower-right corner, which is how a planet you are near
  actually looks. Verify checks its near limb is still in frame, and that it
  stays below and right of the camera, so "planet in the corner" cannot quietly
  become "no planet".
- `orbitClearance()` is a checked number, currently **2.76 units**. The two
  objects shared a centre once and the result was a cube falling into a planet;
  a positive clearance is what stops that coming back.

The planet turns once every two minutes rather than §22's twenty. Twenty
minutes is right for a planet you are standing on and wrong for one you look at
for ninety seconds — at that rate nothing visibly moves.

## The rule that holds all of it together

**Nothing is on a timer that can disagree with what is on screen.** Every
animated phase ends when the thing that is animating says it has arrived:
`MessageCube` owns the deployment, `CameraRig` owns the trail, `RocketLaunch`
and `CometRelease` own their own flights. The reducer is pure and knows about
none of it.
