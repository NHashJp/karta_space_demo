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

### The trail is staged, not placed

`trailControlPoints` gives a curve that knows nothing about the screen: it
starts at the world origin and recedes. Revision 6 parks the satellite at that
same origin, so drawn as-is the first stretch of the contrail came out of the
middle of the spacecraft — a real bug, and a very visible one on a phone.

`stagedTrail(seed, width, height)` puts that curve where §4.5 wants it: leaving
from the upper-left, clear of the satellite, receding to the top of the frame.
It does that by projecting **both** screen targets back into the world at their
own depths and using the line between them as the spine, keeping the card's own
wander as an offset around it. Picking an angle instead does not work: a line
that simply recedes converges on the centre of the frame, and the centre of the
frame is where the satellite is.

Everything that touches the trail asks `useStagedTrail` for it — the ribbon,
the memory panels hanging off it, and the camera that drives it — rather than
one of them building it and handing it to the others. It is pure in the seed
and the viewport, so they cannot disagree, and none of them can be left holding
a curve from before the last rotation.

### The trail is flown beside, not down

The camera used to back straight off along the curve's own tangent, which put
it *on* the ribbon: the centreline passed two tenths of a unit from the lens,
with the camera pointed down its length. Additively blended, a strip that close
stacks into a white wedge across the whole frame, and the memory behind it is a
wireframe in fog. Every segment was individually correct; the sum was not.

`trailPose` flies seventeen degrees off the axis — to one side and a little
above. The ribbon then sweeps past the corner of the frame and away to the
vanishing point, which is both legible and the thing that says *you are moving
along something*. It costs 4% of the panel's width to foreshortening. The
ribbon also fades within 2.6 units of the lens, so no camera position can bring
that failure back.

Memories are spaced by **distance travelled**, not by curve parameter. The
curve's z is quadratic, so even steps of `u` put the first two memories five
world units apart and the last two fifty — one scroll barely moved you and the
next threw you a third of the way down the trail. The old code spaced `u`
evenly and its comment claimed even effort; the comment was aspirational.

### Speed is drawn, not simulated

A satellite that holds its place on screen is the right picture and the wrong
sensation: nothing in the frame moves, so nothing says the thing is travelling.
The station-keeping drift and the turning sky are both true and both far too
slow to read as motion.

`SpeedStreaks` is the cue — short streaks sweeping past the lens, where the
*length of the streak is the speed*. It appears only in the hub and on the
trail, never where a letter is being read, and its opacity is the speed itself,
so a still scene is a still scene. On the trail the rate is measured from how
far the camera actually moved last frame, which is the one way a streak field
can never disagree with the motion it describes.

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

## Composition (revision 6)

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

## The chrome, from the mockups (M5, M12–M14, M8, M9)

The orbit view's interface is built from two shapes and nothing else.

**Glass.** One recipe — `--glass`, `--glass-edge`, `--glass-shadow`,
`--glass-blur` — for every sheet and panel: the comet sheet, the crossroads,
the reply form. They are the same object seen in different places, and the eye
notices immediately when the blur or the border disagree between them. Each
one opens with a small letter-spaced label and a ✕, and no rule under it —
except the form panels, which carry a hairline so the prompt does not read as
the first field's label.

**Pills.** The bar, the sound toggle and the social icons are all a 48px pill
or circle with `--chrome-fill` behind them and an 8px blur. The fill is not
decoration: the planet's lit limb comes up into the bottom-right corner, and a
transparent control disappears into the bright half of the frame.

Three placement rules fall out of the composition rather than out of taste:

- **Panels sit at the bottom**, because the sky is the top two-thirds and a
  centred box lands on the subject of the screen it belongs to. A panel with a
  *form* in it sits high instead (`place="high"`), clear of the planet and of
  the keyboard.
- **The bar wraps to two rows**, capped at 358px so four pills break in the
  same place on every phone rather than at whatever width the labels reach.
- **The chrome hides while something is being asked.** `:has(.panel-layer)`
  fades the bar, the tip and the aboard chip out. The glass is translucent by
  design, and four pills reading through a sheet that is itself offering two
  choices turns one question into six.

The comet's invite is **two steps** (M13a, then M13b). Asking and answering are
different sizes of decision: the first is "would you?", which is one line and
two buttons; the second is a form. Opening straight into the form answered the
first question on the reader's behalf.

## The rule that holds all of it together

**Nothing is on a timer that can disagree with what is on screen.** Every
animated phase ends when the thing that is animating says it has arrived:
`MessageCube` owns the deployment, `CameraRig` owns the trail, `RocketLaunch`
and `CometRelease` own their own flights. The reducer is pure and knows about
none of it.
